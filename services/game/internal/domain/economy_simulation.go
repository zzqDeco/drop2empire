package domain

import (
	"fmt"
	"time"
)

// Scenario actors represent a stated external production/demand schedule. All
// cash, IPOs, procurement, matching and company production use the live engine.
// This is a balance experiment, not a prediction of human market behaviour.
type EconomyScenario struct {
	Pack              string `json:"pack,omitempty"`
	VotePricePct      int64  `json:"votePricePct,omitempty"`
	Name              string `json:"name"`
	Players           int    `json:"players"`
	Days              int    `json:"days"`
	DemandPerPlayer   int64  `json:"demandPerPlayer"`
	StopCompany       string `json:"stopCompany,omitempty"`
	ShockDay          int    `json:"shockDay,omitempty"`
	InputPricePct     int64  `json:"inputPricePct"`
	InitialPublicGold int64  `json:"initialPublicGold"`
}
type EconomySimulationReport struct {
	Scenario              EconomyScenario           `json:"scenario"`
	Companies             []CompanySimulationReport `json:"companies"`
	TerminalUnitsConsumed int64                     `json:"terminalUnitsConsumed"`
	LedgerChecks          int                       `json:"ledgerChecks"`
	MoneyIssued           int64                     `json:"moneyIssuedBasis"`
	MoneyHeld             int64                     `json:"moneyHeldBasis"`
	PublicCash            int64                     `json:"publicCashBasis"`
	Seed                  string                    `json:"seed"`
}
type CompanySimulationReport struct {
	ID          string `json:"id"`
	Batches     int64  `json:"batches"`
	Cash        int64  `json:"cashBasis"`
	Revenue     int64  `json:"revenueBasis"`
	Profit      int64  `json:"realizedProfitBasis"`
	UnsoldUnits int64  `json:"unsoldUnits"`
	State       string `json:"state"`
}

type ConsumableCostReport struct {
	Item       string `json:"item"`
	Name       string `json:"name"`
	Profession string `json:"profession"`
	BatchCost  int64  `json:"batchCostBasis"`
	Output     int64  `json:"outputUnits"`
	UnitCost   int64  `json:"unitCostBasis"`
	Seconds    int64  `json:"seconds"`
}

func referenceInputCost(needs map[string]int64) int64 {
	var cost int64
	for _, r := range ResourceCatalog {
		cost += needs[r.Key] * r.InitPriceBasis / ResourceScale
	}
	return cost
}

// This report values the catalog at explicit reference prices. These prices
// are calibration assumptions and do not create market quotes or cash.
func ConsumableCostReports() []ConsumableCostReport {
	out := []ConsumableCostReport{}
	for _, s := range ConsumableCatalog {
		cost := referenceInputCost(s.Inputs)
		out = append(out, ConsumableCostReport{s.Key, s.Name, s.Profession, cost, s.Output, (cost + s.Output - 1) / s.Output, s.Seconds})
	}
	return out
}

func RunEconomyScenario(cfg EconomyScenario) (EconomySimulationReport, error) {
	report := EconomySimulationReport{Scenario: cfg, Seed: "deterministic-v1"}
	if cfg.Players < 6 || cfg.Players > 200 || cfg.Days < 1 || cfg.Days > 30 || cfg.InputPricePct < 1 || cfg.InputPricePct > 1000 || cfg.InitialPublicGold < 4000 || cfg.InitialPublicGold > 1_000_000 || cfg.DemandPerPlayer < 0 || cfg.DemandPerPlayer > 100 {
		return report, ErrInvalidInput("仿真参数超出范围")
	}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(start)
	w.Players = map[string]*PlayerState{}
	for i := 0; i < cfg.Players; i++ {
		h := fmt.Sprintf("sim%03d", i)
		p := NewBlankPlayer(h, start)
		p.Profession = []string{ProfScientist, ProfAlchemist, ProfMage, ProfArtisan}[i%4]
		w.Players[h] = p
	}
	apply := func(p MonetaryPolicy) error { return ApplyMonetaryPolicy(w, p, start) }
	if err := apply(MonetaryPolicy{ID: "sim-issue", Action: "issue", Amount: cfg.InitialPublicGold * GoldScale}); err != nil {
		return report, err
	}
	if err := apply(MonetaryPolicy{ID: "sim-budget", Action: "fund_public", Amount: cfg.InitialPublicGold * GoldScale}); err != nil {
		return report, err
	}
	// Startup cash is earned by a finite, planner-funded public purchase. Initial
	// stock represents saved gathering output, not an unrecorded Gold grant.
	perPlayer := cfg.InitialPublicGold / int64(cfg.Players)
	for i, h := range sortedKeys(w.Players) {
		p := w.Players[h]
		p.ResourcesMilli[ResWater] = perPlayer * 1000
		if err := PlaceMarketOrder(w, p, ResWater, "ASK", GoldScale, perPlayer*1000, start); err != nil {
			return report, err
		}
		if err := apply(MonetaryPolicy{ID: fmt.Sprintf("sim-public-%03d", i), Action: "procure", Item: ResWater, Price: GoldScale, Quantity: perPlayer * 1000}); err != nil {
			return report, err
		}
	}
	// 100,000 shares at 0.05 Gold => 5,000 Gold working capital per company.
	// Stressed low-liquidity runs deliberately permit failed IPOs and refunds.
	for _, s := range CompanyCatalog {
		if err := IntroduceCompany(w, s.ID, 100000, 500, 50000, start.Add(time.Hour), start); err != nil {
			return report, err
		}
		for _, h := range sortedKeys(w.Players) {
			p := w.Players[h]
			n := min(int64(100000/cfg.Players), p.GoldBasis/500)
			if n > 0 {
				if err := SubscribeIPO(w, p, s.ID, n, start); err != nil {
					return report, err
				}
			}
		}
	}
	prices := map[string]int64{}
	for _, r := range ResourceCatalog {
		prices[r.Key] = r.InitPriceBasis * cfg.InputPricePct / 100
	}
	for hour := 0; hour < cfg.Days*24; hour++ {
		now := start.Add(time.Duration(hour) * time.Hour)
		for _, p := range w.Players {
			p.LastSettledAt = now.Add(time.Hour)
		}
		// The supply ceiling is explicit: each actor brings at most these units
		// per hour, preserving all previous stock, asks and cash between steps.
		for _, h := range sortedKeys(w.Players) {
			p := w.Players[h]
			for _, k := range []string{ResWater, ResWood, ResStone, ResCharcoal, ResIronIngot, ResFlint} {
				p.ResourcesMilli[k] += 20 * 1000
				if p.FrozenResourcesMilli[k] < 100*1000 {
					q := min(int64(100*1000)-p.FrozenResourcesMilli[k], p.ResourcesMilli[k])
					if q >= 1000 {
						if err := PlaceMarketOrder(w, p, k, "ASK", prices[k], q/1000*1000, now); err != nil {
							return report, err
						}
					}
				}
			}
		}
		if cfg.StopCompany != "" && hour >= cfg.ShockDay*24 {
			if c := w.Economy.Companies[cfg.StopCompany]; c != nil && c.Status == "listed" {
				c.Plan.ActiveLines = 0
			}
		}
		// When a branch is stopped, its downstream shareholder policy selects the
		// published alternative route. No input or company output is injected.
		if cfg.StopCompany != "" && hour >= cfg.ShockDay*24 {
			for _, s := range CompanyCatalog {
				c := w.Economy.Companies[s.ID]
				if c == nil || len(s.Recipes) < 2 {
					continue
				}
				stopped, _ := FindCompanySpec(cfg.StopCompany)
				if s.Recipes[0].Inputs[stopped.Output] > 0 {
					c.Plan.Route = "alternative"
					c.Plan.AskPrice = s.ReferencePrice * 150 / 100
					c.Plan.InputBudget = c.Plan.AskPrice * s.OutputUnits * 90 / 100
				}
			}
		}
		if hour == 7*24+1 && (cfg.Pack != "" || cfg.VotePricePct > 0) {
			for _, id := range sortedKeys(w.Economy.Companies) {
				c := w.Economy.Companies[id]
				if c.Status != "listed" {
					continue
				}
				plan := c.Plan
				plan.Pack = cfg.Pack
				if cfg.VotePricePct > 0 {
					plan.AskPrice = plan.AskPrice * cfg.VotePricePct / 100
					plan.InputBudget = plan.InputBudget * cfg.VotePricePct / 100
				}
				owner := w.Players[sortedKeys(c.Subscriptions)[0]]
				if err := OpenCompanyVote(w, owner, id, plan, now); err != nil {
					return report, err
				}
				for _, h := range sortedKeys(c.Vote.Weights) {
					if err := VoteCompany(w, w.Players[h], id, c.Vote.ID, true, now); err != nil {
						return report, err
					}
				}
			}
		}
		if err := AdvanceEconomy(w, now.Add(time.Hour)); err != nil {
			return report, err
		}
		if hour%24 == 1 && (cfg.ShockDay == 0 || cfg.StopCompany != "" || hour < cfg.ShockDay*24) {
			for _, h := range sortedKeys(w.Players) {
				p := w.Players[h]
				for _, o := range append([]MarketOrder{}, w.Orders...) {
					if o.MakerHandle == h && o.Status == "OPEN" && o.Side == "BID" {
						if err := CancelMarketOrder(w, p, o.ID, now); err != nil {
							return report, err
						}
					}
				}
				for _, k := range []string{ResHeavyPack, ResPrecisionPack} {
					n := cfg.DemandPerPlayer
					if n == 0 {
						continue
					}
					price := int64(0)
					for _, spec := range CompanyCatalog {
						if spec.Output == k {
							price = spec.ReferencePrice
							if cfg.VotePricePct > 0 && hour >= 8*24+1 {
								price = price * cfg.VotePricePct / 100
							}
						}
					}
					n = min(n, p.GoldBasis/price)
					if n == 0 {
						continue
					}
					if err := PlaceMarketOrder(w, p, k, "BID", price, n*1000, now.Add(time.Hour)); err != nil {
						return report, err
					}
					consumed := p.ResourcesMilli[k] / 1000
					p.ResourcesMilli[k] -= consumed * 1000
					report.TerminalUnitsConsumed += consumed

				}
			}
		}
		for _, p := range w.Players {
			for _, k := range []string{ResHeavyPack, ResPrecisionPack} {
				n := p.ResourcesMilli[k] / 1000
				p.ResourcesMilli[k] -= n * 1000
				report.TerminalUnitsConsumed += n
			}
		}
		if err := CheckEconomy(w); err != nil {
			return report, fmt.Errorf("hour %d: %w", hour, err)
		}
		report.LedgerChecks++
		w.PendingEconomyRecords = nil
		w.PendingTrades = nil // the server persists these into its append-only audit table
	}
	for _, s := range CompanyCatalog {
		c := w.Economy.Companies[s.ID]
		report.Companies = append(report.Companies, CompanySimulationReport{ID: s.ID, Batches: c.CompletedBatches, Cash: c.Wallet.Cash, Revenue: c.Revenue, Profit: c.RealizedProfit, UnsoldUnits: (c.Wallet.Stock[s.Output] + c.Wallet.Frozen[s.Output]) / 1000, State: c.Status + ": " + c.StatusReason})
	}
	report.MoneyIssued = w.TotalIssuedBasis
	report.MoneyHeld = MoneyHoldings(w)
	report.PublicCash = w.Economy.Public.Cash + w.Economy.Public.Escrow
	return report, nil
}
