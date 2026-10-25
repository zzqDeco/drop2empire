package domain

import (
	"encoding/json"
	"math"
	"reflect"
	"testing"
	"time"
)

func constructionPlayer() *PlayerState {
	p := NewBlankPlayer("builder", time.Unix(1000, 0))
	p.PopulationTotal = 4
	p.Workers[JobWater] = 4
	p.ResourcesMilli[ResWater] = 200 * ResourceScale
	p.ResourcesMilli[ResWood] = 50 * ResourceScale
	return p
}

func TestResearchConstructionStaffingAndRetryAreSeparate(t *testing.T) {
	p := constructionPlayer()
	now := time.Unix(1000, 0)
	if err := ResearchTechnology(p, TechWoodworking, 1, now); err != nil {
		t.Fatal(err)
	}
	if p.UnlockedBlueprints[BPAxeBlueprint] || JobCapacity(p, JobWood) != 0 || ResourceCapacityMilli(p, ResWater) != 250*ResourceScale {
		t.Fatal("research supplied a building or capacity")
	}
	if err := AllocateWorkers(p, "delta", map[string]int32{JobWood: 1}, "", now); err == nil {
		t.Fatal("staffed unbuilt facility")
	}
	if err := ConstructBuilding(p, BuildingLumberCamp, 1, 2, now); err != nil {
		t.Fatal(err)
	}
	if p.Workers[JobWood] != 0 || JobCapacity(p, JobWood) != 3 {
		t.Fatal("construction should add empty job slots")
	}
	before, _ := json.Marshal(p)
	if err := ConstructBuilding(p, BuildingLumberCamp, 1, 2, now); err != nil {
		t.Fatal(err)
	}
	after, _ := json.Marshal(p)
	if string(before) != string(after) {
		t.Fatal("retry repeated construction or payment")
	}
	if err := ConstructBuilding(p, BuildingLumberCamp, 2, 2, now); err == nil {
		t.Fatal("accepted changed retry")
	}
	if err := ConstructBuilding(p, BuildingLumberCamp, 1, 3, now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResWood] != 27*ResourceScale || p.ResourcesMilli[ResWater] != 135*ResourceScale {
		t.Fatalf("second construction did not charge its own escalated price: %+v", p.ResourcesMilli)
	}
	if err := AllocateWorkers(p, "delta", map[string]int32{JobWood: 3}, "", now); err != nil {
		t.Fatal(err)
	}
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResWood] != 27*ResourceScale+1350 {
		t.Fatal("staffed output incorrect")
	}
	if err := UnlockBlueprint(NewDefaultWorld(now), p, BPWaterCistern, now); err == nil {
		t.Fatal("legacy unlock route bypassed construction")
	}
	ResetSettlementProgress(p)
	if err := ConstructBuilding(p, BuildingLumberCamp, 1, 3, now); err == nil {
		t.Fatal("pre-reset command replayed in a new season")
	}
}

func TestBuildingPriceBatchRoundingBoundsAndAtomicFailure(t *testing.T) {
	b, _ := FindBuilding(BuildingLumberCamp)
	cost, err := BuildingCosts(b, 2, 3)
	if err != nil || cost[ResWater] != 121*ResourceScale || cost[ResWood] != 61*ResourceScale {
		t.Fatalf("incorrect independently rounded batch: %+v %v", cost, err)
	}
	for _, quantity := range []int32{-1, 0, 21, math.MaxInt32} {
		if _, err := BuildingCosts(b, 0, quantity); err == nil {
			t.Fatalf("accepted quantity %d", quantity)
		}
	}
	if _, err := BuildingCosts(b, 128, 1); err == nil {
		t.Fatal("accepted count overflow")
	}
	p := constructionPlayer()
	p.ResearchedTechnologies[TechWoodworking] = true
	p.ResourcesMilli[ResWood] = 9 * ResourceScale
	before, _ := json.Marshal(p)
	if err := ConstructBuilding(p, BuildingLumberCamp, 1, 1, time.Now()); err == nil {
		t.Fatal("built without all materials")
	}
	after, _ := json.Marshal(p)
	if string(before) != string(after) {
		t.Fatal("failed construction mutated state")
	}
}

func TestHousingAllAllocationModesAndZeroStockRecovery(t *testing.T) {
	p := constructionPlayer()
	now := time.Now()
	if err := RecruitResident(p, 1, now); err == nil {
		t.Fatal("recruited past housing")
	}
	p.ResearchedTechnologies[TechWoodworking] = true
	if err := ConstructBuilding(p, BuildingHouse, 1, 1, now); err != nil {
		t.Fatal(err)
	}
	if err := RecruitResident(p, 2, now); err != nil {
		t.Fatal(err)
	}
	if p.PopulationTotal != 6 || HousingCapacity(p) != 8 {
		t.Fatal("housing expansion failed")
	}
	p.BuildingCounts[BuildingLumberCamp] = 1
	p.UnlockedBlueprints[BPAxeBlueprint] = true
	before, _ := json.Marshal(p.Workers)
	for _, input := range []struct {
		mode    string
		entries map[string]int32
	}{
		{"manual", map[string]int32{JobWood: 4}}, {"delta", map[string]int32{JobWood: 4}},
		{"manual", map[string]int32{"unknown": 1}}, {"delta", map[string]int32{JobForage: 2}},
		{"delta", map[string]int32{JobWater: -1, JobWood: math.MaxInt32}},
	} {
		if err := AllocateWorkers(p, input.mode, input.entries, "", now); err == nil {
			t.Fatal("accepted invalid allocation", input)
		}
		after, _ := json.Marshal(p.Workers)
		if string(before) != string(after) {
			t.Fatal("failed allocation partially moved workers")
		}
	}
	ApplyScaledPreset(p, map[string]int32{JobWood: 100, JobCharcoal: 100, JobForage: 100})
	if p.Workers[JobWood] > 3 || p.Workers[JobForage] > 1 || p.Workers[JobCharcoal] != 0 || AssignedPopulation(p) > p.PopulationTotal {
		t.Fatal("preset bypassed slots")
	}
	p.ResourcesMilli[ResWater] = 0
	p.ResourcesMilli[ResWood] = 0
	if err := AllocateWorkers(p, "water_focus", nil, "", now); err != nil {
		t.Fatal(err)
	}
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResWater] <= 0 {
		t.Fatal("cannot recover at zero stock")
	}
	if err := AllocateWorkers(p, "manual", map[string]int32{JobWater: 5, JobForage: 1}, "", now); err != nil {
		t.Fatal(err)
	}
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResWood] != 150 {
		t.Fatal("basic forage cannot bootstrap wood")
	}
}

func TestSiphonSluiceRationOrderAndForageEdictsAndGuideProgression(t *testing.T) {
	p := constructionPlayer()
	p.PopulationTotal = 4
	p.BuildingCounts[BPColonyEdicts] = 1
	p.BuildingCounts[BPWaterWheel1] = 1
	p.BuildingCounts[BPSiphonSluice] = 1
	p.UnlockedBlueprints[BPBasicWorkshop] = true
	p.UnlockedBlueprints[BPMysteryTreasure] = true
	EnsureSettlementState(p)

	// Before choosing a profession, guide points to "trade"
	if g := CurrentSettlementGuide(p); g.Code != "trade" {
		t.Fatalf("expected trade guide before profession choice, got %s", g.Code)
	}
	p.Profession = ProfAlchemist
	// After choosing a profession, guide transitions to "empire"
	if g := CurrentSettlementGuide(p); g.Code != "empire" {
		t.Fatalf("expected empire guide after profession choice, got %s", g.Code)
	}

	// A funded night shift boosts forage by +45%; zero-stock recovery is tested separately.
	p.Workers = map[string]int32{JobWater: 3, JobForage: 1}
	p.ResourcesMilli[ResWater] = 100 * ResourceScale
	p.ResourcesMilli[ResWood] = 10 * ResourceScale
	p.ActiveEdicts[EdictNightShift] = true
	gross, _, _ := ComputeResourceFlows(p)
	// Base forage is 150 milli/s; +45% = 217 milli/s
	if gross[ResWood] != 217 {
		t.Fatalf("expected night shift to boost forage to 217 milli/s, got %d", gross[ResWood])
	}

	// Siphon Sluice + JobPrepRation at full water cap: ComputeResourceFlows and AdvancePlayerSeconds must agree
	p.ActiveEdicts = map[string]bool{EdictSiphonSluice: true}
	p.Workers = map[string]int32{JobWater: 3, JobPrepRation: 1}
	p.ResourcesMilli[ResWater] = ResourceCapacityMilli(p, ResWater)
	p.ResourcesMilli[ResWood] = 10 * ResourceScale
	p.ResourcesMilli[ResStone] = 0
	p.ResourcesMilli[ResRation] = 0
	_, _, net := ComputeResourceFlows(p)
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResStone] != net[ResStone] || p.ResourcesMilli[ResRation] != net[ResRation] {
		t.Fatalf("siphon + ration mismatch between preview and simulation: stone=%d/%d ration=%d/%d",
			p.ResourcesMilli[ResStone], net[ResStone], p.ResourcesMilli[ResRation], net[ResRation])
	}
}

func TestParallelProjectsRewardOnceAndSeasonReset(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	p := w.Players["pioneer"]
	p.PopulationTotal = 4
	p.UnlockedBlueprints[BPBasicWorkshop] = true
	for _, key := range []string{ResWater, ResWood, ResStone, ResCharcoal} {
		p.ResourcesMilli[key] = 10000 * ResourceScale
	}
	if err := UnlockBlueprint(w, p, BPPartTablet, now); err != nil {
		t.Fatal("tablet should be buildable first", err)
	}
	if err := UnlockBlueprint(w, p, BPMysteryTreasure, now); err == nil {
		t.Fatal("graduated with missing parts")
	}
	for _, code := range []string{BPPartValve, BPPartFrame, BPMysteryTreasure} {
		if err := UnlockBlueprint(w, p, code, now); err != nil {
			t.Fatal(err)
		}
	}
	if p.GoldBasis != 500*GoldScale {
		t.Fatal("starter award missing")
	}
	assertMacroLedgerIdentity(t, w)
	if err := UnlockBlueprint(w, p, BPMysteryTreasure, now); err == nil {
		t.Fatal("reward replay accepted")
	}
	assertMacroLedgerIdentity(t, w)
	p.BuildingCounts[BuildingHouse] = 2
	p.ResearchedTechnologies[TechWoodworking] = true
	p.SettlementCommandSeq = 7
	p.ResourcesMilli[ResCosSteamCrown] = ResourceScale
	RolloverSeason(w, "test", now)
	if len(p.BuildingCounts) != 0 || len(p.ResearchedTechnologies) != 0 || HousingCapacity(p) != 4 || p.SettlementCommandSeq != 8 || p.ResourcesMilli[ResCosSteamCrown] != ResourceScale {
		t.Fatal("season reset/retention mismatch")
	}
	assertMacroLedgerIdentity(t, w)
}

func TestAllOpeningStrategiesPreserveLedgerAndNeedNoFurtherClicks(t *testing.T) {
	for _, st := range []struct {
		population int32
		explore    bool
	}{{12, false}, {8, false}, {12, true}} {
		run, w := simulateSettlementOpening("test", "test", st.population, st.explore)
		p := w.Players["pioneer"]
		if !run.Completed {
			t.Fatal(run.FailureReason)
		}
		if p.TotalManualClicks != 10 || p.GoldBasis != 500*GoldScale {
			t.Fatal("bootstrap used hidden clicks or rewards")
		}
		for _, v := range p.ResourcesMilli {
			if v < 0 {
				t.Fatal("negative resource")
			}
		}
		assertMacroLedgerIdentity(t, w)
		guide := CurrentSettlementGuide(p)
		ApplyFocusAllocation(p, JobWater)
		if !reflect.DeepEqual(guide, CurrentSettlementGuide(p)) {
			t.Fatal("moving workers regressed the chapter")
		}
		if st.explore && (p.RaidLoadout.LastSettlementReport == nil || p.RaidGearInventory["gear_wood_spear"] != 0) {
			t.Fatal("exploration strategy did not pay the actual loss")
		}
	}
}

func TestCaravanCannotIncreaseReferenceValueWithoutProduction(t *testing.T) {
	prices := map[string]int64{}
	for _, r := range ResourceCatalog {
		prices[r.Key] = r.InitPriceBasis
	}
	value := func(resources map[string]int64) int64 {
		var total int64
		for key, amount := range resources {
			total += prices[key] * amount
		}
		return total
	}
	// A strictly decreasing common value measure rules out any sequence of
	// immediate exchanges that returns all inputs plus extra tradable resources.
	for _, offer := range CaravanOfferCatalog {
		if offer.RewardPopulation > 0 {
			continue
		}
		if value(offer.RewardsMilli) >= value(offer.CostsMilli) {
			t.Fatalf("barter creates reference value: %s", offer.OfferCode)
		}
	}
	p := constructionPlayer()
	p.BuildingCounts[BuildingCaravan] = 1
	p.ResourcesMilli[ResFlint] = 5000
	RefreshSettlementDiscovery(p)
	before, _ := json.Marshal(p)
	if err := TradeCaravan(p, "offer_refugee_escort", time.Now()); err == nil {
		t.Fatal("caravan bypassed housing")
	}
	after, _ := json.Marshal(p)
	if string(before) != string(after) {
		t.Fatal("failed housing check charged barter inputs")
	}
}

func TestDisplayedIndustrialOutputUsesAvailableMaterials(t *testing.T) {
	p := constructionPlayer()
	p.BuildingCounts[BPCharcoalKiln] = 1
	p.Workers = map[string]int32{JobWater: 3, JobCharcoal: 1}
	p.ResourcesMilli[ResWood] = 50
	gross, drain, _ := ComputeResourceFlows(p)
	if gross[ResCharcoal] != 46 || drain[ResWood] != 49 {
		t.Fatalf("displayed a full second of work with only 50 milli wood: gross=%d drain=%d", gross[ResCharcoal], drain[ResWood])
	}
	p.ResourcesMilli[ResWood] = 9_000_000_000_000_000
	gross, _, _ = ComputeResourceFlows(p)
	if gross[ResCharcoal] != 280 {
		t.Fatal("large legitimate stock overflowed the rate preview")
	}
}

func TestIndustrialPreviewCombinesCoalAndBackupWoodFuel(t *testing.T) {
	p := constructionPlayer()
	p.Profession = ProfScientist
	p.UnlockedBlueprints[BPBasicWorkshop] = true
	p.Workers = map[string]int32{JobWater: 3, JobSmeltIron: 1}
	p.ResourcesMilli[ResStone] = 180
	p.ResourcesMilli[ResCharcoal] = 50
	p.ResourcesMilli[ResWood] = 100
	gross, drain, _ := ComputeResourceFlows(p)
	if gross[ResIronIngot] != 110 || drain[ResCharcoal] != 50 || drain[ResWood] != 50 || drain[ResStone] != 180 {
		t.Fatalf("mixed-fuel preview diverged: gross=%v drain=%v", gross, drain)
	}
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResIronIngot] != gross[ResIronIngot] || p.ResourcesMilli[ResWood] != 50 || p.ResourcesMilli[ResCharcoal] != 0 {
		t.Fatal("preview did not match actual conversion")
	}
}
