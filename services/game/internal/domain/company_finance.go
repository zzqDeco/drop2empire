package domain

import (
	"math/big"
	"sort"
	"time"
)

func IntroduceCompany(w *WorldState, id string, shares, price, minShares int64, ends time.Time, now time.Time) error {
	EnsureEconomy(w, now)
	s, ok := FindCompanySpec(id)
	if !ok {
		return ErrNotFound("未列入策划公司目录")
	}
	if w.Economy.Companies[id] != nil && w.Economy.Companies[id].Status != "failed" {
		return ErrPrecondition("company_exists", "同一经济周期公司只能引入一次")
	}
	if shares < 1000 || shares > 1_000_000 || minShares < (shares+1)/2 || minShares > shares || price < 100 || price > 100_000_000 || shares > MaxMoneySupply/price || ends.Before(now.Add(time.Hour)) || ends.After(now.Add(14*24*time.Hour)) {
		return ErrInvalidInput("IPO 股数、价格、募资下限或认购期限不合法")
	}
	w.Economy.Companies[id] = &Company{ID: id, Wallet: newTradingWallet("@company:" + id), Status: "subscription", Shares: shares, IPOPrice: price, IPOMinShares: minShares, IPOEnds: ends, Subscriptions: map[string]int64{}, Lines: 1, Plan: CompanyPlan{Route: "standard", ActiveLines: 1, AskPrice: s.ReferencePrice, InputBudget: s.ReferencePrice * s.OutputUnits * 85 / 100}, StockCost: map[string]int64{}, PackCharges: map[int32]int32{}, PackCosts: map[int32]int64{}, PackModes: map[int32]string{}}
	RecordEconomy(w, "ipo_open", id, "planner", w.Economy.Companies[id], now)
	for _, p := range w.Players {
		if p.Profession != ProfNone {
			AppendLog(p, now, "IPO", s.Name+"开启 IPO 认购，详情见公司与股权。")
		}
	}

	return nil
}

func SubscribeIPO(w *WorldState, p *PlayerState, id string, shares int64, now time.Time) error {
	c := w.Economy.Companies[id]
	if p.Profession == ProfNone || c == nil || c.Status != "subscription" || !now.Before(c.IPOEnds) {
		return ErrPrecondition("ipo_closed", "当前不可认购")
	}
	if shares <= 0 || shares > c.Shares-c.Subscriptions[p.Handle] {
		return ErrInvalidInput("个人认购总数不得超过本次发行量")
	}
	gold := shares * c.IPOPrice
	if err := applyMarketDeltas([]balanceDelta{{&p.GoldBasis, -gold}, {&c.IPOCash, gold}}); err != nil {
		return err
	}
	c.Subscriptions[p.Handle] += shares
	RecordEconomy(w, "ipo_subscribe", id, p.Handle, shares, now)
	return nil
}

func settleIPO(w *WorldState, c *Company, now time.Time) {
	if c.Status != "subscription" || now.Before(c.IPOEnds) {
		return
	}
	handles := sortedKeys(c.Subscriptions)
	total := int64(0)
	for _, n := range c.Subscriptions {
		total += n
	}
	if total < c.IPOMinShares {
		for _, h := range handles {
			w.Players[h].GoldBasis += c.Subscriptions[h] * c.IPOPrice
		}
		c.IPOCash = 0
		c.Status = "failed"
		c.StatusReason = "募资未达下限，认购款已原路退回"
		RecordEconomy(w, "ipo_refund", c.ID, "", c.Subscriptions, now)
		for _, h := range handles {
			AppendLog(w.Players[h], now, "IPO", ResourceName(ShareKey(c.ID))+"认购失败，资金已退回")
		}
		return
	}
	issued := min(total, c.Shares)
	alloc := map[string]int64{}
	sum := int64(0)
	// Largest-remainder pro rata, with handle as the deterministic tie-break.
	for _, h := range handles {
		alloc[h] = c.Subscriptions[h] * issued / total
		sum += alloc[h]
	}
	sort.SliceStable(handles, func(i, j int) bool {
		return c.Subscriptions[handles[i]]*issued%total > c.Subscriptions[handles[j]]*issued%total
	})
	for i := int64(0); i < issued-sum; i++ {
		alloc[handles[i]]++
	}
	for _, h := range handles {
		n := alloc[h]
		p := w.Players[h]
		p.ResourcesMilli[ShareKey(c.ID)] += n * ResourceScale
		p.GoldBasis += (c.Subscriptions[h] - n) * c.IPOPrice
		AppendLog(p, now, "IPO", "IPO 配售完成："+ResourceName(ShareKey(c.ID)))
	}
	c.Shares = issued
	c.Wallet.Cash = c.IPOPrice * issued
	c.IPOCash = 0
	c.Status = "listed"
	c.NextVoteAt = now.Add(7 * 24 * time.Hour)
	RecordEconomy(w, "ipo_allocation", c.ID, "", alloc, now)
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// Weighted-average cost remains attached to inventory, including ask escrow.
// Financing and unsold output never count as retained earnings.
func recordCorporateTrade(w *WorldState, buyer, seller, item string, qty, gold, tax int64) {
	if w.Economy == nil {
		return
	}
	for _, c := range w.Economy.Companies {
		if c.Wallet.Handle == buyer {
			c.StockCost[item] += gold
		}
		if c.Wallet.Handle == seller {
			previousQty := c.Wallet.Stock[item] + c.Wallet.Frozen[item] + qty
			cost := proportion(c.StockCost[item], qty, previousQty)
			c.StockCost[item] -= cost
			c.Revenue += gold - tax
			c.RealizedProfit += gold - tax - cost
		}
	}
}

func proportion(value, n, d int64) int64 {
	if d <= 0 {
		return 0
	}
	x := new(big.Int).Mul(big.NewInt(value), big.NewInt(n))
	x.Quo(x, big.NewInt(d))
	return x.Int64()
}

func shareWeights(w *WorldState, c *Company) map[string]int64 {
	r := map[string]int64{}
	for h, p := range w.Players {
		n := (p.ResourcesMilli[ShareKey(c.ID)] + p.FrozenResourcesMilli[ShareKey(c.ID)]) / 1000
		if n > 0 {
			r[h] = n
		}
	}
	return r
}

func validCompanyPlan(c *Company, p CompanyPlan) error {
	s, _ := FindCompanySpec(c.ID)
	_, ok := companyRecipe(s, p.Route)
	if !ok || p.ActiveLines < 0 || p.ActiveLines > c.Lines || p.AskPrice < 100 || p.AskPrice > MacroBalance.MaxOrderPriceBasis || p.InputBudget < 0 || p.InputBudget > MaxMoneySupply || p.Dividend < 0 || p.Dividend > MaxMoneySupply || p.CapitalBudget < 0 || p.CapitalBudget > MaxMoneySupply {
		return ErrInvalidInput("经营方案参数超出许可范围")
	}
	if p.Pack != "" && p.Pack != ResHeavyPack && p.Pack != ResPrecisionPack {
		return ErrInvalidInput("未知的作业包")
	}
	if p.ExpandWith == "cancel" {
		if c.Expansion == nil || p.CapitalBudget != 0 {
			return ErrPrecondition("no_expansion", "没有待取消的扩建，取消时预算必须为零")
		}
	} else if p.ExpandWith != "" && p.ExpandWith != ResHeavyPack && p.ExpandWith != ResPrecisionPack {
		return ErrInvalidInput("未知的扩建路线")
	} else if p.ExpandWith != "" && (c.Lines >= MaxCompanyLines || p.CapitalBudget <= 0) {
		return ErrPrecondition("line_limit", "已达到策划许可产线数")
	}
	return nil
}

// Each weekly window has one explicit, bounded operating ballot. All holders
// receive the same snapshot; trading the shares cannot duplicate votes.
func OpenCompanyVote(w *WorldState, p *PlayerState, id string, plan CompanyPlan, now time.Time) error {
	c := w.Economy.Companies[id]
	if c == nil || c.Status != "listed" {
		return ErrNotFound("公司尚未上市")
	}
	if now.Before(c.NextVoteAt) || (c.Vote != nil && c.Vote.Result == "") {
		return ErrPrecondition("vote_window", "本周期投票尚未开放或已经开始")
	}
	weights := shareWeights(w, c)
	if weights[p.Handle] < max(int64(1), (c.Shares+99)/100) {
		return ErrPrecondition("proposal_threshold", "提案需要持有至少 1% 股份")
	}
	if err := validCompanyPlan(c, plan); err != nil {
		return err
	}
	c.Vote = &CompanyVote{ID: now.Unix(), Ends: now.Add(24 * time.Hour), Weights: weights, Ballots: map[string]bool{}, Plan: plan}
	c.NextVoteAt = now.Add(7 * 24 * time.Hour)
	RecordEconomy(w, "vote_open", c.ID, p.Handle, c.Vote, now)
	for h := range weights {
		AppendLog(w.Players[h], now, "GOVERNANCE", ResourceName(ShareKey(c.ID))+"开启股东投票，请在公司页面审议经营方案")
	}
	return nil
}

func VoteCompany(w *WorldState, p *PlayerState, id string, voteID int64, yes bool, now time.Time) error {
	c := w.Economy.Companies[id]
	if c == nil || c.Vote == nil || c.Vote.ID != voteID || c.Vote.Result != "" || !now.Before(c.Vote.Ends) {
		return ErrPrecondition("vote_closed", "投票已关闭或届次不符")
	}
	if c.Vote.Weights[p.Handle] == 0 {
		return ErrPrecondition("not_snapshot_holder", "不在本期股权快照中")
	}
	c.Vote.Ballots[p.Handle] = yes
	RecordEconomy(w, "vote_cast", id, p.Handle, yes, now)
	return nil
}

func settleCompanyVote(w *WorldState, c *Company, now time.Time) {
	v := c.Vote
	if v == nil || v.Result != "" || now.Before(v.Ends) {
		return
	}
	defer func() {
		RecordEconomy(w, "vote_result", c.ID, "", v, now)
		for h := range v.Weights {
			AppendLog(w.Players[h], now, "GOVERNANCE", ResourceName(ShareKey(c.ID))+"："+v.Result)
		}
	}()
	yes, no := int64(0), int64(0)
	for h, b := range v.Ballots {
		if b {
			yes += v.Weights[h]
		} else {
			no += v.Weights[h]
		}
	}
	if (yes+no)*100 < c.Shares*25 || yes <= no {
		v.Result = "未通过：未达 25% 法定参与比例或赞成未过半"
		return
	}
	// Capital and dividends are all-or-nothing and revalidated against settlement
	// cash and inventory; approval never authorizes borrowing or money creation.
	plan := v.Plan
	if err := validCompanyPlan(c, plan); err != nil {
		v.Result = "未执行：方案已失效"
		return
	}
	reserve := plan.InputBudget * int64(max(int32(1), plan.ActiveLines)) * 2
	if c.Expansion != nil && plan.ExpandWith == "" {
		reserve += c.Expansion.Budget
	}
	if plan.ExpandWith != "" && plan.ExpandWith != "cancel" {
		reserve += plan.CapitalBudget
	}
	if reserve > c.Wallet.Cash || plan.Dividend > max(int64(0), c.RealizedProfit-c.Dividends) || plan.Dividend > max(int64(0), c.Wallet.Cash-reserve) {
		v.Result = "未执行：扩建预算、利润或现金不足，保留原计划"
		return
	}
	if plan.ExpandWith == "cancel" {
		c.Expansion = nil
	} else if plan.ExpandWith != "" {
		c.Expansion = &CompanyExpansion{Pack: plan.ExpandWith, Budget: plan.CapitalBudget}
	}
	if plan.Dividend > 0 {
		// Use current beneficial owners for payout, independently of voting weights.
		weights := shareWeights(w, c)
		paid := int64(0)
		for _, h := range sortedKeys(weights) {
			n := proportion(plan.Dividend, weights[h], c.Shares)
			w.Players[h].GoldBasis += n
			paid += n
		}
		c.Wallet.Cash -= paid
		c.Dividends += paid
	}
	plan.ExpandWith = ""
	plan.Dividend = 0
	plan.CapitalBudget = 0
	c.Plan = plan
	v.Result = "已通过并执行"
}
