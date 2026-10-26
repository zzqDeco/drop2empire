package httpadapter

import (
	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestEconomyHTTPPoliciesIsolationAndRetry(t *testing.T) {
	w := domain.NewDefaultWorld(time.Now())
	w.Sessions["operator"] = "admin"
	w.Sessions["player"] = "archon_demo"
	mem := &fakeMemStore{w: w}
	h := NewHTTPHandler(app.NewService(mem, mem), nil)
	request := func(token, tunnel, path, body string, status int) empire.DashboardStateResp {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		r.Header.Set("X-Session-Token", token)
		r.Header.Set("X-Admin-Tunnel", tunnel)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		if rec.Code != status {
			t.Fatalf("%s got %d: %s", path, rec.Code, rec.Body.String())
		}
		var state empire.DashboardStateResp
		if status == 200 {
			if err := json.Unmarshal(rec.Body.Bytes(), &state); err != nil {
				t.Fatal(err)
			}
		}
		return state
	}
	path := "/api/v1/empire/admin/economy/policy"
	body := `{"policyId":"policy-http","action":"issue","amountBasis":1000000,"itemKey":"","quantityMilli":0,"priceBasis":0}`
	request("player", "1", path, body, 403)
	request("operator", "0", path, body, 403)
	request("operator", "1", path, body, 200)
	state := request("operator", "1", path, body, 200)
	if state.Economy.IssuedBasis != 1000000 || w.TotalIssuedBasis != 1000000 {
		t.Fatal("HTTP retry issued twice")
	}
	request("player", "1", "/api/v1/empire/admin/economy/company", `{"companyId":"alloy","shares":1000,"priceBasis":1000,"minimumShares":500,"durationHours":1}`, 403)
	p := w.Players["archon_demo"]
	for _, r := range domain.ResourceCatalog {
		p.ResourcesMilli[r.Key] = 1_000_000
	}
	cmd := `{"commandSeq":1,"action":"build_facility","target":"","option":"","quantity":0,"voteId":0,"approve":false,"plan":{"route":"standard","activeLines":1,"askPriceBasis":0,"inputBudgetBasis":0,"pack":"","expandWith":"","dividendBasis":0,"capitalBudgetBasis":0}}`
	request("player", "0", "/api/v1/empire/economy/action", cmd, 200)
	stock := p.ResourcesMilli[domain.ResIronIngot]
	state = request("player", "0", "/api/v1/empire/economy/action", cmd, 200)
	if state.Economy.Professional.Level != 1 || p.ResourcesMilli[domain.ResIronIngot] != stock {
		t.Fatal("build replay charged twice")
	}
	w.ActiveHandle = "pioneer"
	blank := mapDashboardResp(w)
	if len(blank.Economy.Companies) > 0 || len(blank.Economy.CompanyCatalog) > 0 || len(blank.Economy.Professional.Consumables) > 0 {
		t.Fatal("opening reveals economy catalogs")
	}
}
