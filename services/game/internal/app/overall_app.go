package app

import (
	"context"
	"strings"
	"time"

	"drop2empire/services/game/internal/domain"
)

type sessionTokenKey struct{}
type adminTunnelKey struct{}

func WithSessionToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, sessionTokenKey{}, strings.TrimSpace(token))
}

func SessionTokenFromContext(ctx context.Context) string {
	v, _ := ctx.Value(sessionTokenKey{}).(string)
	return v
}

func WithAdminTunnel(ctx context.Context, flag string) context.Context {
	return context.WithValue(ctx, adminTunnelKey{}, strings.TrimSpace(flag))
}

func IsPublicSurface(ctx context.Context) bool {
	v, _ := ctx.Value(adminTunnelKey{}).(string)
	return v == "0"
}

type Service struct {
	tx      domain.TxManager
	repo    domain.WorldRepository
	players domain.PlayerRepository
	now     func() time.Time
}

func NewService(tx domain.TxManager, repo domain.GameRepository) *Service {
	return &Service{
		tx:      tx,
		repo:    repo,
		players: repo,
		now:     func() time.Time { return time.Now().UTC() },
	}
}

func resolveSession(w *domain.WorldState, token string) (target *domain.PlayerState, isAdmin bool, ok bool) {
	raw, exists := w.Sessions[token]
	if !exists || raw == "" {
		return nil, false, false
	}
	if raw == "admin" || strings.HasPrefix(raw, "admin::") {
		adm := w.Players["admin"]
		if adm == nil || !adm.IsAdmin {
			return nil, false, false
		}
		targetHandle := "admin"
		if strings.HasPrefix(raw, "admin::") {
			targetHandle = strings.TrimPrefix(raw, "admin::")
		}
		tp, tExists := w.Players[targetHandle]
		if !tExists || tp == nil {
			tp = adm
		}
		return tp, true, true
	}
	p, pExists := w.Players[raw]
	if !pExists || p == nil {
		return nil, false, false
	}
	return p, p.IsAdmin, true
}

func (s *Service) mutate(ctx context.Context, fn func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error) (*domain.WorldState, error) {
	now := s.now()
	token := SessionTokenFromContext(ctx)
	if token == "" {
		return nil, domain.ErrUnauthorized("请先登录或注册领主账号")
	}
	var out *domain.WorldState
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		now = s.now()
		domain.EnsureDefaultAccounts(w, now)
		p, isAdmin, ok := resolveSession(w, token)
		if !ok || p == nil {
			return domain.ErrUnauthorized("登录会话已过期，请重新登录")
		}
		if isAdmin && IsPublicSurface(ctx) {
			return domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
		}
		w.ActiveHandle = p.Handle
		w.AdminMode = isAdmin
		domain.SettleProduction(p, now)
		domain.SettleWarDay(w, p, now)
		if fn != nil {
			if err := fn(w, p, now); err != nil {
				return err
			}
		}
		domain.RefreshSettlementDiscovery(p)
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		w.AdminMode = isAdmin
		out = w
		return nil
	})
	return out, err
}

func (s *Service) RegisterAccount(ctx context.Context, handle, password, inviteCode string) (*domain.WorldState, string, error) {
	clean := strings.TrimSpace(handle)
	if len(clean) < 2 || len(clean) > 24 || strings.ContainsAny(clean, " \t\r\n") {
		return nil, "", domain.ErrInvalidInput("账号名称长度需在 2–24 个字符之间且不含空格")
	}
	if len(password) < 6 || len(password) > 64 {
		return nil, "", domain.ErrInvalidInput("登录密码长度需在 6–64 个字符之间")
	}
	if strings.TrimSpace(inviteCode) == "" {
		return nil, "", domain.ErrInvalidInput("请输入管理员发放的邀请码")
	}
	now := s.now()
	var out *domain.WorldState
	var token string
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		now = s.now()
		domain.EnsureDefaultAccounts(w, now)
		if _, exists := w.Players[clean]; exists {
			return domain.ErrPrecondition("handle_taken", "该领主名号已被注册，请直接登录或更换名称")
		}
		if err := domain.ConsumeInvite(w, inviteCode, clean, now); err != nil {
			return err
		}
		p := domain.NewBlankPlayer(clean, now)
		p.PasswordHash = domain.HashPassword(clean, password)
		p.IsAdmin = false
		w.Players[clean] = p

		token = domain.NewSessionToken(clean, now)
		w.Sessions[token] = clean
		w.ActiveHandle = clean
		w.AdminMode = false

		domain.SettleProduction(p, now)
		domain.RefreshSettlementDiscovery(p)
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		w.AdminMode = false
		out = w
		return nil
	})
	return out, token, err
}

func (s *Service) LoginAccount(ctx context.Context, handle, password string) (*domain.WorldState, string, error) {
	clean := strings.TrimSpace(handle)
	if clean == "" || password == "" {
		return nil, "", domain.ErrInvalidInput("请输入账号名称与密码")
	}
	now := s.now()
	var out *domain.WorldState
	var token string
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		now = s.now()
		domain.EnsureDefaultAccounts(w, now)
		p, exists := w.Players[clean]
		if !exists || p == nil {
			return domain.ErrUnauthorized("账号不存在或密码错误")
		}
		expected := domain.HashPassword(clean, password)
		if p.PasswordHash != expected {
			return domain.ErrUnauthorized("账号不存在或密码错误")
		}
		if p.IsAdmin && IsPublicSurface(ctx) {
			return domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
		}

		token = domain.NewSessionToken(clean, now)
		w.Sessions[token] = clean
		w.ActiveHandle = clean
		w.AdminMode = p.IsAdmin

		domain.SettleProduction(p, now)
		domain.RefreshSettlementDiscovery(p)
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		w.AdminMode = p.IsAdmin
		out = w
		return nil
	})
	return out, token, err
}

func (s *Service) CreateInvite(ctx context.Context) (*domain.WorldState, string, error) {
	if IsPublicSurface(ctx) {
		return nil, "", domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
	}
	var plainCode string
	w, err := s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可生成注册邀请码")
		}
		_, plainCode = domain.CreateInvite(w, now)
		return nil
	})
	return w, plainCode, err
}

func (s *Service) RevokeInvite(ctx context.Context, inviteID string) (*domain.WorldState, error) {
	if IsPublicSurface(ctx) {
		return nil, domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可吊销注册邀请码")
		}
		return domain.RevokeInvite(w, inviteID, now)
	})
}

func (s *Service) LogoutAccount(ctx context.Context) error {
	token := SessionTokenFromContext(ctx)
	if token == "" {
		return nil
	}
	now := s.now()
	return s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		now = s.now()
		domain.EnsureDefaultAccounts(w, now)
		delete(w.Sessions, token)
		return s.repo.SaveWorld(txCtx, w)
	})
}

func (s *Service) GetDashboard(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, nil)
}

func (s *Service) SwitchAccount(ctx context.Context, handle string) (*domain.WorldState, error) {
	clean := strings.TrimSpace(handle)
	if len(clean) < 2 || len(clean) > 24 {
		return nil, domain.ErrInvalidInput("账号标识长度需在 2–24 个字符之间")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可切换检视其他领主账号")
		}
		if _, exists := w.Players[clean]; !exists {
			fresh := domain.NewBlankPlayer(clean, now)
			fresh.PasswordHash = domain.HashPassword(clean, "123456")
			w.Players[clean] = fresh
		}
		token := SessionTokenFromContext(ctx)
		if token != "" {
			if clean == "admin" {
				w.Sessions[token] = "admin"
			} else {
				w.Sessions[token] = "admin::" + clean
			}
		}
		w.ActiveHandle = clean
		domain.SettleProduction(w.Players[clean], now)
		return nil
	})
}
