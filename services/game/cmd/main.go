package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"drop2empire/pkg/httpx"
	"drop2empire/pkg/postgres"
	httpadapter "drop2empire/services/game/internal/adapter/http"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
	"drop2empire/services/game/internal/infra/pg"
)

func main() {
	addr := httpx.Env("HTTP_ADDR", "127.0.0.1:8080")
	dbURL := httpx.Env("DATABASE_URL", "postgres://127.0.0.1:5432/drop2empire?sslmode=disable")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var txMgr domain.TxManager
	var repo domain.GameRepository
	var readyFn func(context.Context) error

	db, err := postgres.OpenDB(ctx, dbURL)
	if err == nil && db.Ping(ctx) == nil {
		pgStore := pg.NewStore(db)
		if migErr := pgStore.Migrate(ctx); migErr != nil {
			slog.Error("database migration failed", "error", migErr)
			os.Exit(1)
		}
		slog.Info("connected to PostgreSQL authoritative store")
		txMgr = pgStore
		repo = pgStore
		readyFn = db.Ping
		defer db.Close()
	} else {
		slog.Error("PostgreSQL unavailable; refusing to start without durable state")
		if db != nil {
			db.Close()
		}
		os.Exit(1)
	}

	svc := app.NewService(txMgr, repo)
	clockCtx, stopClock := context.WithCancel(context.Background())
	defer stopClock()
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-clockCtx.Done():
				return
			case <-ticker.C:
				tickCtx, cancelTick := context.WithTimeout(clockCtx, 30*time.Second)
				err := svc.TickEconomy(tickCtx)
				cancelTick()
				if err != nil {
					slog.Error("economy tick failed", "error", err)
				}
			}
		}
	}()
	handler := httpadapter.NewHTTPHandler(svc, readyFn)
	slog.Info("starting Drop to Empire (D2E) Hertz server", "addr", addr)
	httpx.Serve(addr, handler)
}
