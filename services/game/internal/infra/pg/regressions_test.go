package pg

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"drop2empire/pkg/postgres"
	"drop2empire/services/game/internal/domain"
)

func integrationStore(t testing.TB) *Store {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL_TEST")
	if dsn == "" {
		t.Skip("DATABASE_URL_TEST must name a disposable database")
	}
	ctx := context.Background()
	control, err := postgres.OpenDB(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(control.Close)
	// Isolate every test/benchmark sample so earlier runs cannot change its
	// player count or leave audit constraints that affect another scenario.
	schema := fmt.Sprintf("regression_%d", time.Now().UnixNano())
	if _, err := control.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = control.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") })
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, err := postgres.OpenDB(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := db.Ping(context.Background()); err != nil {
		t.Fatal(err)
	}
	s := NewStore(db)
	if err := s.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestMigrationSplitsLegacySnapshotWithoutLosingPlayerState(t *testing.T) {
	base := integrationStore(t)
	ctx := context.Background()
	schema := fmt.Sprintf("migration_%d", time.Now().UnixNano())
	if _, err := base.db.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = base.db.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") })
	u, err := url.Parse(os.Getenv("DATABASE_URL_TEST"))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, err := postgres.OpenDB(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := postgres.Migrate(ctx, db.Pool(), 9021042, "d2e_schema_migrations", Migrations[:1]); err != nil {
		t.Fatal(err)
	}
	original := domain.NewDefaultWorld(time.Now())
	original.Sessions["migration_token"] = "archon_demo"
	original.Players["archon_demo"].ResourcesMilli[domain.ResWater] = 123_456
	raw, err := json.Marshal(original)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO d2e_world_state(realm_id,state_json) VALUES ('realm-main',$1::jsonb)`, string(raw)); err != nil {
		t.Fatal(err)
	}
	upgraded := NewStore(db)
	if err := upgraded.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := upgraded.Migrate(ctx); err != nil {
		t.Fatal("migration is not repeatable:", err)
	}
	if err := upgraded.WithinTx(ctx, func(tx context.Context) error {
		w, err := upgraded.LoadWorld(tx, time.Now())
		if err != nil {
			return err
		}
		if len(w.Players) != len(original.Players) {
			t.Fatal("players lost in migration")
		}
		p, admin, err := upgraded.LoadSessionPlayer(tx, "migration_token")
		if err != nil {
			return err
		}
		if admin || p.ResourcesMilli[domain.ResWater] != 123_456 || p.PasswordHash != original.Players[p.Handle].PasswordHash || w.TotalIssuedBasis != original.TotalIssuedBasis {
			t.Fatal("migration changed assets/auth/ledger")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestConcurrentRetriesApplyOnePersistedRaidCommand(t *testing.T) {
	s := integrationStore(t)
	seedRegressionWorld(t, s, 1)
	ctx := context.Background()
	var id string
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		p, _, err := s.LoadSessionPlayer(tx, "token_isolated_000")
		if err != nil {
			return err
		}
		sess := p.RaidLoadout.ActiveSession
		id = sess.RaidID
		sess.Zones[0].Tiles[3*sess.Zones[0].Width+2].Kind = "empty"
		return s.SavePlayer(tx, p)
	}); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 8)
	for i := 0; i < 8; i++ {
		go func() {
			done <- s.WithinTx(ctx, func(tx context.Context) error {
				p, _, err := s.LoadSessionPlayer(tx, "token_isolated_000")
				if err != nil {
					return err
				}
				if err := domain.ApplyRaidCommand(p, id, 1, domain.RaidCommand{Action: "move", DX: 1}, time.Now()); err != nil {
					return err
				}
				return s.SavePlayer(tx, p)
			})
		}()
	}
	for i := 0; i < 8; i++ {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		p, _, err := s.LoadSessionPlayer(tx, "token_isolated_000")
		if err != nil {
			return err
		}
		if p.RaidLoadout.ActiveSession.PlayerX != 2 || p.RaidLoadout.ActiveSession.LastCommandSeq != 1 {
			t.Fatal("concurrent retries applied twice")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func seedRegressionWorld(t testing.TB, s *Store, n int) {
	t.Helper()
	err := s.WithinTx(context.Background(), func(ctx context.Context) error {
		w, err := s.LoadWorld(ctx, time.Now())
		if err != nil {
			return err
		}
		for i := 0; i < n; i++ {
			handle := fmt.Sprintf("isolated_%03d", i)
			p := domain.NewBlankPlayer(handle, time.Now())
			p.UnlockedBlueprints[domain.BPScoutCamp] = true
			if err := domain.StartRaid(p, time.Now()); err != nil {
				return err
			}
			w.Players[handle] = p
			w.Sessions["token_"+handle] = handle
		}
		return s.SaveWorld(ctx, w)
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestEveryFillAuditedAndAuditFailureRollsBackAssets(t *testing.T) {
	s := integrationStore(t)
	ctx := context.Background()
	seedRegressionWorld(t, s, 1)
	prefix := fmt.Sprintf("batch_%d_", time.Now().UnixNano())
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, time.Now())
		if err != nil {
			return err
		}
		for i := 0; i < 65; i++ {
			w.PendingTrades = append(w.PendingTrades, domain.MarketTrade{ID: fmt.Sprintf("%s%d", prefix, i), ItemKey: domain.ResWater, PriceBasis: 1000, QuantityMilli: 1000, TotalGoldBasis: 1000})
		}
		w.Trades = append([]domain.MarketTrade{}, w.PendingTrades[5:]...)
		return s.SaveWorld(tx, w)
	}); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM d2e_trades_audit WHERE trade_id LIKE $1`, prefix+"%").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 65 {
		t.Fatalf("audited %d/65 fills", count)
	}

	_, err := s.db.Exec(ctx, `ALTER TABLE d2e_trades_audit ADD CONSTRAINT test_audit_failure CHECK(trade_id <> 'fail_audit')`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = s.db.Exec(ctx, `ALTER TABLE d2e_trades_audit DROP CONSTRAINT test_audit_failure`) })
	err = s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, time.Now())
		if err != nil {
			return err
		}
		w.Players["isolated_000"].ResourcesMilli[domain.ResWater] = 777_777
		w.PendingTrades = []domain.MarketTrade{{ID: "fail_audit"}}
		return s.SaveWorld(tx, w)
	})
	if err == nil {
		t.Fatal("audit failure ignored")
	}
	err = s.WithinTx(ctx, func(tx context.Context) error {
		p, _, err := s.LoadSessionPlayer(tx, "token_isolated_000")
		if err != nil {
			return err
		}
		if p.ResourcesMilli[domain.ResWater] != 0 {
			t.Fatal("asset write committed without audit")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestPendingCollectiblesAuditedIncrementally(t *testing.T) {
	s := integrationStore(t)
	ctx := context.Background()
	now := time.Now().UTC()

	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		p := domain.NewBlankPlayer("collectible-test", now)
		w.Players[p.Handle] = p
		p.ResourcesMilli[domain.ResSeasonChest] = domain.ResourceScale
		if err := domain.OpenSeasonChest(w, p, 0, now); err != nil {
			return err
		}
		if len(w.PendingCollectibles) != 1 {
			t.Fatalf("expected 1 pending collectible, got %d", len(w.PendingCollectibles))
		}
		return s.SaveWorld(tx, w)
	}); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM d2e_collectibles_audit`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected 1 audited collectible, got %d", count)
	}
}

func TestRaidPlayerLockDoesNotBlockOtherPlayersOrRequireRealmLock(t *testing.T) {
	s := integrationStore(t)
	seedRegressionWorld(t, s, 2)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	locked := make(chan struct{})
	release := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- s.WithinTx(ctx, func(tx context.Context) error {
			// Hold the realm and player 0 locks. Player 1's raid still has to proceed.
			if _, err := s.db.Exec(tx, `SELECT realm_id FROM d2e_world_state WHERE realm_id='realm-main' FOR UPDATE`); err != nil {
				return err
			}
			if _, _, err := s.LoadSessionPlayer(tx, "token_isolated_000"); err != nil {
				return err
			}
			close(locked)
			<-release
			return nil
		})
	}()
	select {
	case <-locked:
	case err := <-done:
		t.Fatal(err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	otherCtx, otherCancel := context.WithTimeout(ctx, 2*time.Second)
	err := s.WithinTx(otherCtx, func(tx context.Context) error {
		p, _, err := s.LoadSessionPlayer(tx, "token_isolated_001")
		if err != nil {
			return err
		}
		p.RaidLoadout.ActiveSession.HP = 42
		return s.SavePlayer(tx, p)
	})
	otherCancel()
	close(release)
	lockErr := <-done
	if err != nil || lockErr != nil {
		t.Fatalf("independent raid blocked: other=%v lock=%v", err, lockErr)
	}
	if err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, time.Now())
		if err != nil {
			return err
		}
		if w.Players["isolated_001"].RaidLoadout.ActiveSession.HP != 42 {
			t.Fatal("world read lost isolated update")
		}
		return s.SaveWorld(tx, w)
	}); err != nil {
		t.Fatal(err)
	}
	var raw []byte
	if err := s.db.QueryRow(ctx, `SELECT state_json FROM d2e_world_state WHERE realm_id='realm-main'`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var meta map[string]json.RawMessage
	if err := json.Unmarshal(raw, &meta); err != nil {
		t.Fatal(err)
	}
	if string(meta["players"]) != "null" {
		t.Fatal("realm still embeds player snapshots")
	}
}

func BenchmarkSinglePlayerPersistence(b *testing.B) {
	for _, n := range []int{1, 10, 100} {
		b.Run(fmt.Sprintf("players_%d", n), func(b *testing.B) {
			s := integrationStore(b)
			seedRegressionWorld(b, s, n)
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				if err := s.WithinTx(context.Background(), func(tx context.Context) error {
					p, _, err := s.LoadSessionPlayer(tx, "token_isolated_000")
					if err != nil {
						return err
					}
					return s.SavePlayer(tx, p)
				}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
