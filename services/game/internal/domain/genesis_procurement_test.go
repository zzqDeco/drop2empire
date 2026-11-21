package domain

import (
	"testing"
	"time"
)

// TestGenesisControlledProcurementPlanMatchesPlayerAskAndPreservesIdentity verifies the exact
// 8-step 8,000 Gold genesis procurement charter from docs/operations/economy-clean-start.md.
func TestGenesisControlledProcurementPlanMatchesPlayerAskAndPreservesIdentity(t *testing.T) {
	now := time.Now().UTC()
	w := NewEmptyWorld(now)
	EnsureEconomy(w, now)

	seller := NewBlankPlayer("pt_seller", now)
	seller.Profession = ProfScientist
	seller.UnlockedBlueprints[BPBasicWorkshop] = true
	seller.UnlockedBlueprints[BPMysteryTreasure] = true
	seller.ResourcesMilli[ResWater] = 500 * ResourceScale
	w.Players[seller.Handle] = seller

	// Player lists 100 water @ 0.1000 Gold before genesis issuance (mirrors live F06 state)
	if err := PlaceMarketOrder(w, seller, ResWater, "ASK", 1000, 100*ResourceScale, now); err != nil {
		t.Fatalf("place pre-genesis water ask: %v", err)
	}
	if seller.GoldBasis != 0 || w.TotalIssuedBasis != 0 {
		t.Fatalf("expected zero gold before genesis policies, got seller=%d issued=%d", seller.GoldBasis, w.TotalIssuedBasis)
	}

	const totalGenesisBasis int64 = 80_000_000 // 8,000.0000 Gold
	steps := []MonetaryPolicy{
		{ID: "s1-genesis-001-issue-001", Action: "issue", Amount: totalGenesisBasis},
		{ID: "s1-genesis-001-fund-001", Action: "fund_public", Amount: totalGenesisBasis},
		{ID: "s1-genesis-001-buy-water-001", Action: "procure", Item: ResWater, Quantity: 8000 * ResourceScale, Price: 1000},
		{ID: "s1-genesis-001-buy-wood-001", Action: "procure", Item: ResWood, Quantity: 4000 * ResourceScale, Price: 4500},
		{ID: "s1-genesis-001-buy-stone-001", Action: "procure", Item: ResStone, Quantity: 2000 * ResourceScale, Price: 9500},
		{ID: "s1-genesis-001-buy-charcoal-001", Action: "procure", Item: ResCharcoal, Quantity: 1000 * ResourceScale, Price: 12000},
		{ID: "s1-genesis-001-buy-iron_ingot-001", Action: "procure", Item: ResIronIngot, Quantity: 500 * ResourceScale, Price: 32000},
		{ID: "s1-genesis-001-buy-flint-001", Action: "procure", Item: ResFlint, Quantity: 250 * ResourceScale, Price: 28000},
	}

	for _, step := range steps {
		if err := ApplyMonetaryPolicy(w, step, now); err != nil {
			t.Fatalf("apply policy %s failed: %v", step.ID, err)
		}
		if err := CheckEconomy(w); err != nil {
			t.Fatalf("monetary invariant broken after %s: %v", step.ID, err)
		}
	}

	// Replaying every policy ID with identical parameters must be a strict idempotent no-op
	for _, step := range steps {
		if err := ApplyMonetaryPolicy(w, step, now); err != nil {
			t.Fatalf("idempotent replay of %s failed: %v", step.ID, err)
		}
	}

	if w.TotalIssuedBasis != totalGenesisBasis {
		t.Fatalf("expected net issued %d basis, got %d", totalGenesisBasis, w.TotalIssuedBasis)
	}
	if MoneyHoldings(w) != totalGenesisBasis {
		t.Fatalf("expected MoneyHoldings=%d, got %d", totalGenesisBasis, MoneyHoldings(w))
	}
	// 100 water @ 0.1000 G = 10.0000 G gross (100_000 basis), 1% tax = 0.1000 G (1_000 basis) to treasury, 9.9000 G (99_000 basis) to seller
	if seller.GoldBasis != 99_000 {
		t.Fatalf("expected seller to receive 99_000 basis (9.9000 G) after 1%% tax, got %d", seller.GoldBasis)
	}
	if w.TreasuryHeldBasis != 1_000 {
		t.Fatalf("expected treasury to collect 1_000 basis (0.1000 G) tax, got %d", w.TreasuryHeldBasis)
	}
	if w.Economy.Public.Stock[ResWater] != 100*ResourceScale {
		t.Fatalf("expected @public to hold 100_000 milli purchased water, got %d", w.Economy.Public.Stock[ResWater])
	}
	if w.Economy.Public.Cash != 0 {
		t.Fatalf("expected all 8,000 G committed into escrow/fills with 0 unallocated cash, got %d", w.Economy.Public.Cash)
	}
	if w.Economy.Public.Escrow != totalGenesisBasis-100_000 {
		t.Fatalf("expected @public escrow %d basis, got %d", totalGenesisBasis-100_000, w.Economy.Public.Escrow)
	}
	if len(w.PendingTrades) != 1 {
		t.Fatalf("expected 1 real audited fill from pre-existing player water ask, got %d", len(w.PendingTrades))
	}
}
