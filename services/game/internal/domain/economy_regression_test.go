package domain

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestSeasonalShareBidKeepsPortfolioAccessibleAfterSellingLastShare(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	RolloverSeason(w, "S2", now.Add(30*24*time.Hour))
	now = now.Add(30 * 24 * time.Hour)
	q := NewBlankPlayer("share-buyer", now)
	q.Profession = ProfMage
	w.Players[q.Handle] = q
	fundPlayerByProcurement(t, w, q, 1000*GoldScale, now)
	key := ShareKey(c.ID)
	mustEconomy(t, PlaceMarketOrder(w, p, key, "BID", 500, 1000, now))
	bidID := w.Orders[0].ID
	mustEconomy(t, PlaceMarketOrder(w, p, key, "ASK", 1000, c.Shares*ResourceScale, now))
	mustEconomy(t, PlaceMarketOrder(w, q, key, "BID", 1000, c.Shares*ResourceScale, now))
	if p.Profession != ProfNone || p.ResourcesMilli[key] != 0 || p.FrozenResourcesMilli[key] != 0 || p.GoldFrozenBasis != 500 {
		t.Fatal("fixture must retain only an open share bid after the season")
	}
	if !HasFinancialPosition(w, p) {
		t.Fatal("open share bid hid the retained portfolio and cancellation controls")
	}
	mustEconomy(t, PlaceMarketOrder(w, p, key, "BID", 400, 1000, now))
	secondBidID := w.Orders[0].ID
	mustEconomy(t, CancelMarketOrder(w, p, bidID, now))
	if !HasFinancialPosition(w, p) {
		t.Fatal("remaining share bid lost its management access")
	}
	mustEconomy(t, CancelMarketOrder(w, p, secondBidID, now))
	mustEconomy(t, PlaceMarketOrder(w, q, key, "BID", 400, 1000, now))
	if HasFinancialPosition(w, p) || p.GoldFrozenBasis != 0 {
		t.Fatal("cancelled or another player's orders kept financial access or frozen cash")
	}
	mustEconomy(t, CheckEconomy(w))
}

func TestCompanyExpansionBudgetCanBeReducedAndCancelled(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	// Existing cash transfer is test financing, not an issuance or live API.
	c.Wallet.Cash += 500 * GoldScale
	p.GoldBasis -= 500 * GoldScale
	approve := func(plan CompanyPlan) {
		t.Helper()
		at := c.NextVoteAt
		mustEconomy(t, OpenCompanyVote(w, p, c.ID, plan, at))
		mustEconomy(t, VoteCompany(w, p, c.ID, c.Vote.ID, true, at))
		settleCompanyVote(w, c, c.Vote.Ends)
	}
	plan := c.Plan
	plan.InputBudget = GoldScale
	plan.ActiveLines = 0
	plan.ExpandWith = ResHeavyPack
	plan.CapitalBudget = 100 * GoldScale
	approve(plan)
	if c.Expansion == nil {
		t.Fatal(c.Vote.Result)
	}
	plan.CapitalBudget = 50 * GoldScale
	approve(plan)
	if c.Expansion == nil || c.Expansion.Budget != 50*GoldScale {
		t.Fatal("budget was not replaced")
	}
	plan.ExpandWith = "cancel"
	plan.CapitalBudget = 0
	approve(plan)
	if c.Expansion != nil || c.Lines != 1 {
		t.Fatal("cancelled project built a line")
	}
	mustEconomy(t, CheckEconomy(w))
}

func TestCompanyPackAmortizationAndStockCeiling(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	s, _ := FindCompanySpec(c.ID)
	for k, n := range s.Recipes[0].Inputs {
		c.Wallet.Stock[k] = n * 6
		c.StockCost[k] = n * 6 / 1000 * GoldScale
	}
	c.Plan.InputBudget = 1000 * GoldScale
	c.Plan.AskPrice = 1000 * GoldScale
	c.Plan.Pack = ResPrecisionPack
	c.Wallet.Stock[ResPrecisionPack] = 1000
	c.StockCost[ResPrecisionPack] = 5 * GoldScale
	before := c.Wallet.Stock[ResIronIngot]
	for i := 0; i < 5; i++ {
		mustEconomy(t, operateCompany(w, c, now))
		if len(c.Batches) != 1 {
			t.Fatal(c.StatusReason)
		}
		if c.Batches[0].Cost != 172*GoldScale {
			t.Fatalf("prepaid pack not amortized: %d", c.Batches[0].Cost)
		}
		completeCompanyBatches(c, now.Add(time.Hour))
		// Simulate end use of paid output. No cash/revenue is manufactured here.
		consumeCompanyStock(c, map[string]int64{s.Output: 10000})
	}
	if c.PackCharges[0] != 0 || c.PackCosts[0] != 0 || before-c.Wallet.Stock[ResIronIngot] != 180000 {
		t.Fatal("pack charge count or savings incorrect")
	}
	c.Wallet.Stock[s.Output] = 15000
	c.Plan.Pack = ""
	mustEconomy(t, operateCompany(w, c, now))
	if len(c.Batches) != 0 {
		t.Fatal("whole batch would exceed two-batch inventory ceiling")
	}
	mustEconomy(t, CheckEconomy(w))
}

func TestFullOrderBookDoesNotBlockAutomaticEconomyOrCancellation(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	c.Wallet.Stock[ResConductiveAlloy] = 1000
	// Stress fixture reaches the global limit using real inventory escrow.
	p.ResourcesMilli[ResWood] = 0
	p.FrozenResourcesMilli[ResWood] = 10_000_000
	for i := 0; i < 10000; i++ {
		w.NextOrderSeq++
		w.Orders = append(w.Orders, MarketOrder{ID: "full-" + time.Unix(int64(i), 0).String(), MakerHandle: p.Handle, ItemKey: ResWood, Side: "ASK", Status: "OPEN", PriceBasis: GoldScale, QuantityMilli: 1000, RemainingMilli: 1000})
	}
	mustEconomy(t, offerCompanyOutput(w, c, now))
	if c.Wallet.Stock[ResConductiveAlloy] != 1000 {
		t.Fatal("full book consumed output")
	}
	mustEconomy(t, CancelMarketOrder(w, p, w.Orders[len(w.Orders)-1].ID, now))
	mustEconomy(t, CheckEconomy(w))
}

func TestEconomyDetectsOffsettingLedgerCorruption(t *testing.T) {
	w, p, _ := fundedEconomy(t)
	p.GoldFrozenBasis += 10
	p.GoldBasis -= 10
	if CheckEconomy(w) == nil {
		t.Fatal("identity alone hid escrow corruption")
	}
	p.GoldFrozenBasis -= 10
	p.GoldBasis += 10
	p.ResourcesMilli[ResWood] = -1
	if CheckEconomy(w) == nil {
		t.Fatal("negative physical inventory accepted")
	}
}

func TestCraftableRaidConsumablesRetryAndFailureAreSafe(t *testing.T) {
	for _, key := range []string{ResRecovery, ResDetector, ResBreach, ResBlink} {
		t.Run(key, func(t *testing.T) {
			p, now := regressionRaid(t)
			s := p.RaidLoadout.ActiveSession
			z := &s.Zones[0]
			p.ResourcesMilli[key] = 2000
			s.HP = 1
			s.LastMoveAt = now.Add(-time.Second)
			z.Tiles[s.PlayerY*z.Width+s.PlayerX].Kind = "chest_abyss"
			s.ChannelReadyAt = now.Add(10 * time.Second)
			for step := int32(1); step <= 2; step++ {
				idx := s.PlayerY*z.Width + s.PlayerX + step
				z.Tiles[idx].Kind = "floor"
				z.Tiles[idx].Explored = true
			}
			expires := s.ExpiresAt
			oldX := s.PlayerX
			cmd := RaidCommand{Action: "use_consumable", ItemKey: key, DX: 2}
			mustEconomy(t, ApplyRaidCommand(p, s.RaidID, 1, cmd, now))
			mustEconomy(t, ApplyRaidCommand(p, s.RaidID, 1, cmd, now))
			if p.ResourcesMilli[key] != 1000 || s.ExpiresAt != expires {
				t.Fatal("retry consumed twice or extended sandstorm")
			}
			if ApplyRaidCommand(p, s.RaidID, 2, cmd, now.Add(time.Second)) == nil {
				t.Fatal("same consumable used twice in one raid")
			}
			if key == ResRecovery && s.HP != 31 {
				t.Fatal("incorrect healing")
			}
			if key == ResBreach && s.ChannelReadyAt != now.Add(6*time.Second) {
				t.Fatal("channel reduction incorrect")
			}
			if key == ResBlink && s.PlayerX != oldX+2 {
				t.Fatal("blink failed")
			}
		})
	}
	p, now := regressionRaid(t)
	p.ResourcesMilli[ResRecovery] = 1000
	if useRaidConsumable(p, ResRecovery, 0, 0, now) == nil || p.ResourcesMilli[ResRecovery] != 1000 {
		t.Fatal("full-health failure consumed item")
	}
	p.ResourcesMilli[ResBlink] = 1000
	if useRaidConsumable(p, ResBlink, 1, 1, now) == nil || p.ResourcesMilli[ResBlink] != 1000 {
		t.Fatal("unsafe blink consumed item")
	}
}

func TestConstructionAndGuildConsumablesConsumeOnceOnSuccess(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	p.Professional = &ProfessionalState{}
	p.ResourcesMilli[ResFineTool] = 1000
	mustEconomy(t, UseConsumable(w, p, ResFineTool, "", now))
	b, _ := FindBuilding(BuildingHouse)
	costs, _ := BuildingCosts(b, p.BuildingCounts[BuildingHouse], 1)
	for k := range costs {
		p.ResourcesMilli[k] = 0
	}
	if ConstructBuilding(p, BuildingHouse, 1, 1, now) == nil || !p.Professional.ConstructionTool {
		t.Fatal("failed construction spent tool")
	}
	for k, n := range costs {
		p.ResourcesMilli[k] = (n*9 + 9) / 10
	}
	mustEconomy(t, ConstructBuilding(p, BuildingHouse, 1, 1, now))
	mustEconomy(t, ConstructBuilding(p, BuildingHouse, 1, 1, now))
	if p.Professional.ConstructionTool {
		t.Fatal("tool reused after success")
	}
	for k := range costs {
		if p.ResourcesMilli[k] != 0 {
			t.Fatal("construction discount incorrect")
		}
	}
	p.ResourcesMilli[ResFortification] = 1000
	mustEconomy(t, UseConsumable(w, p, ResFortification, "", now))
	p.ResourcesMilli[ResWater] = MacroBalance.GuildDonateWaterCostMilli * 92 / 100
	p.ResourcesMilli[ResWood] = MacroBalance.GuildDonateWoodCostMilli * 92 / 100
	p.ResourcesMilli[ResStone] = MacroBalance.GuildDonateStoneCostMilli * 92 / 100
	mustEconomy(t, PerformGuildAction(w, p, "donate_supplies", "", "", "", "", "", now))
	if p.Professional.GuildTool || p.ResourcesMilli[ResWater] != 0 || p.ResourcesMilli[ResWood] != 0 {
		t.Fatal("guild discount incorrect")
	}
}

func TestWarConsumablesRequireOwnDeploymentAndClearAtSettlement(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	n := &w.WarNodes[0]
	n.OwnerGuild = p.GuildCode
	n.PlayerDeployed = map[string]Troops{p.Handle: {Infantry: 20}}
	n.ObsidianTroops = Troops{Infantry: 100}
	n.ArgentTroops = Troops{Cavalry: 50}
	for _, key := range []string{ResMedic, ResWard, ResCalibration} {
		p.ResourcesMilli[key] = 2000
		if UseConsumable(w, p, key, "missing", now) == nil {
			t.Fatal("off-node support accepted")
		}
		mustEconomy(t, UseConsumable(w, p, key, n.NodeID, now))
		if UseConsumable(w, p, key, n.NodeID, now) == nil || p.ResourcesMilli[key] != 1000 {
			t.Fatal("war support stacked")
		}
	}
	if EffectiveNodeDefenseBonus(*n) != n.DefenseBonusPct+8 || !strings.Contains(WarConsumableSummary(*n), "守城结界") {
		t.Fatal("active war support not reflected in node preview")
	}
	raw, _ := json.Marshal(w)
	var baseline WorldState
	mustEconomy(t, json.Unmarshal(raw, &baseline))
	baseline.WarNodes[0].Consumables = nil
	SettleWarDay(&baseline, baseline.Players[p.Handle], now.Add(24*time.Hour))
	SettleWarDay(w, p, now.Add(24*time.Hour))
	if w.WarNodes[0].Consumables != nil {
		t.Fatal("war consumable persisted into next round")
	}
	if w.WarNodes[0].ObsidianTroops.Total() <= baseline.WarNodes[0].ObsidianTroops.Total() {
		t.Fatal("medical effect did not reduce losses")
	}
	report := w.WarHistory[0].NodeReports[0].CasualtySummary
	if !strings.Contains(report, "+33%") || !strings.Contains(report, "守军战损 15%") {
		t.Fatalf("battle report ignored actual support effects: %s", report)
	}
	if computeCalibratedPower(Troops{Infantry: 10}, Troops{Cavalry: 10}, 0, true) <= ComputeWeightedPower(Troops{Infantry: 10}, Troops{Cavalry: 10}, 0) {
		t.Fatal("calibration did not reduce counter penalty")
	}
}

func TestSmallEconomySimulationConservesMoneyAndProduces(t *testing.T) {
	r, err := RunEconomyScenario(EconomyScenario{Name: "regression", Players: 12, Days: 2, DemandPerPlayer: 2, InputPricePct: 100, InitialPublicGold: 100000})
	mustEconomy(t, err)
	if r.LedgerChecks != 48 || r.MoneyHeld != r.MoneyIssued || r.TerminalUnitsConsumed == 0 {
		t.Fatalf("simulation failed: %+v", r)
	}
	for _, c := range r.Companies {
		if c.Cash < 0 || c.Batches == 0 {
			t.Fatalf("stalled company: %+v", c)
		}
	}
}

func TestFortificationValueIsBelowItsActualMaterialSaving(t *testing.T) {
	w := NewDefaultWorld(time.Now())
	p := w.Players["archon_demo"]
	for _, r := range ResourceCatalog {
		p.ResourcesMilli[r.Key] = 1_000_000
	}
	p.ResourcesMilli[ResFortification] = 1000
	before := referenceInputCost(p.ResourcesMilli)
	mustEconomy(t, UseConsumable(w, p, ResFortification, "", time.Now()))
	// Exclude the used item when valuing saved raw materials.
	before -= referenceInputCost(map[string]int64{ResFortification: 1000})
	mustEconomy(t, PerformGuildAction(w, p, "donate_supplies", "", "", "", "", "", time.Now()))
	discounted := before - referenceInputCost(p.ResourcesMilli)
	normal := referenceInputCost(map[string]int64{ResWater: MacroBalance.GuildDonateWaterCostMilli, ResWood: MacroBalance.GuildDonateWoodCostMilli, ResStone: MacroBalance.GuildDonateStoneCostMilli})
	s, _ := FindConsumable(ResFortification)
	unit := referenceInputCost(s.Inputs) / s.Output
	if unit >= normal-discounted {
		t.Fatalf("worthless logistics item: cost=%d saving=%d", unit, normal-discounted)
	}
}

func TestSigilChangesQuarryOutputAndPausesWithoutWorkers(t *testing.T) {
	w := NewDefaultWorld(time.Now())
	p := w.Players["archon_demo"]
	baseline, _, _ := ComputeResourceFlows(p)
	p.ResourcesMilli[ResSigil] = 1000
	mustEconomy(t, UseConsumable(w, p, ResSigil, "", time.Now()))
	boosted, _, _ := ComputeResourceFlows(p)
	if boosted[ResStone] >= baseline[ResStone] || boosted[ResAncientShard] <= baseline[ResAncientShard] {
		t.Fatal("sigil did not exchange stone output for byproducts")
	}
	p.Workers[JobStone] = 0
	AdvancePlayerSeconds(p, 30)
	if p.Professional.SigilSeconds != 600 {
		t.Fatal("sigil drained while quarry was idle")
	}
	p.Workers[JobStone] = 1
	AdvancePlayerSeconds(p, 30)
	if p.Professional.SigilSeconds != 570 {
		t.Fatal("sigil did not count actual quarry seconds")
	}
}
