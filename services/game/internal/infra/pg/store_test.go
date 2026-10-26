package pg

import (
	"context"
	"testing"
	"time"

	"drop2empire/services/game/internal/domain"
)

func TestPostgresStoreRoundTrip(t *testing.T) {
	store := integrationStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now().UTC()
	if err := store.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := store.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		if err := domain.GatherWater(w.Players["pioneer"], 10, now); err != nil {
			return err
		}
		return store.SaveWorld(txCtx, w)
	}); err != nil {
		t.Fatalf("tx failed: %v", err)
	}
}
