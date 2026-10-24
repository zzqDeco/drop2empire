package httpadapter

import (
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

func TestPublicRaidIdentityReplayFogAndPayload(t *testing.T) {
	w := domain.NewDefaultWorld(time.Now())
	w.Sessions["player_token"] = "archon_demo"
	w.Sessions["other_token"] = "pioneer"
	mem := &fakeMemStore{w: w}
	h := NewHTTPHandler(app.NewService(mem, mem), nil)
	post := func(path, token, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/empire/colony/raid/"+path, strings.NewReader(body))
		req.Header.Set("X-Session-Token", token)
		req.Header.Set("X-Admin-Tunnel", "0")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	start := post("start", "player_token", "{}")
	if start.Code != 200 {
		t.Fatal(start.Body.String())
	}
	var initial empire.DashboardStateResp
	if err := json.Unmarshal(start.Body.Bytes(), &initial); err != nil {
		t.Fatal(err)
	}
	id := initial.RaidLoadout.ActiveSession.RaidId
	if id == "" || strings.Contains(start.Body.String(), `"seed"`) || strings.Contains(start.Body.String(), `"activeRaidSeed"`) {
		t.Fatal("map seed exposed or opaque identity absent")
	}
	if post("start", "player_token", "{}").Code == 200 {
		t.Fatal("active raid restarted")
	}
	body := fmt.Sprintf(`{"raidId":%q,"commandSeq":1,"action":"move","dx":1,"dy":0}`, id)
	if post("action", "other_token", body).Code == 200 {
		t.Fatal("another account mutated raid")
	}
	var delta empire.RaidUpdateResp
	for i := 0; i < 2; i++ {
		rec := post("action", "player_token", body)
		if rec.Code != 200 {
			t.Fatal(rec.Body.String())
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &delta); err != nil {
			t.Fatal(err)
		}
		if delta.RaidLoadout.ActiveSession.PlayerX != 2 {
			t.Fatal("replayed move applied twice")
		}
		if len(delta.RaidLoadout.ActiveSession.Zones) != 1 || rec.Body.Len() > 40_000 {
			t.Fatalf("move payload too large: %d", rec.Body.Len())
		}
		if i == 0 {
			t.Logf("move response=%d bytes; start response=%d bytes", rec.Body.Len(), start.Body.Len())
		}
	}
	if post("finish", "player_token", fmt.Sprintf(`{"raidId":%q,"commandSeq":2,"status":"EXTRACTED","backpack":[{"key":"cos_astral_wings"}]}`, id)).Code == 200 {
		t.Fatal("client loot accepted")
	}
	finish := fmt.Sprintf(`{"raidId":%q,"commandSeq":2,"status":"MIA"}`, id)
	if rec := post("finish", "player_token", finish); rec.Code != 200 {
		t.Fatal(rec.Body.String())
	}
	next := post("start", "player_token", "{}")
	if next.Code != 200 {
		t.Fatal(next.Body.String())
	}
	newID := mem.w.Players["archon_demo"].RaidLoadout.ActiveSession.RaidID
	if rec := post("finish", "player_token", finish); rec.Code != 200 {
		t.Fatal(rec.Body.String())
	}
	if mem.w.Players["archon_demo"].RaidLoadout.ActiveSession.RaidID != newID {
		t.Fatal("old finish terminated next raid")
	}
}

func TestRaidLimiterBoundsBurstAndRecovers(t *testing.T) {
	l := &raidLimiter{}
	now := time.Now()
	accepted := 0
	for i := 0; i < 100; i++ {
		if l.allow("token", now) {
			accepted++
		}
	}
	if accepted != 20 {
		t.Fatalf("burst accepted %d, expected 20", accepted)
	}
	if !l.allow("token", now.Add(time.Second)) {
		t.Fatal("limiter failed to recover")
	}
	for i := 0; i < 5000; i++ {
		l.allow(fmt.Sprint(i), now.Add(2*time.Second))
	}
	if len(l.debt) > 4096 {
		t.Fatal("limiter cache unbounded")
	}
}
