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

	// 1. GET /api/v1/empire/state
	req := httptest.NewRequest(http.MethodGet, "/api/v1/empire/state", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
	var state empire.DashboardStateResp
	if err := json.Unmarshal(rec.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	if state.Player.Handle != "pioneer" {
		t.Fatalf("expected active handle pioneer, got %s", state.Player.Handle)
	}

	// 2. POST /api/v1/empire/production/gather-water (10 clicks)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/gather-water", strings.NewReader(`{"clicks":10}`))
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec2.Code)
	}

	// 3. POST /api/v1/empire/production/recruit
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/recruit", strings.NewReader(`{"count":1}`))
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec3.Code, rec3.Body.String())
	}

	// 4. POST /api/v1/empire/debug/benchmark-30m
	req4 := httptest.NewRequest(http.MethodPost, "/api/v1/empire/debug/benchmark-30m", strings.NewReader(`{}`))
	rec4 := httptest.NewRecorder()
	h.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec4.Code)
	}
}
