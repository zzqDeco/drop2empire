package pg

import (
	"context"
	"drop2empire/services/game/internal/domain"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestEconomyPolicyConcurrentReplayAndAuditRollback(t *testing.T) {
	s := integrationStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	apply := func(id string) error {
		return s.WithinTx(ctx, func(tx context.Context) error {
			w, err := s.LoadWorld(tx, now)
			if err != nil {
				return err
			}
			if err := domain.ApplyMonetaryPolicy(w, domain.MonetaryPolicy{ID: id, Action: "issue", Amount: 1000000}, now); err != nil {
				return err
			}
			return s.SaveWorld(tx, w)
		})
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- apply("concurrent-policy") }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM d2e_economy_audit`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("audit rows=%d error=%v", count, err)
	}
	if _, err := s.db.Exec(ctx, `ALTER TABLE d2e_economy_audit ADD CONSTRAINT reject_policy CHECK (kind <> 'monetary_policy') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	if err := apply("must-rollback"); err == nil {
		t.Fatal("audit write failure did not fail transaction")
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		if w.TotalIssuedBasis != 1000000 || len(w.Economy.Policies) != 1 {
			return fmt.Errorf("audit failure committed issuance")
		}
		return domain.CheckEconomy(w)
	}); err != nil {
		t.Fatal(err)
	}
}

func TestEconomyJSONRoundTripAndLegacyRestartGate(t *testing.T) {
	s := integrationStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		if err := domain.IntroduceCompany(w, "alloy", 1000, 1000, 500, now.Add(time.Hour), now); err != nil {
			return err
		}
		return s.SaveWorld(tx, w)
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		if c := w.Economy.Companies["alloy"]; c == nil || c.Wallet.Stock == nil || c.StockCost == nil || c.PackCosts == nil {
			return fmt.Errorf("company state lost in persistence")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(ctx, `UPDATE d2e_world_state SET state_json=state_json-'economy'`); err != nil {
		t.Fatal(err)
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error { _, err := s.LoadWorld(tx, now); return err }); err == nil {
		t.Fatal("legacy monetary ledger silently adopted")
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error { _, _, err := s.LoadSessionPlayer(tx, "legacy-session"); return err }); err == nil {
		t.Fatal("raid fast path bypassed clean-start gate")
	}
}
