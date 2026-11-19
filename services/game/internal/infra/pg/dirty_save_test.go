package pg

import (
	"context"
	"testing"
	"time"
)

func TestMemoryStoreSaveWorldSkipsUnchangedPlayers(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	store := NewMemoryStore()

	// Initialize world with default players (archon_demo + pioneer)
	if err := store.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := store.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		w.Sessions["tok_archon"] = "archon_demo"
		return store.SaveWorld(txCtx, w)
	}); err != nil {
		t.Fatal(err)
	}

	var pioneerRevBefore int64
	// Mutate ONLY archon_demo inside a global SaveWorld transaction
	if err := store.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := store.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		pioneerRevBefore = w.Players["pioneer"].Revision
		w.Players["archon_demo"].ActivityPoints += 10
		return store.SaveWorld(txCtx, w)
	}); err != nil {
		t.Fatal(err)
	}

	// Verify pioneer was NOT rewritten / revision did NOT increment
	if err := store.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := store.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		if w.Players["pioneer"].Revision != pioneerRevBefore {
			t.Fatalf("untouched bystander revision bumped from %d to %d", pioneerRevBefore, w.Players["pioneer"].Revision)
		}
		if w.Players["archon_demo"].ActivityPoints < 10 {
			t.Fatalf("expected mutated player changes to persist")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	// Verify LoadSessionWorldView returns cached aggregate ledger & single locked player
	if err := store.WithinTx(ctx, func(txCtx context.Context) error {
		w, p, _, err := store.LoadSessionWorldView(txCtx, "tok_archon")
		if err != nil {
			return err
		}
		if p.Handle != "archon_demo" || len(w.Players) != 1 || !w.MacroLedgerCached {
			t.Fatalf("unexpected single-player world view: handle=%s len=%d cached=%v", p.Handle, len(w.Players), w.MacroLedgerCached)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
