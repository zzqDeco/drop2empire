package domain

import (
	"sort"
	"time"
)

func AdvanceEconomy(w *WorldState, now time.Time) error {
	EnsureEconomy(w, now)
	e := w.Economy
	end := now.UTC().Truncate(time.Minute)
	if end.Sub(e.LastTick) > 8*time.Hour {
		e.LastTick = end.Add(-8 * time.Hour)
	}
	for t := e.LastTick.Add(time.Minute); !t.After(end); t = t.Add(time.Minute) {
		ids := sortedKeys(e.Companies)
		for _, id := range ids {
			c := e.Companies[id]
			settleIPO(w, c, t)
			settleCompanyVote(w, c, t)
			completeCompanyBatches(c, t)
		}
		for _, id := range ids {
			c := e.Companies[id]
			if c.Status == "listed" {
				if err := offerCompanyOutput(w, c, t); err != nil {
					return err
				}
			}
		}
		for _, id := range ids {
			c := e.Companies[id]
			if c.Status == "listed" {
				if err := operateCompany(w, c, t); err != nil {
					return err
				}
			}
		}
		e.LastTick = t
	}
	return nil
}

func completeCompanyBatches(c *Company, now time.Time) {
	s, _ := FindCompanySpec(c.ID)
	active := c.Batches[:0]
	for _, b := range c.Batches {
		if now.Before(b.Ends) {
			active = append(active, b)
			continue
		}
		c.Wallet.Stock[s.Output] += b.Output
		c.StockCost[s.Output] += b.Cost
		c.CompletedBatches++
	}
	c.Batches = active
}

func offerCompanyOutput(w *WorldState, c *Company, now time.Time) error {
	s, _ := FindCompanySpec(c.ID)
	a := walletMarketAccount(&c.Wallet)
	// Reprice only when shareholders change the ask; unchanged orders keep time priority.
	for _, o := range w.Orders {
		if o.MakerHandle == a.handle && o.Side == "ASK" && o.Status == "OPEN" && o.PriceBasis != c.Plan.AskPrice {
			if err := cancelMarketOrder(w, a, o.ID); err != nil {
				return err
			}
		}
	}
	qty := c.Wallet.Stock[s.Output] / 1000 * 1000
	if qty > 0 {
		if !marketOrderCapacity(w, a.handle, 1) {
			c.StatusReason = "订单簿已满，等待挂售"
			return nil
		}
		return placeMarketOrder(w, a, s.Output, "ASK", c.Plan.AskPrice, qty, now)
	}
	return nil
}

type procurementQuote struct {
	item       string
	qty, price int64
}

// Quotes are grounded in executable depth, excluding self orders. We acquire
// only the missing inputs for a funded batch; absent inputs do not strand cash
// in unrelated commodities or create speculative bids.
func quoteProcurement(w *WorldState, c *Company, needs map[string]int64) ([]procurementQuote, int64, bool) {
	var result []procurementQuote
	total := int64(0)
	for _, key := range sortedKeys(needs) {
		missing := max(int64(0), needs[key]-c.Wallet.Stock[key])
		missing = (missing + 999) / 1000 * 1000
		if missing == 0 {
			continue
		}
		var asks []MarketOrder
		for _, o := range w.Orders {
			if o.ItemKey == key && o.Side == "ASK" && o.Status == "OPEN" && o.MakerHandle != c.Wallet.Handle {
				asks = append(asks, o)
			}
		}
		sort.Slice(asks, func(i, j int) bool {
			if asks[i].PriceBasis != asks[j].PriceBasis {
				return asks[i].PriceBasis < asks[j].PriceBasis
			}
			return orderSequence(asks[i].ID) < orderSequence(asks[j].ID)
		})
		for _, o := range asks {
			n := min(missing, o.RemainingMilli)
			if n == 0 {
				continue
			}
			v, err := marketValue(n, o.PriceBasis)
			if err != nil || total > MaxMoneySupply-v {
				return nil, 0, false
			}
			result = append(result, procurementQuote{key, n, o.PriceBasis})
			total += v
			missing -= n
			if missing == 0 {
				break
			}
		}
		if missing > 0 {
			return nil, 0, false
		}
	}
	return result, total, true
}

func acquireInputs(w *WorldState, c *Company, needs map[string]int64, budget int64, now time.Time) (bool, error) {
	quotes, total, ok := quoteProcurement(w, c, needs)
	if !ok {
		c.StatusReason = "等待市场供货"
		return false, nil
	}
	if total > budget || total > c.Wallet.Cash {
		c.StatusReason = "采购超出预算或可用现金"
		return false, nil
	}
	if !marketOrderCapacity(w, c.Wallet.Handle, len(quotes)) {
		c.StatusReason = "订单簿已满，等待采购"
		return false, nil
	}
	// Price-time priority produces the same fill sequence as the inspected quote
	// under the enclosing authoritative world transaction.
	for _, q := range quotes {
		if err := placeMarketOrder(w, walletMarketAccount(&c.Wallet), q.item, "BID", q.price, q.qty, now); err != nil {
			return false, err
		}
	}
	return true, nil
}

// System production must never prevent users from cancelling a full book.
// Reserving the entire quote's order count also prevents partial procurement.
func marketOrderCapacity(w *WorldState, handle string, additional int) bool {
	open, own := 0, 0
	for _, o := range w.Orders {
		if o.Status == "OPEN" {
			open++
			if o.MakerHandle == handle {
				own++
			}
		}
	}
	return open+additional <= 10000 && own+additional <= 128
}

func companyInputCost(c *Company, needs map[string]int64) int64 {
	var cost int64
	for k, n := range needs {
		cost += proportion(c.StockCost[k], min(n, c.Wallet.Stock[k]), c.Wallet.Stock[k]+c.Wallet.Frozen[k])
	}
	return cost
}
func consumeCompanyStock(c *Company, needs map[string]int64) int64 {
	cost := int64(0)
	for k, n := range needs {
		v := proportion(c.StockCost[k], n, c.Wallet.Stock[k]+c.Wallet.Frozen[k])
		c.StockCost[k] -= v
		c.Wallet.Stock[k] -= n
		cost += v
	}
	return cost
}

func operateCompany(w *WorldState, c *Company, now time.Time) error {
	s, _ := FindCompanySpec(c.ID)
	recipe, ok := companyRecipe(s, c.Plan.Route)
	if !ok {
		return ErrInvalidInput("公司配方不存在")
	}
	capitalReserve := int64(0)
	if c.Expansion != nil {
		x := c.Expansion
		capitalReserve = x.Budget
		needs := units(ResStone, 400, ResWood, 300, ResIronIngot, 100, ResCharcoal, 60)
		needs[x.Pack] = 40 * 1000
		acquired, err := acquireInputs(w, c, needs, x.Budget, now)
		if err != nil {
			return err
		}
		if acquired {
			consumeCompanyStock(c, needs)
			c.Lines++
			c.Expansion = nil
			capitalReserve = 0
		}
	}
	if c.Plan.ActiveLines == 0 {
		c.StatusReason = "股东计划暂停生产"
		return nil
	}
	busy := map[int32]bool{}
	output := c.Wallet.Stock[s.Output] + c.Wallet.Frozen[s.Output]
	for _, b := range c.Batches {
		busy[b.Line] = true
		output += b.Output
	}
	for line := int32(0); line < c.Plan.ActiveLines; line++ {
		if busy[line] {
			continue
		}
		// At most two batches of unsold and in-flight output per active line.
		if output+s.OutputUnits*1000 > int64(c.Plan.ActiveLines)*s.OutputUnits*1000*2 {
			c.StatusReason = "库存达到两批覆盖，等待销量"
			break
		}
		needs := map[string]int64{}
		for k, n := range recipe.Inputs {
			needs[k] = n
		}
		duration := recipe.Seconds
		pack := c.Plan.Pack
		// A paid charge is retained across a plan change, but cannot be stacked.
		if c.PackCharges[line] > 0 {
			pack = c.PackModes[line]
		}
		newPack := pack != "" && c.PackCharges[line] == 0
		if pack == ResPrecisionPack {
			for k, n := range needs {
				if !isCorporateGood(k) {
					needs[k] = (n*9 + 9) / 10
				}
			}
		}
		if pack == ResHeavyPack {
			duration = duration * 8 / 10
		}
		if newPack {
			needs[pack] += 1000
		}
		_, buyCost, available := quoteProcurement(w, c, needs)
		fullCost := companyInputCost(c, needs) + buyCost
		packCost := int64(0)
		if newPack {
			_, buy, ok := quoteProcurement(w, c, map[string]int64{pack: 1000})
			if ok {
				packCost = companyInputCost(c, map[string]int64{pack: 1000}) + buy
			} else {
				available = false
			}
		}
		cost := fullCost - packCost
		if newPack {
			cost += (packCost + 4) / 5
		} else if c.PackCharges[line] > 0 {
			cost += c.PackCosts[line] / int64(c.PackCharges[line])
		}
		beneficial := true
		if newPack {
			_, baseBuy, baseOK := quoteProcurement(w, c, recipe.Inputs)
			baseCost := companyInputCost(c, recipe.Inputs) + baseBuy
			if pack == ResPrecisionPack {
				beneficial = baseOK && (baseCost-(fullCost-packCost))*5 >= packCost
			}
			if pack == ResHeavyPack {
				demand := int64(0)
				for _, o := range w.Orders {
					if o.ItemKey == s.Output && o.Side == "BID" && o.Status == "OPEN" && o.PriceBasis >= c.Plan.AskPrice {
						demand += o.RemainingMilli
					}
				}
				beneficial = demand >= s.OutputUnits*1000 && (s.OutputUnits*c.Plan.AskPrice*99/100-baseCost)*5/4 >= packCost
			}
		}
		if newPack && (!available || !beneficial || cost > c.Plan.InputBudget || cost >= s.OutputUnits*c.Plan.AskPrice*99/100) {
			needs = map[string]int64{}
			for k, n := range recipe.Inputs {
				needs[k] = n
			}
			pack = ""
			newPack = false
			packCost = 0
			duration = recipe.Seconds
			_, buyCost, available = quoteProcurement(w, c, needs)
			cost = companyInputCost(c, needs) + buyCost
		}

		if !available {
			c.StatusReason = "等待市场供货"
			continue
		}
		if cost > c.Plan.InputBudget || cost >= s.OutputUnits*c.Plan.AskPrice*99/100 {
			c.StatusReason = "投入成本超过批次预算或销售收入"
			continue
		}
		budget := max(int64(0), c.Wallet.Cash-capitalReserve)
		acquired, err := acquireInputs(w, c, needs, budget, now)
		if err != nil {
			return err
		}
		if !acquired {
			continue
		}
		if newPack {
			paid := consumeCompanyStock(c, map[string]int64{pack: 1000})
			delete(needs, pack)
			c.PackCharges[line] = 5
			c.PackModes[line] = pack
			c.PackCosts[line] = paid
		}
		cost = consumeCompanyStock(c, needs)
		if c.PackCharges[line] > 0 {
			charge := c.PackCosts[line] / int64(c.PackCharges[line])
			c.PackCosts[line] -= charge
			c.PackCharges[line]--
			cost += charge
		}

		c.NextBatchSeq++
		c.Batches = append(c.Batches, CompanyBatch{ID: c.NextBatchSeq, Line: line, Ends: now.Add(time.Duration(duration) * time.Second), Output: s.OutputUnits * 1000, Cost: cost})
		output += s.OutputUnits * 1000
		c.StatusReason = "生产中"
	}
	return nil
}
