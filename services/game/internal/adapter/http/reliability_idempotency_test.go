package httpadapter

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
)

func TestIdempotencyKeyPreventsDoubleRedeemAndDoubleCraft(t *testing.T) {
	now := time.Now().UTC()
	w := domain.NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	p.ActivityPoints = 210
	p.ResourcesMilli[domain.ResSeasonChest] = 0
	p.Profession = domain.ProfArtisan
	p.ResourcesMilli[domain.ResIronIngot] = 200 * domain.ResourceScale
	p.ResourcesMilli[domain.ResRation] = 200 * domain.ResourceScale
	p.ResourcesMilli[domain.ResInfantryKit] = 0
	w.Sessions["tok_demo"] = "archon_demo"

	mem := &fakeMemStore{w: w}
	h := NewHTTPHandler(app.NewService(mem, mem), nil)

	post := func(path, idemKey, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		req.Header.Set("X-Session-Token", "tok_demo")
		req.Header.Set("X-Admin-Tunnel", "0")
		if idemKey != "" {
			req.Header.Set("X-Idempotency-Key", idemKey)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	// 1. Replay identical redeem-chest POST twice (simulates H2/proxy transport replay after commit)
	for i := 0; i < 2; i++ {
		rec := post("/api/v1/empire/season/redeem-chest", "redeem-click-1", `{"count":1}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("redeem attempt %d failed (%d): %s", i+1, rec.Code, rec.Body.String())
		}
	}
	if p.ActivityPoints != 110 {
		t.Fatalf("expected 110 activity points after deduplicated single redeem, got %d", p.ActivityPoints)
	}
	if gotChests := p.ResourcesMilli[domain.ResSeasonChest]; gotChests != domain.ResourceScale {
		t.Fatalf("expected exactly 1 chest (%d milli), got %d", domain.ResourceScale, gotChests)
	}

	// 2. A fresh distinct X-Idempotency-Key executes normally
	rec2 := post("/api/v1/empire/season/redeem-chest", "redeem-click-2", `{"count":1}`)
	if rec2.Code != http.StatusOK {
		t.Fatalf("distinct redeem failed: %s", rec2.Body.String())
	}
	if p.ActivityPoints != 10 || p.ResourcesMilli[domain.ResSeasonChest] != 2*domain.ResourceScale {
		t.Fatalf("expected second distinct redeem to apply (pts=10, chests=2), got pts=%d chests=%d",
			p.ActivityPoints, p.ResourcesMilli[domain.ResSeasonChest])
	}

	// 3. Replay identical global CraftItem POST twice (Agent 09 double-manufacture regression)
	for i := 0; i < 2; i++ {
		rec := post("/api/v1/empire/crafting/craft", "craft-click-1", `{"recipeCode":"craft_infantry_kit","batches":10}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("craft attempt %d failed (%d): %s", i+1, rec.Code, rec.Body.String())
		}
	}
	// Artisan 10 batches = 25 infantry kits (25_000 milli), NOT 50 kits!
	if got := p.ResourcesMilli[domain.ResInfantryKit]; got != 25*domain.ResourceScale {
		t.Fatalf("expected 25_000 milli infantry kits after deduplicated craft, got %d", got)
	}
}

func TestSinglePlayerPathIsolatesBystanderAndPopulatesServerTimestamps(t *testing.T) {
	now := time.Now().UTC()
	w := domain.NewDefaultWorld(now)
	w.LastWarPeriod = domain.WarPeriod(now)
	w.Economy.LastTick = now.Truncate(time.Minute)

	bystander := w.Players["pioneer"]
	bystander.Revision = 42
	bystander.GoldBasis = 500 * domain.GoldScale
	w.TotalIssuedBasis += 500 * domain.GoldScale

	w.Sessions["tok_archon"] = "archon_demo"
	mem := &fakeMemStore{w: w}
	h := NewHTTPHandler(app.NewService(mem, mem), nil)

	// Single-player GET /state must not bump bystander's revision and must expose serverNowUnixMs + macro gold sum
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/empire/state", nil)
	getReq.Header.Set("X-Session-Token", "tok_archon")
	getReq.Header.Set("X-Admin-Tunnel", "0")
	getRec := httptest.NewRecorder()
	h.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /state failed: %s", getRec.Body.String())
	}
	var dash empire.DashboardStateResp
	if err := json.Unmarshal(getRec.Body.Bytes(), &dash); err != nil {
		t.Fatal(err)
	}
	if dash.ServerNowUnixMs == nil || *dash.ServerNowUnixMs <= 0 {
		t.Fatalf("expected positive serverNowUnixMs on DashboardStateResp, got %v", dash.ServerNowUnixMs)
	}
	if dash.MacroLedger.PlayerHeldBasis < 500*domain.GoldScale {
		t.Fatalf("expected cached macro ledger to include bystander gold, got %d", dash.MacroLedger.PlayerHeldBasis)
	}
	if bystander.Revision != 42 {
		t.Fatalf("expected bystander revision to stay 42 during archon GET /state, got %d", bystander.Revision)
	}

	// Single-player raid start populates authoritative serverNowUnixMs & expiresAtUnixMs
	startReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/start", strings.NewReader(`{}`))
	startReq.Header.Set("X-Session-Token", "tok_archon")
	startReq.Header.Set("X-Admin-Tunnel", "0")
	startReq.Header.Set("X-Idempotency-Key", "start-raid-1")
	startRec := httptest.NewRecorder()
	h.ServeHTTP(startRec, startReq)
	if startRec.Code != http.StatusOK {
		t.Fatalf("start raid failed: %s", startRec.Body.String())
	}
	var started empire.DashboardStateResp
	if err := json.Unmarshal(startRec.Body.Bytes(), &started); err != nil {
		t.Fatal(err)
	}
	sess := started.RaidLoadout.ActiveSession
	if sess == nil || sess.ServerNowUnixMs == nil || sess.ExpiresAtUnixMs == nil {
		t.Fatalf("expected authoritative timestamps on RaidSessionDTO, got %+v", sess)
	}
	diff := (*sess.ExpiresAtUnixMs - *sess.ServerNowUnixMs) - sess.TimeRemainingMs
	if diff < -50 || diff > 50 {
		t.Fatalf("expected expiresAtUnixMs - serverNowUnixMs to match timeRemainingMs within 50ms, diff=%d", diff)
	}
	if bystander.Revision != 42 {
		t.Fatalf("expected bystander revision to remain untouched at 42 after archon raid start, got %d", bystander.Revision)
	}
}
