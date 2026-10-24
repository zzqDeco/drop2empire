package domain

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"reflect"
	"testing"
	"time"
)

func regressionRaid(t *testing.T) (*PlayerState, time.Time) {
	t.Helper()
	now := time.Date(2026, 10, 24, 6, 0, 0, 0, time.UTC)
	p := NewBlankPlayer("regression", now)
	p.UnlockedBlueprints[BPScoutCamp] = true
	p.RaidGearInventory["gear_titan_hammer"] = 1
	p.RaidLoadout.WeaponKey = "gear_titan_hammer"
	if err := StartRaid(p, now); err != nil {
		t.Fatal(err)
	}
	return p, now
}

func TestRaidCannotRestartOrChangeEntryLoadout(t *testing.T) {
	p, now := regressionRaid(t)
	original := p.RaidLoadout.ActiveSession
	original.HP = 1
	for _, at := range []time.Time{now, original.ExpiresAt.Add(time.Second)} {
		if err := StartRaid(p, at); err == nil {
			t.Fatal("active raid overwritten")
		}
	}
	for _, action := range []string{"craft", "equip", "unequip"} {
		if err := ManageRaidGear(p, action, "gear_wood_spear", now); err == nil {
			t.Fatal("loadout mutation accepted")
		}
	}
	if err := DraftRaidBuff(p, "reroll", "", 0, now); err == nil {
		t.Fatal("draft changed in raid")
	}
	if p.RaidLoadout.ActiveSession != original || original.HP != 1 {
		t.Fatal("rejected commands mutated session")
	}
	if err := FinishRaid(p, "MIA", now); err != nil {
		t.Fatal(err)
	}
	if p.RaidGearInventory["gear_titan_hammer"] != 0 {
		t.Fatal("entry equipment escaped MIA loss")
	}
}

func TestRaidChannelsRequireFullDurationIncludingEqualAndOlderTimes(t *testing.T) {
	for _, kind := range []string{"chest_abyss", "extract_early"} {
		t.Run(kind, func(t *testing.T) {
			p, now := regressionRaid(t)
			s := p.RaidLoadout.ActiveSession
			z := &s.Zones[0]
			z.Tiles[3*z.Width+2].Kind = kind
			if err := PerformRaidAction(p, "move", 1, 0, "", "", "", "", now); err != nil {
				t.Fatal(err)
			}
			finish := func(at time.Time) error {
				if kind == "extract_early" {
					return FinishRaid(p, "EXTRACTED", at)
				}
				return PerformRaidAction(p, "open_chest", 0, 0, "", "", "", "", at)
			}
			for _, at := range []time.Time{now.Add(-time.Millisecond), now, now.Add(time.Millisecond), s.ChannelReadyAt.Add(-time.Millisecond)} {
				if err := finish(at); err == nil {
					t.Fatalf("channel accepted early at %s", at)
				}
			}
			if err := finish(s.ChannelReadyAt); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRaidMovementPreservesSustainedRate(t *testing.T) {
	p, now := regressionRaid(t)
	s := p.RaidLoadout.ActiveSession
	z := &s.Zones[0]
	z.Tiles[3*z.Width+2].Kind = "empty"
	z.Tiles[3*z.Width+1].Kind = "empty"
	accepted := 0
	for i := 0; i < 100; i++ {
		dx := int32(1)
		if s.PlayerX == 2 {
			dx = -1
		}
		if PerformRaidAction(p, "move", dx, 0, "", "", "", "", now.Add(time.Duration(i)*180*time.Millisecond)) == nil {
			accepted++
		}
	}
	maximum := int((17_820 + RaidBalance.MoveBurstAllowanceMs) / int64(s.BaseMoveCooldownMs))
	if accepted > maximum || accepted < 45 {
		t.Fatalf("accepted %d steps, maximum %d", accepted, maximum)
	}
}

func TestRaidCommandRetriesDoNotRepeatOrAffectNewRaids(t *testing.T) {
	p, now := regressionRaid(t)
	s := p.RaidLoadout.ActiveSession
	id := s.RaidID
	s.Zones[0].Tiles[3*s.Zones[0].Width+2].Kind = "empty"
	move := RaidCommand{Action: "move", DX: 1}
	for i := 0; i < 2; i++ {
		if err := ApplyRaidCommand(p, id, 1, move, now); err != nil {
			t.Fatal(err)
		}
	}
	if s.PlayerX != 2 {
		t.Fatal("retried command moved twice")
	}
	if err := ApplyRaidCommand(p, id, 1, RaidCommand{Action: "move", DX: -1}, now); err == nil {
		t.Fatal("same sequence with different payload accepted")
	}
	finish := RaidCommand{Action: "finish", Status: "MIA"}
	if err := ApplyRaidCommand(p, id, 2, finish, now); err != nil {
		t.Fatal(err)
	}
	if err := StartRaid(p, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	next := p.RaidLoadout.ActiveSession
	if err := ApplyRaidCommand(p, id, 2, finish, now.Add(2*time.Second)); err != nil {
		t.Fatal(err)
	}
	if p.RaidLoadout.ActiveSession != next {
		t.Fatal("old finish ended new raid")
	}
	if err := ApplyRaidCommand(p, id, 3, move, now); err == nil {
		t.Fatal("stale raid action accepted")
	}
}

func TestInvalidLootTransferIsAtomic(t *testing.T) {
	p, now := regressionRaid(t)
	s := p.RaidLoadout.ActiveSession
	s.Backpack = []RaidLootItem{{ID: "existing", Key: ResBPCrossbow}}
	before, _ := json.Marshal(s)
	for _, dest := range []string{"", "invalid"} {
		if err := PerformRaidAction(p, "transfer_loot", 0, 0, "existing", "backpack", dest, "", now); err == nil {
			t.Fatal("invalid target accepted")
		}
	}
	after, _ := json.Marshal(s)
	if string(before) != string(after) {
		t.Fatal("invalid transfer modified state")
	}
}

func TestMarketRejectsOverflowAndPreservesEscrow(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	w.Orders = nil
	p := w.Players["archon_demo"]
	before := p.GoldBasis
	for _, qty := range []int64{100_000_000_000, math.MaxInt64 - 807, 1_000_000_001_000} {
		if err := PlaceMarketOrder(w, p, ResWater, "BID", 100_000_000, qty, now); err == nil {
			t.Fatal("oversized order accepted")
		}
		if p.GoldBasis != before || p.GoldFrozenBasis != 0 {
			t.Fatal("rejected order changed balances")
		}
	}
	assertMacroLedgerIdentity(t, w)
}

func TestMarketFIFOAcrossDecimalBoundaryAndEveryFillRetained(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	w.Orders = nil
	w.Trades = nil
	w.NextOrderSeq = 98
	buyer := w.Players["archon_demo"]
	for i := 0; i < 65; i++ {
		p := NewBlankPlayer(fmt.Sprintf("seller_%02d", i), now)
		p.Profession = ProfScientist
		p.ResourcesMilli[ResWater] = ResourceScale
		w.Players[p.Handle] = p
		if err := PlaceMarketOrder(w, p, ResWater, "ASK", GoldScale, ResourceScale, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := PlaceMarketOrder(w, buyer, ResWater, "BID", GoldScale, 65*ResourceScale, now); err != nil {
		t.Fatal(err)
	}
	if len(w.PendingTrades) != 65 || len(w.Trades) != 60 {
		t.Fatalf("pending=%d UI=%d", len(w.PendingTrades), len(w.Trades))
	}
	if w.PendingTrades[0].SellerHandle != "seller_00" || w.PendingTrades[1].SellerHandle != "seller_01" {
		t.Fatal("FIFO violated across ord_99/ord_100")
	}
	if buyer.GoldFrozenBasis != 0 {
		t.Fatal("residual escrow after full fill")
	}
	assertMacroLedgerIdentity(t, w)
}

func TestProductionConservesInputsAndIsIndependentOfRequestPartitions(t *testing.T) {
	now := time.Now()
	makePlayer := func() *PlayerState {
		p := NewBlankPlayer("producer", now)
		p.PopulationTotal = 1
		p.Workers[JobCharcoal] = 1
		p.UnlockedBlueprints[BPCharcoalKiln] = true
		p.BuildingCounts[BPCharcoalKiln] = 1
		p.ResourcesMilli[ResWood] = ResourceScale
		return p
	}
	bulk, stepped := makePlayer(), makePlayer()
	SettleProduction(bulk, now.Add(time.Minute))
	for i := 1; i <= 600; i++ {
		SettleProduction(stepped, now.Add(time.Duration(i)*100*time.Millisecond))
	}
	if !reflect.DeepEqual(bulk.ResourcesMilli, stepped.ResourcesMilli) || !reflect.DeepEqual(bulk.ProductionRemainders, stepped.ProductionRemainders) {
		t.Fatal("request-frequency-dependent production")
	}
	if bulk.ResourcesMilli[ResCharcoal] > 934 || bulk.ResourcesMilli[ResWood] < 0 {
		t.Fatalf("created output without input: %+v", bulk.ResourcesMilli)
	}
	if stepped.SimulatedElapsedSeconds != 60 {
		t.Fatalf("subsecond clock lost time: %d", stepped.SimulatedElapsedSeconds)
	}
	// Exercise coupled jobs, hydration, caps and siphon under irregular partitions.
	for seed := int64(0); seed < 8; seed++ {
		w := NewDefaultWorld(now)
		base := w.Players["archon_demo"]
		base.LastSettledAt = now
		raw, _ := json.Marshal(base)
		var split PlayerState
		_ = json.Unmarshal(raw, &split)
		SettleProduction(base, now.Add(61_337*time.Millisecond))
		rng := rand.New(rand.NewSource(seed))
		elapsed := int64(0)
		for elapsed < 61_337 {
			elapsed += int64(rng.Intn(1300) + 1)
			if elapsed > 61_337 {
				elapsed = 61_337
			}
			SettleProduction(&split, now.Add(time.Duration(elapsed)*time.Millisecond))
		}
		if !reflect.DeepEqual(base.ResourcesMilli, split.ResourcesMilli) || !reflect.DeepEqual(base.ProductionRemainders, split.ProductionRemainders) || base.SimulatedRemainderMs != split.SimulatedRemainderMs {
			t.Fatalf("partition differs for seed %d", seed)
		}
	}
}

func TestWarPeriodIsIdempotentAndRewardsOnlyParticipants(t *testing.T) {
	now := time.Date(2026, 10, 24, 11, 59, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	spectator := w.Players["pioneer"]
	participant := w.Players["archon_demo"]
	if err := DeployWarTroops(w, participant, "node_north_fort", 1, 0, 0, now); err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"join", " JOIN ", "create", " CREATE "} {
		err := PerformGuildAction(w, participant, action, "", "", "", GuildArgent, "", now)
		if rule, ok := err.(*Error); !ok || rule.Code != "war_faction_locked" {
			t.Fatalf("participant faction was not locked for %q: %v", action, err)
		}
	}
	SettleWarDay(w, participant, now)
	if len(w.WarHistory) != 0 {
		t.Fatal("settled before 20:00 Shanghai")
	}
	SettleWarDay(w, participant, now.Add(time.Minute))
	gold, points := participant.GoldBasis, participant.ActivityPoints
	for i := 0; i < 3; i++ {
		SettleWarDay(w, participant, now.Add(time.Hour))
	}
	if len(w.WarHistory) != 1 || w.WarDay != 2 || participant.GoldBasis != gold || participant.ActivityPoints != points {
		t.Fatal("duplicate war settlement rewarded twice")
	}
	if spectator.GoldBasis != 0 || spectator.ActivityPoints != 0 {
		t.Fatal("nonparticipant received reward")
	}
	assertMacroLedgerIdentity(t, w)
}

func BenchmarkOfflineProductionCatchup(b *testing.B) {
	now := time.Now()
	for i := 0; i < b.N; i++ {
		p := NewBlankPlayer("bench", now)
		p.PopulationTotal = 1
		p.Workers[JobWater] = 1
		SettleProduction(p, now.Add(8*time.Hour))
	}
}

func TestIronSmeltingFallsBackToWoodDespiteSubMilliCharcoalRemainder(t *testing.T) {
	now := time.Date(2026, 10, 24, 6, 0, 0, 0, time.UTC)
	p := NewBlankPlayer("smelter", now)
	p.PopulationTotal = 2
	p.Workers[JobSmeltIron] = 2
	p.UnlockedBlueprints[BPBasicWorkshop] = true
	p.Profession = ProfArtisan
	p.ResourcesMilli[ResWater] = 50_000
	p.ResourcesMilli[ResStone] = 10_000
	p.ResourcesMilli[ResWood] = 10_000
	p.ProductionRemainders = map[string]int64{ResCharcoal: 40} // < 100 sub-milli/ms fuel rate

	SettleProduction(p, now.Add(5*time.Second))
	if p.ResourcesMilli[ResIronIngot] <= 0 {
		t.Fatalf("expected iron ingot output via wood fallback, got %d (remainders=%v)", p.ResourcesMilli[ResIronIngot], p.ProductionRemainders)
	}
	if p.ResourcesMilli[ResWood] >= 10_000 {
		t.Fatalf("expected wood fallback fuel consumption, got %d", p.ResourcesMilli[ResWood])
	}
}

func TestEdictHydroSawDoesNotDrainWaterWhenInactiveAtTickStart(t *testing.T) {
	now := time.Date(2026, 10, 24, 6, 0, 0, 0, time.UTC)
	p := NewBlankPlayer("hydro", now)
	p.PopulationTotal = 1
	p.Workers[JobWater] = 1
	p.UnlockedBlueprints[BPColonyEdicts] = true
	p.UnlockedBlueprints[BPWaterWheel1] = true
	p.ActiveEdicts[EdictHydroSaw] = true
	p.ResourcesMilli[ResWater] = 0

	// In the first 1-second tick, water starts at 0 so EdictHydroSaw grants no bonus;
	// it must not drain 1,500 milli-units of water during that same tick.
	SettleProduction(p, now.Add(time.Second))
	if p.ResourcesMilli[ResWater] != 2500 {
		t.Fatalf("expected full 2500 milli water from 1 worker with BPWaterWheel1 in tick 1 (hydro_saw inactive at tick start), got %d", p.ResourcesMilli[ResWater])
	}
}

func TestMarketFillSettlesRestingBuyerBeforeCreditingInputResources(t *testing.T) {
	t0 := time.Date(2026, 10, 24, 6, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(t0)
	w.Orders = nil

	buyer := NewBlankPlayer("resting_buyer", t0)
	buyer.Profession = ProfArtisan
	buyer.PopulationTotal = 1
	buyer.Workers[JobCharcoal] = 1
	buyer.UnlockedBlueprints[BPCharcoalKiln] = true
	buyer.BuildingCounts[BPCharcoalKiln] = 1
	buyer.ResourcesMilli[ResWater] = 100_000
	buyer.ResourcesMilli[ResWood] = 0
	buyer.GoldBasis = 100 * GoldScale
	w.Players[buyer.Handle] = buyer

	if err := PlaceMarketOrder(w, buyer, ResWood, "BID", GoldScale, 10*ResourceScale, t0); err != nil {
		t.Fatal(err)
	}

	// Seller fills the resting buyer's order 1 hour later.
	t1 := t0.Add(time.Hour)
	seller := w.Players["archon_demo"]
	SettleProduction(seller, t1)
	if err := PlaceMarketOrder(w, seller, ResWood, "ASK", GoldScale, 10*ResourceScale, t1); err != nil {
		t.Fatal(err)
	}

	// Buyer now polls at t1: because wood arrived at t1 (not t0), buyer must have 0 charcoal produced over [t0, t1] and all 10,000 milli wood intact.
	SettleProduction(buyer, t1)
	if buyer.ResourcesMilli[ResCharcoal] != 0 {
		t.Fatalf("resting buyer retroactively produced %d charcoal from wood delivered at t1", buyer.ResourcesMilli[ResCharcoal])
	}
	if buyer.ResourcesMilli[ResWood] != 10*ResourceScale {
		t.Fatalf("expected 10,000 milli wood at t1, got %d", buyer.ResourcesMilli[ResWood])
	}
}
