package pg

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
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
	{Version: 2, SQL: `
CREATE TABLE d2e_players (
 handle text PRIMARY KEY,
 state_json jsonb NOT NULL,
 revision bigint NOT NULL DEFAULT 0
);
INSERT INTO d2e_players(handle, state_json)
 SELECT entry.key, entry.value FROM d2e_world_state,
 LATERAL jsonb_each(COALESCE(state_json->'players','{}'::jsonb)) entry;
UPDATE d2e_world_state SET state_json = state_json - 'players';
`},
	{Version: 3, SQL: `CREATE TABLE d2e_economy_audit (record_id text PRIMARY KEY, kind text NOT NULL, company_id text NOT NULL, actor text NOT NULL, occurred_at timestamptz NOT NULL, data jsonb NOT NULL);`},
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
			w := domain.NewEmptyWorld(now)
			meta := *w
			meta.Players = nil
			initial, marshalErr := json.Marshal(&meta)
			if marshalErr != nil {
				return nil, marshalErr
			}
			tag, insertErr := s.db.Exec(ctx, `INSERT INTO d2e_world_state(realm_id,state_json) VALUES ('realm-main',$1::jsonb) ON CONFLICT DO NOTHING`, string(initial))
			if insertErr != nil {
				return nil, insertErr
			}
			if tag.RowsAffected() == 1 {
				w.PendingTrades = append([]domain.MarketTrade{}, w.Trades...)
				w.PendingCollectibles = append([]domain.CollectibleItem{}, w.Collectibles...)
				if saveErr := s.SaveWorld(ctx, w); saveErr != nil {
					return nil, saveErr
				}
				return w, nil
			}
			return s.LoadWorld(ctx, now)
		}
		return nil, err
	}
	var w domain.WorldState
	if err := json.Unmarshal(raw, &w); err != nil {
		return nil, err
	}
	if w.Economy == nil || w.Economy.Version != 1 {
		return nil, domain.ErrPrecondition("economy_restart_required", "新经济规则要求清档重开，请按上线手册重新初始化经济数据库")
	}
	w.Players = make(map[string]*domain.PlayerState)
	// Global transactions always lock realm first, then players in handle order.
	// Raid transactions lock only their player and never acquire the realm lock.
	rows, err := s.db.Query(ctx, `SELECT state_json,revision FROM d2e_players ORDER BY handle FOR UPDATE`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var data []byte
		var revision int64
		if err := rows.Scan(&data, &revision); err != nil {
			return nil, err
		}
		var p domain.PlayerState
		if err := json.Unmarshal(data, &p); err != nil {
			return nil, err
		}
		p.Revision = revision
		w.Players[p.Handle] = &p
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *Store) SaveWorld(ctx context.Context, world *domain.WorldState) error {
	if err := domain.CheckEconomy(world); err != nil {
		return err
	}
	meta := *world
	meta.Players = nil
	raw, err := json.Marshal(&meta)
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

	handles := make([]string, 0, len(world.Players))
	for handle := range world.Players {
		handles = append(handles, handle)
	}
	sort.Strings(handles)
	for _, handle := range handles {
		if err := s.SavePlayer(ctx, world.Players[handle]); err != nil {
			return err
		}
	}
	for _, record := range world.PendingEconomyRecords {
		if _, err := s.db.Exec(ctx, `INSERT INTO d2e_economy_audit(record_id,kind,company_id,actor,occurred_at,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, record.ID, record.Kind, record.Company, record.Actor, record.At, string(record.Data)); err != nil {
			return err
		}
	}
	world.PendingEconomyRecords = nil
	// PendingTrades and PendingCollectibles record only new fills/mints from this transaction.
	for _, tr := range world.PendingTrades {
		_, err = s.db.Exec(ctx, `
INSERT INTO d2e_trades_audit (trade_id, item_key, price_basis, quantity_milli, total_gold_basis, tax_burned_basis, tax_treasury_basis, buyer_handle, seller_handle, executed_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (trade_id) DO NOTHING
`, tr.ID, tr.ItemKey, tr.PriceBasis, tr.QuantityMilli, tr.TotalGoldBasis, tr.TaxBurnedBasis, tr.TaxTreasuryBasis, tr.BuyerHandle, tr.SellerHandle, tr.ExecutedAt)
		if err != nil {
			return err
		}
	}
	world.PendingTrades = nil
	for _, c := range world.PendingCollectibles {
		_, err = s.db.Exec(ctx, `
INSERT INTO d2e_collectibles_audit (item_id, serial_number, season_id, base_model_id, texture_id, pattern_seed, rarity_tier, owner_handle, minted_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (item_id) DO UPDATE SET owner_handle = EXCLUDED.owner_handle
`, c.ItemID, c.SerialNumber, c.SeasonID, c.BaseModelID, c.TextureID, c.PatternSeed, c.RarityTier, c.OwnerHandle, c.MintedAt)
		if err != nil {
			return err
		}
	}
	world.PendingCollectibles = nil
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
	for handle, p := range world.Players {
		if m.world != nil && m.world.Players[handle] != nil {
			p.Revision = m.world.Players[handle].Revision + 1
		} else {
			p.Revision = 1
		}
	}
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

func (s *Store) SavePlayer(ctx context.Context, p *domain.PlayerState) error {
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	return s.db.QueryRow(ctx, `INSERT INTO d2e_players(handle,state_json,revision) VALUES ($1,$2::jsonb,1)
 ON CONFLICT(handle) DO UPDATE SET state_json=EXCLUDED.state_json,revision=d2e_players.revision+1
 RETURNING revision`, p.Handle, string(raw)).Scan(&p.Revision)
}

func sessionTarget(raw string) (string, bool) {
	if raw == "admin" {
		return "admin", true
	}
	if strings.HasPrefix(raw, "admin::") {
		return strings.TrimPrefix(raw, "admin::"), true
	}
	return raw, false
}

func (s *Store) LoadSessionPlayer(ctx context.Context, token string) (*domain.PlayerState, bool, error) {
	var raw string
	var economyVersion int
	err := s.db.QueryRow(ctx, `SELECT COALESCE(state_json->'sessions'->>$1,''), COALESCE((state_json->'economy'->>'version')::int,0) FROM d2e_world_state WHERE realm_id='realm-main'`, token).Scan(&raw, &economyVersion)
	if err != nil && !postgres.IsNoRows(err) {
		return nil, false, err
	}
	if err == nil && economyVersion != 1 {
		return nil, false, domain.ErrPrecondition("economy_restart_required", "新经济规则要求清档重开，请按上线手册重新初始化经济数据库")
	}
	if raw == "" {
		return nil, false, domain.ErrUnauthorized("登录会话已过期，请重新登录")
	}
	handle, admin := sessionTarget(raw)
	if admin {
		var allowed bool
		err := s.db.QueryRow(ctx, `SELECT COALESCE((state_json->>'isAdmin')::boolean,false) FROM d2e_players WHERE handle='admin'`).Scan(&allowed)
		if err != nil || !allowed {
			return nil, false, domain.ErrUnauthorized("管理员会话无效")
		}
	}
	var data []byte
	var revision int64
	err = s.db.QueryRow(ctx, `SELECT state_json,revision FROM d2e_players WHERE handle=$1 FOR UPDATE`, handle).Scan(&data, &revision)
	if postgres.IsNoRows(err) {
		return nil, false, domain.ErrUnauthorized("登录账号不存在")
	}
	if err != nil {
		return nil, false, err
	}
	var p domain.PlayerState
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, false, err
	}
	p.Revision = revision
	return &p, admin || p.IsAdmin, nil
}

func (m *MemoryStore) LoadSessionPlayer(_ context.Context, token string) (*domain.PlayerState, bool, error) {
	if m.world == nil {
		return nil, false, domain.ErrUnauthorized("请先登录")
	}
	handle, admin := sessionTarget(m.world.Sessions[token])
	p := m.world.Players[handle]
	if p == nil || (admin && (m.world.Players["admin"] == nil || !m.world.Players["admin"].IsAdmin)) {
		return nil, false, domain.ErrUnauthorized("登录会话无效")
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return nil, false, err
	}
	var clone domain.PlayerState
	if err := json.Unmarshal(raw, &clone); err != nil {
		return nil, false, err
	}
	return &clone, admin || p.IsAdmin, nil
}

func (m *MemoryStore) SavePlayer(_ context.Context, p *domain.PlayerState) error {
	p.Revision++
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	var clone domain.PlayerState
	if err := json.Unmarshal(raw, &clone); err != nil {
		return err
	}
	m.world.Players[p.Handle] = &clone
	return nil
}
