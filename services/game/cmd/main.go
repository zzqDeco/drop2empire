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
	var repo domain.WorldRepository
	var readyFn func(context.Context) error

	db, err := postgres.OpenDB(ctx, dbURL)
	if err == nil && db.Ping(ctx) == nil {
		pgStore := pg.NewStore(db)
		if migErr := pgStore.Migrate(ctx); migErr != nil {
			slog.Error("database migration failed", "error", migErr)
			os.Exit(1)
		}
		slog.Info("connected to PostgreSQL authoritative store", "url", dbURL)
		txMgr = pgStore
		repo = pgStore
		readyFn = db.Ping
		defer db.Close()
	} else {
		slog.Warn("PostgreSQL unavailable, falling back to in-memory transactional store", "error", err)
		mem := pg.NewMemoryStore()
		txMgr = mem
		repo = mem
		readyFn = func(context.Context) error { return nil }
	}

	svc := app.NewService(txMgr, repo)
	handler := httpadapter.NewHTTPHandler(svc, readyFn)
	slog.Info("starting Drop to Empire (D2E) Hertz server", "addr", addr)
	httpx.Serve(addr, handler)
}
