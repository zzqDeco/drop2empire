package domain

import (
	"testing"
	"time"
)

func assertMacroLedgerIdentity(t *testing.T, w *WorldState) {
	t.Helper()
	var playerHeld, escrowHeld int64
	for _, p := range w.Players {
		playerHeld += p.GoldBasis
		escrowHeld += p.GoldFrozenBasis
	}
	sum := playerHeld + escrowHeld + w.NPCHeldBasis + w.TreasuryHeldBasis
	if sum != w.TotalIssuedBasis {
		t.Fatalf("monetary supply identity violated: sum(%d) != totalIssued(%d) [player=%d, escrow=%d, npc=%d, treasury=%d, burned=%d]",
			sum, w.TotalIssuedBasis, playerHeld, escrowHeld, w.NPCHeldBasis, w.TreasuryHeldBasis, w.PermanentlyBurnedBasis)
	}
}

func TestPhase1BenchmarksMatchGDD30MinModel(t *testing.T) {
	runs := RunPhase1Benchmarks()
	if len(runs) != 3 {
		t.Fatalf("expected 3 benchmark runs, got %d", len(runs))
	}
	base := runs[0]
	if base.TotalSeconds < 1750 || base.TotalSeconds > 1850 {
		t.Fatalf("expected GDD 4.4 baseline to complete around 30m (1750-1850s), got %s (%.1fs)", base.FormattedTotal, base.TotalSeconds)
	}
	parts := runs[1]
	if len(parts.Milestones) < 9 {
		t.Fatalf("expected intermediate treasure part milestones in balanced_parts run, got %d", len(parts.Milestones))
	}
}

func TestFullLoopProgressionMarketWarAndCollectibles(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	assertMacroLedgerIdentity(t, w)

	p := w.Players["pioneer"]
	if p.ResourcesMilli[ResWater] != 0 || p.PopulationTotal != 0 {
		t.Fatalf("expected pioneer to start at 0 water and 0 pop")
	}

	// 1. Click water 10 times -> recruit first resident
	for i := 0; i < 10; i++ {
		if err := GatherWater(p, 1, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := RecruitResident(p, 1, now); err != nil {
		t.Fatal(err)
	}
	if p.PopulationTotal != 1 || p.Workers[JobWater] != 1 {
		t.Fatalf("expected 1 resident auto-assigned to water, got pop=%d waterWorkers=%d", p.PopulationTotal, p.Workers[JobWater])
	}

	// 2. Fast-forward and unlock Mystery Treasure on veteran or pioneer
	vet := w.Players["archon_demo"]
	initialTrades := len(w.Trades)

	// Place a BUY order that crosses an NPC ASK order on AutoPump (ASK @ 192000)
	if err := PlaceMarketOrder(w, vet, ResAutoPump, "BID", 195000, 1*ResourceScale, now); err != nil {
		t.Fatal(err)
	}
	if len(w.Trades) <= initialTrades {
		t.Fatal("expected market order to match resting NPC ask")
	}
	assertMacroLedgerIdentity(t, w)

	// Place a non-crossing BID order and cancel it
	if err := PlaceMarketOrder(w, vet, ResWood, "BID", 2000, 5*ResourceScale, now); err != nil {
		t.Fatal(err)
	}
	assertMacroLedgerIdentity(t, w)
	openID := w.Orders[0].ID
	if err := CancelMarketOrder(w, vet, openID, now); err != nil {
		t.Fatal(err)
	}
	assertMacroLedgerIdentity(t, w)

	// 3. Test Graph War connectivity & deployment
	// Obsidian owns node_west_base & node_west_outpost initially; cannot jump directly to node_east_base
	if err := DeployWarTroops(w, vet, "node_east_base", 2, 0, 0, now); err == nil {
		t.Fatal("expected deployment to disconnected enemy base to fail")
	}
	// Can deploy to node_north_fort (1 hop from node_west_outpost)
	if err := DeployWarTroops(w, vet, "node_north_fort", 4, 2, 2, now); err != nil {
		t.Fatalf("expected valid deployment to adjacent node_north_fort, got %v", err)
	}

	// 4. Trigger 20:00 War Settlement
	SettleWarDay(w, vet, now)
	assertMacroLedgerIdentity(t, w)
	if len(w.WarHistory) != 1 {
		t.Fatalf("expected 1 war history record, got %d", len(w.WarHistory))
	}

	// 5. Redeem and open Season Chest
	if err := RedeemSeasonChest(vet, 1, now); err != nil {
		t.Fatal(err)
	}
	if err := OpenSeasonChest(w, vet, 42, now); err != nil {
		t.Fatal(err)
	}
	if len(w.Collectibles) != 1 {
		t.Fatalf("expected 1 minted collectible, got %d", len(w.Collectibles))
	}
	c := w.Collectibles[0]
	if c.ItemID == "" || c.PatternSeed == 0 {
		t.Fatalf("invalid collectible minted: %+v", c)
	}
}
