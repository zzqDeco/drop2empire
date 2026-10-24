package pg

import (
	"context"
	"os"
	"testing"
	"time"

	"drop2empire/pkg/postgres"
	"drop2empire/services/game/internal/domain"
)

func TestPostgresStoreRoundTrip(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL_TEST")
	if dbURL == "" {
		dbURL = "postgres://127.0.0.1:5432/drop2empire_test?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := postgres.OpenDB(ctx, dbURL)
	if err != nil || db.Ping(ctx) != nil {
		if os.Getenv("DATABASE_URL_TEST") != "" {
			t.Fatalf("configured PostgreSQL unavailable: %v", err)
		}
		t.Skipf("skipping PostgreSQL integration test: %v", err)
	}
	defer db.Close()

	store := NewStore(db)
	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

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
