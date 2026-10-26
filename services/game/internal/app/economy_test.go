package app

import (
	"context"
	"strings"
	"testing"
)

func TestRegistrationReservesInstitutionAccountNamespace(t *testing.T) {
	s := &Service{}
	for _, handle := range []string{"@company:alloy", "@public"} {
		_, _, err := s.RegisterAccount(context.Background(), handle, "testing123", "invite")
		if err == nil || !strings.Contains(err.Error(), "保留前缀") {
			t.Fatal("institution identity reached registration transaction")
		}
	}
}
