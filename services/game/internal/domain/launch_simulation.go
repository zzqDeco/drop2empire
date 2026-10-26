package domain

import (
	"fmt"
	"time"
)

// This replay supplies decisions and explicit limit prices, not resources,
// guaranteed sales or fictional consumption. All stock comes from live jobs.
type LaunchPlayerReport struct {
	Profession               string           `json:"profession"`
	OpeningSeconds           int64            `json:"openingSeconds"`
	FacilitySeconds          int64            `json:"facilitySeconds"`
	FirstCraftSeconds        int64            `json:"firstCraftSeconds"`
	FirstSaleSeconds         int64            `json:"firstSaleSeconds"`
	UpgradeSeconds           int64            `json:"upgradeSeconds"`
	ProductionUseSeconds     int64            `json:"productionUseSeconds"`
	CrossProfessionPurchases int64            `json:"crossProfessionPurchases"`
	Crafted                  map[string]int64 `json:"craftedUnits"`
	GoldBasis                int64            `json:"goldBasis"`
	Blocker                  string           `json:"blocker,omitempty"`
}
type LaunchSimulationReport struct {
	Hours                 int                       `json:"hours"`
	Players               []LaunchPlayerReport      `json:"players"`
	Companies             []CompanySimulationReport `json:"companies"`
	TerminalPacksConsumed int64                     `json:"terminalPacksConsumed"`
	LedgerChecks          int                       `json:"ledgerChecks"`
	IssuedBasis           int64                     `json:"issuedBasis"`
	HoldingsBasis         int64                     `json:"holdingsBasis"`
	Assumptions           []string                  `json:"assumptions"`
}

func RunLaunchProgression() (LaunchSimulationReport, error) {
	report := LaunchSimulationReport{Hours: 12, Assumptions: []string{
		"Four deterministic operators, one per profession; not a forecast of human behaviour.",
		"Ten opening water clicks, then actual production, storage, construction and manufacturing commands; no injected stocks or starter grants.",
		"One finite 8000 Gold issue and public procurement of real surplus at catalog reference prices; no further funding or guaranteed company sales.",
		"Companies introduced in three pairs after upstream output and saved cash exist; 1000 shares at 0.5 Gold, one-hour subscription, full subscription required.",
		"Terminal demand is four workpacks per actual facility upgrade; demand ends when all four facilities are upgraded.",
	}}
	start := time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(start)
	professions := []string{ProfScientist, ProfAlchemist, ProfMage, ProfArtisan}
	opening := int64(0)
	for _, prof := range professions {
		r, fixture := simulateSettlementOpening("expansion", "扩张经营", 12, false)
		if !r.Completed {
			return report, fmt.Errorf("opening: %s", r.FailureReason)
		}
		p := fixture.Players["pioneer"]
		p.Handle, p.ID = prof, "replay_"+prof
		opening = int64(r.TotalSeconds)
		if err := ChooseProfession(p, prof, start.Add(time.Duration(opening)*time.Second)); err != nil {
			return report, err
		}
		w.Players[prof] = p
		report.Players = append(report.Players, LaunchPlayerReport{Profession: prof, OpeningSeconds: opening, Crafted: map[string]int64{}})
	}
	at := start.Add(time.Duration(opening) * time.Second)
	w.Economy.LastTick = at.Truncate(time.Minute)
	policies := []MonetaryPolicy{{ID: "launch-issue", Action: "issue", Amount: 8000 * GoldScale}, {ID: "launch-budget", Action: "fund_public", Amount: 8000 * GoldScale}}
	for _, x := range []struct {
		key   string
		units int64
	}{{ResWater, 8000}, {ResWood, 4000}, {ResStone, 2000}, {ResCharcoal, 1000}, {ResIronIngot, 500}, {ResFlint, 250}} {
		policies = append(policies, MonetaryPolicy{ID: "launch-buy-" + x.key, Action: "procure", Item: x.key, Price: launchPrice(x.key), Quantity: x.units * 1000})
	}
	for _, policy := range policies {
		if err := ApplyMonetaryPolicy(w, policy, at); err != nil {
			return report, err
		}
	}
	pairs := [][]string{{"alloy", "crystal"}, {"heavy", "control"}, {"works", "precision"}}
	introduced := 0
	boostedQueued := map[string]bool{}
	for sec := opening; sec <= int64(report.Hours)*3600; sec += 10 {
		at = start.Add(time.Duration(sec) * time.Second)
		for i, prof := range professions {
			p := w.Players[prof]
			r := &report.Players[i]
			ps := EnsureProfessional(p)
			if ps.Queue != nil && ps.Queue.RemainingSeconds <= 10 {
				r.Crafted[ps.Queue.Item] += ps.Queue.Output / 1000
				if r.FirstCraftSeconds == 0 {
					r.FirstCraftSeconds = sec + ps.Queue.RemainingSeconds
				}
			}
			// The same 12 workers cover every input; no unlimited hiring/slots.
			if err := AllocateWorkers(p, "manual", map[string]int32{JobWater: 2, JobWood: 3, JobCharcoal: 1, JobStone: 3, JobSmeltIron: 2, JobPrepRation: 1}, "", at); err != nil {
				return report, err
			}
			AdvancePlayerSeconds(p, 10)
			p.LastSettledAt = at.Add(10 * time.Second)
			if ps.Level == 0 {
				if err := BuildProfessionFacility(p, "", at); err == nil {
					r.FacilitySeconds = sec
				} else {
					r.Blocker = err.Error()
				}
			}
			if ps.Level > 0 && ps.Queue == nil {
				for _, s := range ConsumableCatalog {
					if s.Profession == prof && r.Crafted[s.Key] == 0 {
						if err := QueueProfessionalCraft(p, s.Key, 1, at); err != nil {
							r.Blocker = err.Error()
						}
						break
					}
				}
			}
			// Paid warehouse expansions make the next facility costs reachable.
			if ps.Level == 1 && len(r.Crafted) == 3 {
				for _, key := range []string{BPWaterCistern, BPLumberYard} {
					target := int32(1)
					if key == BPWaterCistern {
						target = 3
					}
					if p.BuildingCounts[key] < target {
						_ = ConstructBuilding(p, key, 1, p.SettlementCommandSeq+1, at)
					}
				}
			}
			if sec%60 == 0 {
				// A real cross-profession trade funds the maker. The purchased
				// catalyst is consumed by five actual, paid batches, not deleted
				// by an assumed daily demand schedule.
				if prof == ProfAlchemist && p.ResourcesMilli[ResCatalyst] > 1000 && p.FrozenResourcesMilli[ResCatalyst] == 0 {
					if err := PlaceMarketOrder(w, p, ResCatalyst, "ASK", launchPrice(ResCatalyst), p.ResourcesMilli[ResCatalyst]-1000, at); err != nil {
						return report, err
					}
				}
				if ps.Level > 0 && len(r.Crafted) == 3 && ps.Queue == nil && r.ProductionUseSeconds == 0 {
					if p.ResourcesMilli[ResCatalyst] == 0 && p.GoldBasis >= launchPrice(ResCatalyst) {
						for _, o := range w.Orders {
							if o.ItemKey == ResCatalyst && o.Side == "ASK" && o.Status == "OPEN" && o.MakerHandle != p.Handle && o.PriceBasis <= launchPrice(ResCatalyst) {
								if err := PlaceMarketOrder(w, p, ResCatalyst, "BID", launchPrice(ResCatalyst), 1000, at); err != nil {
									return report, err
								}
								r.CrossProfessionPurchases++
								break
							}
						}
					}
					if p.ResourcesMilli[ResCatalyst] > 0 {
						if err := UseConsumable(w, p, ResCatalyst, "", at); err != nil {
							return report, err
						}
						r.ProductionUseSeconds = sec
					}
				}
				if r.ProductionUseSeconds > 0 && !boostedQueued[prof] && ps.Queue == nil {
					key := map[string]string{ProfScientist: ResCalibration, ProfAlchemist: ResMedic, ProfMage: ResWard, ProfArtisan: ResFortification}[prof]
					if QueueProfessionalCraft(p, key, 5, at) == nil {
						boostedQueued[prof] = true
					}
				}
				reserve := ProfessionFacilityCosts(0, "")
				if ps.Level > 0 {
					reserve = ProfessionFacilityCosts(1, "")
				}
				for _, key := range []string{ResWater, ResWood, ResStone, ResCharcoal, ResIronIngot, ResFlint} {
					// Keep a reachable personal buffer; sell up to 100 real units per minute.
					keep := min(reserve[key], ResourceCapacityMilli(p, key)/2)
					qty := min(int64(100000)-p.FrozenResourcesMilli[key], p.ResourcesMilli[key]-keep) / 1000 * 1000
					if qty >= 1000 {
						if err := PlaceMarketOrder(w, p, key, "ASK", launchPrice(key), qty, at); err != nil {
							return report, err
						}
					}
				}
				if p.GoldBasis > 0 && r.FirstSaleSeconds == 0 {
					r.FirstSaleSeconds = sec
				}
				pack := ResHeavyPack
				if i%2 == 1 {
					pack = ResPrecisionPack
				}
				if ps.Level == 1 && len(r.Crafted) == 3 && p.ResourcesMilli[pack]+p.FrozenResourcesMilli[pack] < 4000 && p.GoldBasis >= launchPrice(pack)*4 {
					pending := false
					for _, o := range w.Orders {
						if o.MakerHandle == p.Handle && o.ItemKey == pack && o.Side == "BID" && o.Status == "OPEN" {
							pending = true
						}
					}
					if !pending {
						if err := PlaceMarketOrder(w, p, pack, "BID", launchPrice(pack), 4000-p.ResourcesMilli[pack], at); err != nil {
							return report, err
						}
					}
				}
				if ps.Level == 1 && p.ResourcesMilli[pack] >= 4000 {
					if err := BuildProfessionFacility(p, pack, at); err == nil {
						r.UpgradeSeconds = sec
						report.TerminalPacksConsumed += 4
						r.Blocker = ""
					} else {
						r.Blocker = err.Error()
					}
				}
			}
		}
		if sec%60 != 0 {
			continue
		}
		if err := AdvanceEconomy(w, at); err != nil {
			return report, err
		}
		if introduced < len(pairs) {
			ready := true
			for _, prof := range professions {
				if w.Players[prof].GoldBasis < 450*GoldScale {
					ready = false
				}
			}
			if introduced > 0 {
				for _, id := range pairs[introduced-1] {
					if w.Economy.Companies[id].CompletedBatches == 0 {
						ready = false
					}
				}
			}
			if ready {
				for _, id := range pairs[introduced] {
					if err := IntroduceCompany(w, id, 1000, 5000, 1000, at.Add(time.Hour), at); err != nil {
						return report, err
					}
					for _, prof := range professions {
						if err := SubscribeIPO(w, w.Players[prof], id, 250, at); err != nil {
							return report, err
						}
					}
				}
				introduced++
			}
		}
		if err := CheckEconomy(w); err != nil {
			return report, err
		}
		report.LedgerChecks++
	}
	for i, prof := range professions {
		report.Players[i].GoldBasis = w.Players[prof].GoldBasis
	}
	for _, id := range sortedKeys(w.Economy.Companies) {
		c := w.Economy.Companies[id]
		s, _ := FindCompanySpec(id)
		report.Companies = append(report.Companies, CompanySimulationReport{ID: id, Batches: c.CompletedBatches, Cash: c.Wallet.Cash, Revenue: c.Revenue, Profit: c.RealizedProfit, UnsoldUnits: (c.Wallet.Stock[s.Output] + c.Wallet.Frozen[s.Output]) / 1000, State: c.StatusReason})
	}
	report.IssuedBasis = w.TotalIssuedBasis
	report.HoldingsBasis = MoneyHoldings(w)
	return report, nil
}

func launchPrice(key string) int64 {
	for _, r := range ResourceCatalog {
		if r.Key == key {
			return r.InitPriceBasis
		}
	}
	return 0
}
