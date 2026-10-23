package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type sampleDomainErr struct{}

func (sampleDomainErr) Error() string      { return "insufficient water" }
func (sampleDomainErr) StatusCode() int    { return http.StatusUnprocessableEntity }
func (sampleDomainErr) ErrorCode() string  { return "insufficient_resource" }

func TestResponderMapsDomainErrorAndStrictJSON(t *testing.T) {
	var r Responder
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/empire/production/recruit", strings.NewReader(`{"unknown":1}`))
	var dst struct {
		Count int `json:"count"`
	}
	if err := r.DecodeRequest(w, req, &dst); err == nil {
		t.Fatal("expected unknown field error")
	}

	w2 := httptest.NewRecorder()
	r.WriteDomainErrorHTTP(w2, req, sampleDomainErr{})
	if w2.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", w2.Code)
	}
}
