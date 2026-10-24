package httpadapter

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
)

type fakeMemStore struct {
	w *domain.WorldState
}

func (f *fakeMemStore) WithinTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

func (f *fakeMemStore) LoadWorld(_ context.Context, now time.Time) (*domain.WorldState, error) {
	if f.w == nil {
		f.w = domain.NewDefaultWorld(now)
	}
	return f.w, nil
}

func (f *fakeMemStore) SaveWorld(_ context.Context, world *domain.WorldState) error {
	f.w = world
	return nil
}

func (f *fakeMemStore) LoadSessionPlayer(_ context.Context, token string) (*domain.PlayerState, bool, error) {
	raw := f.w.Sessions[token]
	admin := raw == "admin" || strings.HasPrefix(raw, "admin::")
	handle := strings.TrimPrefix(raw, "admin::")
	p := f.w.Players[handle]
	if p == nil {
		return nil, false, domain.ErrUnauthorized("invalid session")
	}
	return p, admin || p.IsAdmin, nil
}
func (f *fakeMemStore) SavePlayer(_ context.Context, p *domain.PlayerState) error {
	p.Revision++
	f.w.Players[p.Handle] = p
	return nil
}

func TestHTTPAdapterEndToEndFlow(t *testing.T) {
	mem := &fakeMemStore{}
	svc := app.NewService(mem, mem)
	h := NewHTTPHandler(svc, nil)

	// 1. Unauthenticated GET /api/v1/empire/state returns 401
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/v1/empire/state", nil)
	unauthRec := httptest.NewRecorder()
	h.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized without session token, got %d", unauthRec.Code)
	}

	// 2. Admin login from public surface (X-Admin-Tunnel: 0) is rejected with 403 Forbidden
	pubAdminReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/login", strings.NewReader(`{"handle":"admin","password":"admin123456"}`))
	pubAdminReq.Header.Set("X-Admin-Tunnel", "0")
	pubAdminRec := httptest.NewRecorder()
	h.ServeHTTP(pubAdminRec, pubAdminReq)
	if pubAdminRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for admin login on public surface, got %d", pubAdminRec.Code)
	}

	// 3. Login as admin via SSH tunnel -> create a one-time invite code
	adminLoginReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/login", strings.NewReader(`{"handle":"admin","password":"admin123456"}`))
	adminLoginReq.Header.Set("X-Admin-Tunnel", "1")
	adminLoginRec := httptest.NewRecorder()
	h.ServeHTTP(adminLoginRec, adminLoginReq)
	if adminLoginRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on admin login, got %d: %s", adminLoginRec.Code, adminLoginRec.Body.String())
	}
	var adminState empire.DashboardStateResp
	if err := json.Unmarshal(adminLoginRec.Body.Bytes(), &adminState); err != nil {
		t.Fatal(err)
	}
	if !adminState.Player.IsAdmin || adminState.SessionToken == nil {
		t.Fatalf("expected admin account with sessionToken, got %+v", adminState.Player)
	}
	adminToken := *adminState.SessionToken

	invReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/admin/invites", strings.NewReader(`{}`))
	invReq.Header.Set("X-Session-Token", adminToken)
	invReq.Header.Set("X-Admin-Tunnel", "1")
	invRec := httptest.NewRecorder()
	h.ServeHTTP(invRec, invReq)
	if invRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on create invite, got %d: %s", invRec.Code, invRec.Body.String())
	}
	var invState empire.DashboardStateResp
	if err := json.Unmarshal(invRec.Body.Bytes(), &invState); err != nil {
		t.Fatal(err)
	}
	if invState.CreatedInviteCode == nil || *invState.CreatedInviteCode == "" {
		t.Fatal("expected createdInviteCode in response")
	}
	inviteCode := *invState.CreatedInviteCode

	// 4. Register without valid invite code fails
	badRegReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/register", strings.NewReader(`{"handle":"newbie_lord","password":"password123","inviteCode":"wrong-code"}`))
	badRegRec := httptest.NewRecorder()
	h.ServeHTTP(badRegRec, badRegReq)
	if badRegRec.Code == http.StatusOK {
		t.Fatal("expected registration with invalid invite code to fail")
	}

	// 5. Register a brand-new player account with the valid invite code -> starts at 0 water, 0 pop, 0 clicks
	regReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/register", strings.NewReader(`{"handle":"newbie_lord","password":"password123","inviteCode":"`+inviteCode+`"}`))
	regRec := httptest.NewRecorder()
	h.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on register, got %d: %s", regRec.Code, regRec.Body.String())
	}
	var regState empire.DashboardStateResp
	if err := json.Unmarshal(regRec.Body.Bytes(), &regState); err != nil {
		t.Fatal(err)
	}
	if regState.Player.Handle != "newbie_lord" || regState.Player.IsAdmin {
		t.Fatalf("unexpected player profile: %+v", regState.Player)
	}
	if regState.SessionToken == nil || *regState.SessionToken == "" {
		t.Fatal("expected sessionToken on register response")
	}
	playerToken := *regState.SessionToken

	// 6. Reusing the same invite code fails (one-time use)
	reuseReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/register", strings.NewReader(`{"handle":"second_lord","password":"password123","inviteCode":"`+inviteCode+`"}`))
	reuseRec := httptest.NewRecorder()
	h.ServeHTTP(reuseRec, reuseReq)
	if reuseRec.Code == http.StatusOK {
		t.Fatal("expected reused invite code to be rejected")
	}

	// 7. POST /api/v1/empire/production/gather-water (10 clicks)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/gather-water", strings.NewReader(`{"clicks":10}`))
	req2.Header.Set("X-Session-Token", playerToken)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec2.Code)
	}

	// 8. POST /api/v1/empire/production/recruit
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/recruit", strings.NewReader(`{"count":1}`))
	req3.Header.Set("X-Session-Token", playerToken)
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec3.Code, rec3.Body.String())
	}

	// 9. Normal player cannot call admin-only benchmark-30m (403 Forbidden)
	req4 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/admin/benchmark-30m", strings.NewReader(`{}`))
	req4.Header.Set("X-Session-Token", playerToken)
	rec4 := httptest.NewRecorder()
	h.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for normal player calling benchmark, got %d", rec4.Code)
	}

	// 10. Admin can switch account to inspect newbie_lord while retaining admin privileges
	swReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/account/switch", strings.NewReader(`{"handle":"newbie_lord"}`))
	swReq.Header.Set("X-Session-Token", adminToken)
	swReq.Header.Set("X-Admin-Tunnel", "1")
	swRec := httptest.NewRecorder()
	h.ServeHTTP(swRec, swReq)
	if swRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin switch account, got %d: %s", swRec.Code, swRec.Body.String())
	}
	var swState empire.DashboardStateResp
	if err := json.Unmarshal(swRec.Body.Bytes(), &swState); err != nil {
		t.Fatal(err)
	}
	if swState.Player.Handle != "newbie_lord" || !swState.Player.IsAdmin {
		t.Fatalf("expected admin inspecting newbie_lord with isAdmin=true, got %+v", swState.Player)
	}

	req5 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/admin/benchmark-30m", strings.NewReader(`{}`))
	req5.Header.Set("X-Session-Token", adminToken)
	req5.Header.Set("X-Admin-Tunnel", "1")
	rec5 := httptest.NewRecorder()
	h.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin benchmark, got %d: %s", rec5.Code, rec5.Body.String())
	}

	// 11. Anti-macro gather-water batch cap (clicks > 10 rejected with 422 Unprocessable Entity)
	macroReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/gather-water", strings.NewReader(`{"clicks":50}`))
	macroReq.Header.Set("X-Session-Token", playerToken)
	macroRec := httptest.NewRecorder()
	h.ServeHTTP(macroRec, macroReq)
	if macroRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 Unprocessable Entity for clicks=50 anti-macro cap, got %d", macroRec.Code)
	}

	// 12. Server-authoritative 2D Wasteland Raid lifecycle & zero-trust fog-of-war clipping
	// Switch admin to archon_demo (who has Scout Camp unlocked) and start a raid
	swVetReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/account/switch", strings.NewReader(`{"handle":"archon_demo"}`))
	swVetReq.Header.Set("X-Session-Token", adminToken)
	swVetReq.Header.Set("X-Admin-Tunnel", "1")
	swVetRec := httptest.NewRecorder()
	h.ServeHTTP(swVetRec, swVetReq)
	if swVetRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK switching to archon_demo, got %d", swVetRec.Code)
	}

	startRaidReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/start", strings.NewReader(`{}`))
	startRaidReq.Header.Set("X-Session-Token", adminToken)
	startRaidReq.Header.Set("X-Admin-Tunnel", "1")
	startRaidRec := httptest.NewRecorder()
	h.ServeHTTP(startRaidRec, startRaidReq)
	if startRaidRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on raid/start, got %d: %s", startRaidRec.Code, startRaidRec.Body.String())
	}
	var raidStartState empire.DashboardStateResp
	if err := json.Unmarshal(startRaidRec.Body.Bytes(), &raidStartState); err != nil {
		t.Fatal(err)
	}
	sess := raidStartState.RaidLoadout.ActiveSession
	if sess == nil || len(sess.Zones) != 4 {
		t.Fatalf("expected activeSession with 4 zones, got %+v", sess)
	}
	// Verify fog-of-war clipping: distant tile (10,6) in Zone 0 must be clipped to kind="fog"
	z0 := sess.Zones[0]
	distantTile := z0.Tiles[6*int(z0.Width)+10]
	if distantTile.Explored || distantTile.Kind != "fog" {
		t.Fatalf("expected distant unexplored tile (10,6) to be clipped to kind=fog, got explored=%v kind=%s", distantTile.Explored, distantTile.Kind)
	}

	// Verify teleport move (dx=5, dy=0) is rejected with 400 Bad Request
	teleReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/action", strings.NewReader(fmt.Sprintf(`{"action":"move","dx":5,"dy":0,"raidId":%q,"commandSeq":1}`, sess.RaidId)))
	teleReq.Header.Set("X-Session-Token", adminToken)
	teleReq.Header.Set("X-Admin-Tunnel", "1")
	teleRec := httptest.NewRecorder()
	h.ServeHTTP(teleRec, teleReq)
	if teleRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for teleport move dx=5, got %d", teleRec.Code)
	}

	// Valid 1-tile move (dx=1, dy=0) -> player moves from (1,3) to (2,3)
	moveReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/action", strings.NewReader(fmt.Sprintf(`{"action":"move","dx":1,"dy":0,"raidId":%q,"commandSeq":1}`, sess.RaidId)))
	moveReq.Header.Set("X-Session-Token", adminToken)
	moveReq.Header.Set("X-Admin-Tunnel", "1")
	moveRec := httptest.NewRecorder()
	h.ServeHTTP(moveRec, moveReq)
	if moveRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid 1-tile move, got %d: %s", moveRec.Code, moveRec.Body.String())
	}
	var movedState empire.DashboardStateResp
	if err := json.Unmarshal(moveRec.Body.Bytes(), &movedState); err != nil {
		t.Fatal(err)
	}
	if movedState.RaidLoadout.ActiveSession.PlayerX != 2 || movedState.RaidLoadout.ActiveSession.PlayerY != 3 {
		t.Fatalf("expected player at (2,3) after move, got (%d,%d)",
			movedState.RaidLoadout.ActiveSession.PlayerX, movedState.RaidLoadout.ActiveSession.PlayerY)
	}

	// Attempt to claim "EXTRACTED" while standing at (2,3) (far from extraction beacon at (10,1)):
	// Server must enforce MIA!
	finReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/finish", strings.NewReader(fmt.Sprintf(`{"status":"EXTRACTED","raidId":%q,"commandSeq":2}`, sess.RaidId)))
	finReq.Header.Set("X-Session-Token", adminToken)
	finReq.Header.Set("X-Admin-Tunnel", "1")
	finRec := httptest.NewRecorder()
	h.ServeHTTP(finRec, finReq)
	if finRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on raid/finish, got %d: %s", finRec.Code, finRec.Body.String())
	}
	var finState empire.DashboardStateResp
	if err := json.Unmarshal(finRec.Body.Bytes(), &finState); err != nil {
		t.Fatal(err)
	}
	if finState.RaidLoadout.LastSettlementReport == nil || finState.RaidLoadout.LastSettlementReport.Status != "MIA" {
		t.Fatalf("expected server to enforce MIA when claiming EXTRACTED away from beacon, got %+v", finState.RaidLoadout.LastSettlementReport)
	}
}
