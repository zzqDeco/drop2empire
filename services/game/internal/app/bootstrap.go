package app

import (
	"context"
	"drop2empire/services/game/internal/domain"
	"strings"
)

// ConfigureBootstrapInvite is startup configuration, not a player operation.
func (s *Service) ConfigureBootstrapInvite(code string) {
	s.bootstrapInviteCode = strings.TrimSpace(code)
}

// BootstrapAdmin is called before listening. It never creates demo players or
// replaces an existing administrator's password during restarts or deployments.
func (s *Service) BootstrapAdmin(ctx context.Context, password string) error {
	return s.tx.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.repo.LoadWorld(tx, s.now())
		if err != nil {
			return err
		}
		for _, p := range w.Players {
			if p.IsAdmin {
				return nil
			}
		}
		if len(w.Players) != 0 {
			return domain.ErrPrecondition("admin_bootstrap_closed", "非空账户库不能自动创建管理员")
		}
		if len(password) < 16 || len(password) > 64 {
			return domain.ErrInvalidInput("空库启动必须配置 16–64 位 D2E_ADMIN_PASSWORD")
		}
		p := domain.NewBlankPlayer("admin", s.now())
		p.IsAdmin = true
		p.PasswordHash = domain.HashPassword(p.Handle, password)
		w.Players[p.Handle] = p
		w.ActiveHandle = p.Handle
		return s.repo.SaveWorld(tx, w)
	})
}
