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

func TestHTTPConstructionContractDoesNotGrantFacilityOnResearch(t *testing.T) {
	now := time.Now()
	w := domain.NewDefaultWorld(now)
	p := w.Players["pioneer"]
	p.PopulationTotal = 4
	p.ResourcesMilli[domain.ResWater] = 200000
	p.ResourcesMilli[domain.ResWood] = 50000
	w.Sessions["construction-test"] = "pioneer"
	mem := &fakeMemStore{w: w}
	h := NewHTTPHandler(app.NewService(mem, mem), nil)
	request := func(path, body string, status int) empire.DashboardStateResp {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		req.Header.Set("X-Session-Token", "construction-test")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != status {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
		}
		var resp empire.DashboardStateResp
		if status == 200 {
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatal(err)
			}
		}
		return resp
	}
	request("/api/v1/empire/settlement/build", `{"code":"lumber_camp","quantity":1,"commandSeq":1}`, 422)
	resp := request("/api/v1/empire/settlement/research", `{"code":"woodworking","commandSeq":1}`, 200)
	if resp.Settlement.CommandSeq != 1 || resp.Settlement.HousingCapacity != 4 {
		t.Fatal("missing authoritative construction state")
	}
	for _, j := range resp.Jobs {
		if j.JobKey == domain.JobWood && (j.Unlocked || j.Capacity != 0) {
			t.Fatal("research granted production")
		}
	}
	for _, b := range resp.Settlement.Buildings {
		if b.Owned != 0 {
			t.Fatal("research granted an asset")
		}
	}
	resp = request("/api/v1/empire/settlement/build", `{"code":"lumber_camp","quantity":1,"commandSeq":2}`, 200)
	for _, j := range resp.Jobs {
		if j.JobKey == domain.JobWood && (!j.Unlocked || j.Capacity != 3 || j.Assigned != 0) {
			t.Fatal("building did not provide empty slots")
		}
	}
	request("/api/v1/empire/settlement/build", `{"code":"lumber_camp","quantity":1,"commandSeq":2}`, 200)
	if p.BuildingCounts[domain.BuildingLumberCamp] != 1 {
		t.Fatal("HTTP retry duplicated building")
	}
	request("/api/v1/empire/progression/unlock-blueprint", `{"code":"water_cistern"}`, 422)
	request("/api/v1/empire/settlement/build", `{"code":"lumber_camp","quantity":-1,"commandSeq":3}`, 422)
	request("/api/v1/empire/production/allocate", `{"mode":"delta","entries":[{"jobKey":"wood","count":4}]}`, 422)
}

func TestOpeningDisclosureAndGuidePersistAfterSpending(t *testing.T) {
	w := domain.NewDefaultWorld(time.Now())
	p := w.Players["pioneer"]
	w.ActiveHandle = p.Handle
	resp := mapDashboardResp(w)
	if len(resp.Settlement.Technologies) != 0 || len(resp.Settlement.Buildings) != 0 {
		t.Fatal("opening leaks future plans")
	}
	p.PopulationTotal = 2
	domain.RefreshSettlementDiscovery(p)
	resp = mapDashboardResp(w)
	if len(resp.Settlement.Technologies) != 1 || resp.Settlement.Technologies[0].Code != domain.TechWoodworking {
		t.Fatal("early technology disclosure incorrect")
	}
	p.BuildingCounts[domain.BuildingQuarry] = 1
	p.UnlockedBlueprints[domain.BPQuarryTech] = true
	p.ResourcesMilli[domain.ResAncientShard] = 1000
	domain.RefreshSettlementDiscovery(p)
	p.ResourcesMilli[domain.ResAncientShard] = 0
	resp = mapDashboardResp(w)
	for _, r := range resp.Resources {
		if r.Key == domain.ResAncientShard && !r.Unlocked {
			t.Fatal("spent resource disappeared")
		}
	}
	guide := resp.Settlement.GuideCode
	domain.ApplyFocusAllocation(p, domain.JobWater)
	if mapDashboardResp(w).Settlement.GuideCode != guide {
		t.Fatal("chapter regressed after worker reassignment")
	}
}
