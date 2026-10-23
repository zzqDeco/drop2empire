package httpadapter

import (
	"context"
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

	// 2. Register a brand-new player account -> starts at 0 water, 0 pop, 0 clicks
	regReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/register", strings.NewReader(`{"handle":"newbie_lord","password":"password123"}`))
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

	// 3. POST /api/v1/empire/production/gather-water (10 clicks)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/gather-water", strings.NewReader(`{"clicks":10}`))
	req2.Header.Set("X-Session-Token", playerToken)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec2.Code)
	}

	// 4. POST /api/v1/empire/production/recruit
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/recruit", strings.NewReader(`{"count":1}`))
	req3.Header.Set("X-Session-Token", playerToken)
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec3.Code, rec3.Body.String())
	}

	// 5. Normal player cannot call admin-only benchmark-30m (403 Forbidden)
	req4 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/debug/benchmark-30m", strings.NewReader(`{}`))
	req4.Header.Set("X-Session-Token", playerToken)
	rec4 := httptest.NewRecorder()
	h.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for normal player calling benchmark, got %d", rec4.Code)
	}

	// 6. Login as admin -> can call benchmark-30m and simulation controls
	adminLoginReq := httptest.NewRequest(http.MethodPost, "/api/v1/empire/auth/login", strings.NewReader(`{"handle":"admin","password":"admin123456"}`))
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

	req5 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/debug/benchmark-30m", strings.NewReader(`{}`))
	req5.Header.Set("X-Session-Token", adminToken)
	rec5 := httptest.NewRecorder()
	h.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin benchmark, got %d: %s", rec5.Code, rec5.Body.String())
	}
}
