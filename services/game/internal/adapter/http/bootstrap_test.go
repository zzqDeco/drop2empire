package httpadapter

import (
	"context"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
	"testing"
	"time"
)

func TestEmptyRealmBootstrapAndInvitationLifecycle(t *testing.T) {
	w := domain.NewEmptyWorld(time.Now())
	mem := &fakeMemStore{w: w}
	s := app.NewService(mem, mem)
	ctx := context.Background()
	if err := s.BootstrapAdmin(ctx, ""); err == nil {
		t.Fatal("empty database accepted default credentials")
	}
	password := "local-only-testing-password"
	if err := s.BootstrapAdmin(ctx, password); err != nil {
		t.Fatal(err)
	}
	hash := w.Players["admin"].PasswordHash
	if err := s.BootstrapAdmin(ctx, "another-testing-password"); err != nil {
		t.Fatal(err)
	}
	if len(w.Players) != 1 || w.Players["admin"].PasswordHash != hash {
		t.Fatal("restart replaced administrator or recreated demo players")
	}
	if _, _, err := s.LoginAccount(app.WithAdminTunnel(ctx, "0"), "admin", password); err == nil {
		t.Fatal("public admin login accepted")
	}
	_, token, err := s.LoginAccount(app.WithAdminTunnel(ctx, "1"), "admin", password)
	if err != nil {
		t.Fatal(err)
	}
	_, invite, err := s.CreateInvite(app.WithSessionToken(app.WithAdminTunnel(ctx, "1"), token))
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = s.RegisterAccount(ctx, "new-player", "player-testing-password", invite)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = s.RegisterAccount(ctx, "second-player", "player-testing-password", invite); err == nil {
		t.Fatal("invite reused")
	}
	if w.Players["new-player"].IsAdmin || w.Players["new-player"].PopulationTotal != 0 || w.Players["new-player"].GoldBasis != 0 {
		t.Fatal("registration inherited operator/demo progress")
	}
	if _, _, err = s.LoginAccount(ctx, "pioneer", "pioneer123"); err == nil {
		t.Fatal("demo login remains")
	}
}

func TestBootstrapInvitationOnlyAppliesToFirstAccount(t *testing.T) {
	w := domain.NewEmptyWorld(time.Now())
	mem := &fakeMemStore{w: w}
	s := app.NewService(mem, mem)
	s.ConfigureBootstrapInvite("local-only-bootstrap")
	if _, _, err := s.RegisterAccount(context.Background(), "first", "player-password", "local-only-bootstrap"); err != nil {
		t.Fatal(err)
	}
	if w.Players["first"].IsAdmin {
		t.Fatal("public bootstrap granted administrator privileges")
	}
	if _, _, err := s.RegisterAccount(context.Background(), "second", "player-password", "local-only-bootstrap"); err == nil {
		t.Fatal("bootstrap reused after initial account")
	}
}
