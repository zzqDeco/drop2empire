package pg

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"drop2empire/pkg/postgres"
	"drop2empire/services/game/internal/domain"
)

var Migrations = []postgres.Migration{
	{
		Version: 1,
		SQL: `
CREATE TABLE IF NOT EXISTS d2e_world_state (
	realm_id text PRIMARY KEY,
	state_json jsonb NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS d2e_trades_audit (
	trade_id text PRIMARY KEY,
	item_key text NOT NULL,
	price_basis bigint NOT NULL,
	quantity_milli bigint NOT NULL,
	total_gold_basis bigint NOT NULL,
	tax_burned_basis bigint NOT NULL,
	tax_treasury_basis bigint NOT NULL,
	buyer_handle text NOT NULL,
	seller_handle text NOT NULL,
	executed_at text NOT NULL,
	recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS d2e_collectibles_audit (
	item_id text PRIMARY KEY,
	serial_number integer NOT NULL,
	season_id text NOT NULL,
	base_model_id text NOT NULL,
	texture_id text NOT NULL,
	pattern_seed bigint NOT NULL,
	rarity_tier text NOT NULL,
	owner_handle text NOT NULL,
	minted_at text NOT NULL,
	recorded_at timestamptz NOT NULL DEFAULT now()
);
`,
	},
}

type Store struct {
	db *postgres.DB
}

func NewStore(db *postgres.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Migrate(ctx context.Context) error {
	return postgres.Migrate(ctx, s.db.Pool(), 9021042, "d2e_schema_migrations", Migrations)
}

func (s *Store) WithinTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return s.db.WithinTx(ctx, fn)
}

func (s *Store) LoadWorld(ctx context.Context, now time.Time) (*domain.WorldState, error) {
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT state_json FROM d2e_world_state WHERE realm_id = 'realm-main' FOR UPDATE`).Scan(&raw)
	if err != nil {
		if postgres.IsNoRows(err) {
			w := domain.NewDefaultWorld(now)
			if saveErr := s.SaveWorld(ctx, w); saveErr != nil {
				return nil, saveErr
			}
			return w, nil
		}
		return nil, err
	}
	var w domain.WorldState
	if err := json.Unmarshal(raw, &w); err != nil {
		return nil, err
	}
	if w.Players == nil {
		w.Players = make(map[string]*domain.PlayerState)
	}
	return &w, nil
}

func (s *Store) SaveWorld(ctx context.Context, world *domain.WorldState) error {
	raw, err := json.Marshal(world)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `
INSERT INTO d2e_world_state (realm_id, state_json, updated_at)
VALUES ('realm-main', $1::jsonb, now())
ON CONFLICT (realm_id) DO UPDATE
SET state_json = EXCLUDED.state_json, updated_at = now()
`, string(raw))
	if err != nil {
		return err
	}

	// Sync latest trade and collectible audit records idempotently
	if len(world.Trades) > 0 {
		tr := world.Trades[0]
		_, _ = s.db.Exec(ctx, `
INSERT INTO d2e_trades_audit (trade_id, item_key, price_basis, quantity_milli, total_gold_basis, tax_burned_basis, tax_treasury_basis, buyer_handle, seller_handle, executed_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (trade_id) DO NOTHING
`, tr.ID, tr.ItemKey, tr.PriceBasis, tr.QuantityMilli, tr.TotalGoldBasis, tr.TaxBurnedBasis, tr.TaxTreasuryBasis, tr.BuyerHandle, tr.SellerHandle, tr.ExecutedAt)
	}
	if len(world.Collectibles) > 0 {
		c := world.Collectibles[0]
		_, _ = s.db.Exec(ctx, `
INSERT INTO d2e_collectibles_audit (item_id, serial_number, season_id, base_model_id, texture_id, pattern_seed, rarity_tier, owner_handle, minted_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (item_id) DO UPDATE SET owner_handle = EXCLUDED.owner_handle
`, c.ItemID, c.SerialNumber, c.SeasonID, c.BaseModelID, c.TextureID, c.PatternSeed, c.RarityTier, c.OwnerHandle, c.MintedAt)
	}
	return nil
}

// MemoryStore provides a thread-safe transactional store when running standalone unit tests without PostgreSQL.
type MemoryStore struct {
	mu    sync.Mutex
	world *domain.WorldState
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{}
}

func (m *MemoryStore) WithinTx(ctx context.Context, fn func(ctx context.Context) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return fn(ctx)
}

func (m *MemoryStore) LoadWorld(_ context.Context, now time.Time) (*domain.WorldState, error) {
	if m.world == nil {
		m.world = domain.NewDefaultWorld(now)
	}
	raw, err := json.Marshal(m.world)
	if err != nil {
		return nil, err
	}
	var clone domain.WorldState
	if err := json.Unmarshal(raw, &clone); err != nil {
		return nil, err
	}
	return &clone, nil
}

func (m *MemoryStore) SaveWorld(_ context.Context, world *domain.WorldState) error {
	raw, err := json.Marshal(world)
	if err != nil {
		return err
	}
	var clone domain.WorldState
	if err := json.Unmarshal(raw, &clone); err != nil {
		return err
	}
	m.world = &clone
	return nil
}
