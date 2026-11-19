package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"drop2empire/services/game/internal/domain"
)

type sessionTokenKey struct{}
type adminTunnelKey struct{}
type idempotencyKeyCtxKey struct{}

var errFallbackToGlobalWorld = errors.New("fallback_to_global_world")

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

func WithIdempotencyKey(ctx context.Context, key string) context.Context {
	clean := strings.TrimSpace(key)
	if len(clean) > 160 {
		clean = clean[:160]
	}
	return context.WithValue(ctx, idempotencyKeyCtxKey{}, clean)
}

func IdempotencyKeyFromContext(ctx context.Context) string {
	v, _ := ctx.Value(idempotencyKeyCtxKey{}).(string)
	return v
}

const maxInviteReplayCache = domain.MaxStoredIdempotencyKeys * 4

type inviteReplayEntry struct {
	key  string
	code string
}

type Service struct {
	tx                  domain.TxManager
	repo                domain.WorldRepository
	players             domain.PlayerRepository
	now                 func() time.Time
	bootstrapInviteCode string

	inviteReplayMu    sync.Mutex
	inviteReplays     map[string]string
	inviteReplayOrder []inviteReplayEntry
}

func inviteReplayCacheKey(handle, idemKey string) string {
	return handle + "\x00" + idemKey
}

func (s *Service) rememberInviteReplay(cacheKey, plainCode string) {
	if cacheKey == "" || plainCode == "" {
		return
	}
	s.inviteReplayMu.Lock()
	defer s.inviteReplayMu.Unlock()
	if s.inviteReplays == nil {
		s.inviteReplays = make(map[string]string)
	}
	s.inviteReplays[cacheKey] = plainCode
	s.inviteReplayOrder = append(s.inviteReplayOrder, inviteReplayEntry{key: cacheKey, code: plainCode})
	for len(s.inviteReplayOrder) > maxInviteReplayCache {
		oldest := s.inviteReplayOrder[0]
		s.inviteReplayOrder = s.inviteReplayOrder[1:]
		if cur, ok := s.inviteReplays[oldest.key]; ok && cur == oldest.code {
			delete(s.inviteReplays, oldest.key)
		}
	}
}

func (s *Service) lookupInviteReplay(cacheKey string) (string, bool) {
	if cacheKey == "" {
		return "", false
	}
	s.inviteReplayMu.Lock()
	defer s.inviteReplayMu.Unlock()
	code, ok := s.inviteReplays[cacheKey]
	return code, ok
}

func (s *Service) forgetInviteReplay(cacheKey, plainCode string) {
	if cacheKey == "" || plainCode == "" {
		return
	}
	s.inviteReplayMu.Lock()
	defer s.inviteReplayMu.Unlock()
	if cur, ok := s.inviteReplays[cacheKey]; ok && cur == plainCode {
		delete(s.inviteReplays, cacheKey)
	}
}

func NewService(tx domain.TxManager, repo domain.GameRepository) *Service {
	return &Service{
		tx:                  tx,
		repo:                repo,
		players:             repo,
		now:                 func() time.Time { return time.Now().UTC() },
		bootstrapInviteCode: "teamie-bootstrap",
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
		if err := domain.AdvanceEconomy(w, now); err != nil {
			return err
		}
		domain.SettleWarDay(w, p, now)
		idemKey := IdempotencyKeyFromContext(ctx)
		if fn != nil && !(idemKey != "" && p.HasIdempotencyKey(idemKey)) {
			if err := fn(w, p, now); err != nil {
				return err
			}
			if idemKey != "" {
				p.RecordIdempotencyKey(idemKey)
			}
		}
		domain.RefreshSettlementDiscovery(p)
		if err := domain.CheckEconomy(w); err != nil {
			return err
		}
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		w.AdminMode = isAdmin
		out = w
		return nil
	})
	return out, err
}

func worldNeedsGlobalTick(w *domain.WorldState, now time.Time) bool {
	if w == nil || w.Economy == nil || w.SeasonCode == "" || len(w.Guilds) == 0 {
		return true
	}
	minute := now.UTC().Truncate(time.Minute)
	if w.Economy.LastTick.IsZero() || w.Economy.LastTick.Before(minute) {
		return true
	}
	period := domain.WarPeriod(now)
	if w.LastWarPeriod == "" || period > w.LastWarPeriod {
		return true
	}
	return false
}

// mutatePlayer runs polling and pure single-player commands under a single-player row lock
// without acquiring the realm-wide FOR UPDATE lock, falling back to mutate() only when
// an admin console view, uninitialized realm, or overdue world/war tick requires global coordination.
func (s *Service) mutatePlayer(ctx context.Context, allowWorldTick bool, fn func(p *domain.PlayerState, now time.Time) error) (*domain.WorldState, error) {
	token := SessionTokenFromContext(ctx)
	if token == "" {
		return nil, domain.ErrUnauthorized("请先登录或注册领主账号")
	}
	var out *domain.WorldState
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, p, isAdmin, err := s.players.LoadSessionWorldView(txCtx, token)
		if err != nil {
			return err
		}
		if isAdmin && IsPublicSurface(ctx) {
			return domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
		}
		now := s.now()
		if isAdmin || w.Economy == nil || w.SeasonCode == "" || len(w.Guilds) == 0 || (allowWorldTick && worldNeedsGlobalTick(w, now)) {
			return errFallbackToGlobalWorld
		}
		beforeRaw, _ := json.Marshal(p)
		domain.EnsurePlayerState(p)
		domain.SettleProduction(p, now)
		idemKey := IdempotencyKeyFromContext(ctx)
		if fn != nil && !(idemKey != "" && p.HasIdempotencyKey(idemKey)) {
			if err := fn(p, now); err != nil {
				return err
			}
			if idemKey != "" {
				p.RecordIdempotencyKey(idemKey)
			}
		}
		domain.RefreshSettlementDiscovery(p)
		afterRaw, _ := json.Marshal(p)
		if !bytes.Equal(beforeRaw, afterRaw) {
			if err := s.players.SavePlayer(txCtx, p); err != nil {
				return err
			}
		}
		w.ActiveHandle = p.Handle
		w.AdminMode = isAdmin
		out = w
		return nil
	})
	if errors.Is(err, errFallbackToGlobalWorld) {
		if fn == nil {
			return s.mutate(ctx, nil)
		}
		return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
			return fn(p, now)
		})
	}
	return out, err
}

func (s *Service) RegisterAccount(ctx context.Context, handle, password, inviteCode string) (*domain.WorldState, string, error) {
	clean := strings.TrimSpace(handle)
	if len(clean) < 2 || len(clean) > 24 || strings.ContainsAny(clean, " \t\r\n") || strings.HasPrefix(clean, "@") {
		return nil, "", domain.ErrInvalidInput("账号名称需为 2–24 个字符，不含空格且不能使用机构保留前缀 @")
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
		bootstrap := len(w.Players) == 0 && domain.HashInviteCode(inviteCode) == domain.HashInviteCode(s.bootstrapInviteCode)
		if !bootstrap {
			if err := domain.ConsumeInvite(w, inviteCode, clean, now); err != nil {
				return err
			}
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
	idemKey := IdempotencyKeyFromContext(ctx)
	var plainCode string
	var replayKey string
	ranCallback := false
	w, err := s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可生成注册邀请码")
		}
		_, plainCode = domain.CreateInvite(w, now)
		ranCallback = true
		if idemKey != "" {
			replayKey = inviteReplayCacheKey(p.Handle, idemKey)
			s.rememberInviteReplay(replayKey, plainCode)
		}
		return nil
	})
	if err != nil {
		if ranCallback && replayKey != "" {
			s.forgetInviteReplay(replayKey, plainCode)
		}
		return nil, "", err
	}
	if !w.AdminMode {
		return nil, "", domain.ErrForbidden("仅平台管理员可生成注册邀请码")
	}
	if !ranCallback {
		if idemKey != "" {
			if cached, ok := s.lookupInviteReplay(inviteReplayCacheKey(w.ActiveHandle, idemKey)); ok && cached != "" {
				return w, cached, nil
			}
		}
		return nil, "", domain.ErrPrecondition("invite_replay_unavailable", "该邀请码创建请求已提交，但明文邀请码无法跨进程重启恢复，请查看邀请码列表或发起新请求重新签发")
	}
	return w, plainCode, nil
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
	return s.mutatePlayer(ctx, true, nil)
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
