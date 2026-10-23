package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"drop2empire/services/game/internal/domain"
)

type sessionTokenKey struct{}

func WithSessionToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, sessionTokenKey{}, strings.TrimSpace(token))
}

func SessionTokenFromContext(ctx context.Context) string {
	v, _ := ctx.Value(sessionTokenKey{}).(string)
	return v
}

type Service struct {
	tx   domain.TxManager
	repo domain.WorldRepository
	now  func() time.Time
}

func NewService(tx domain.TxManager, repo domain.WorldRepository) *Service {
	return &Service{
		tx:   tx,
		repo: repo,
		now:  func() time.Time { return time.Now().UTC() },
	}
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
		domain.EnsureDefaultAccounts(w, now)
		handle, ok := w.Sessions[token]
		if !ok || handle == "" {
			return domain.ErrUnauthorized("登录会话已过期，请重新登录")
		}
		p, exists := w.Players[handle]
		if !exists || p == nil {
			return domain.ErrUnauthorized("当前账号不存在，请重新登录")
		}
		w.ActiveHandle = handle
		for _, pl := range w.Players {
			domain.SettleProduction(pl, now)
		}
		if fn != nil {
			if err := fn(w, p, now); err != nil {
				return err
			}
		}
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		out = w
		return nil
	})
	return out, err
}

func (s *Service) RegisterAccount(ctx context.Context, handle, password string) (*domain.WorldState, string, error) {
	clean := strings.TrimSpace(handle)
	if len(clean) < 2 || len(clean) > 24 || strings.ContainsAny(clean, " \t\r\n") {
		return nil, "", domain.ErrInvalidInput("账号名称长度需在 2–24 个字符之间且不含空格")
	}
	if len(password) < 6 || len(password) > 64 {
		return nil, "", domain.ErrInvalidInput("登录密码长度需在 6–64 个字符之间")
	}
	now := s.now()
	var out *domain.WorldState
	var token string
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		domain.EnsureDefaultAccounts(w, now)
		if _, exists := w.Players[clean]; exists {
			return domain.ErrPrecondition("handle_taken", "该领主名号已被注册，请直接登录或更换名称")
		}
		p := domain.NewBlankPlayer(clean, now)
		p.PasswordHash = domain.HashPassword(clean, password)
		p.IsAdmin = false
		w.Players[clean] = p

		token = domain.NewSessionToken(clean, now)
		w.Sessions[token] = clean
		w.ActiveHandle = clean

		for _, pl := range w.Players {
			domain.SettleProduction(pl, now)
		}
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
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
		domain.EnsureDefaultAccounts(w, now)
		p, exists := w.Players[clean]
		if !exists || p == nil {
			return domain.ErrUnauthorized("账号不存在或密码错误")
		}
		expected := domain.HashPassword(clean, password)
		if p.PasswordHash != expected {
			return domain.ErrUnauthorized("账号不存在或密码错误")
		}

		token = domain.NewSessionToken(clean, now)
		w.Sessions[token] = clean
		w.ActiveHandle = clean

		for _, pl := range w.Players {
			domain.SettleProduction(pl, now)
		}
		if err := s.repo.SaveWorld(txCtx, w); err != nil {
			return err
		}
		out = w
		return nil
	})
	return out, token, err
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
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !p.IsAdmin {
			return domain.ErrForbidden("仅平台管理员可切换检视其他领主账号")
		}
		if _, exists := w.Players[clean]; !exists {
			fresh := domain.NewBlankPlayer(clean, now)
			fresh.PasswordHash = domain.HashPassword(clean, "123456")
			w.Players[clean] = fresh
		}
		token := SessionTokenFromContext(ctx)
		if token != "" {
			w.Sessions[token] = clean
		}
		w.ActiveHandle = clean
		domain.SettleProduction(w.Players[clean], now)
		return nil
	})
}

func (s *Service) GatherWater(ctx context.Context, clicks int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.GatherWater(p, clicks, now)
	})
}

func (s *Service) RecruitResident(ctx context.Context, count int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.RecruitResident(p, count, now)
	})
}

func (s *Service) AllocateWorkers(ctx context.Context, mode string, entries map[string]int32, presetName string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.AllocateWorkers(p, mode, entries, presetName, now)
	})
}

func (s *Service) SaveAllocationPreset(ctx context.Context, name string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.SavePreset(p, strings.TrimSpace(name), now)
	})
}

func (s *Service) UnlockBlueprint(ctx context.Context, code string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.UnlockBlueprint(w, p, code, now)
	})
}

func (s *Service) ChooseProfession(ctx context.Context, profession string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.ChooseProfession(p, profession, now)
	})
}

func (s *Service) CraftItem(ctx context.Context, recipeCode string, batches int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.CraftItem(w, p, recipeCode, batches, now)
	})
}

func (s *Service) InstallEquipment(ctx context.Context, itemKey string, delta int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.InstallEquipment(p, itemKey, delta, now)
	})
}

func (s *Service) PlaceMarketOrder(ctx context.Context, itemKey, side string, priceBasis, quantityMilli int64) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.PlaceMarketOrder(w, p, itemKey, side, priceBasis, quantityMilli, now)
	})
}

func (s *Service) CancelMarketOrder(ctx context.Context, orderID string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.CancelMarketOrder(w, p, orderID, now)
	})
}

func (s *Service) SwitchGuild(ctx context.Context, guildCode string) (*domain.WorldState, error) {
	if guildCode != domain.GuildObsidian && guildCode != domain.GuildArgent {
		return nil, domain.ErrInvalidInput("商会标识必须为 OBSIDIAN（黑曜商会）或 ARGENT（白银同盟）")
	}
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		p.GuildCode = guildCode
		name := "黑曜商会 (OBSIDIAN)"
		if guildCode == domain.GuildArgent {
			name = "白银同盟 (ARGENT)"
		}
		domain.AppendLog(p, now, "WAR", fmt.Sprintf("已切换所属商会阵营为【%s】。", name))
		return nil
	})
}

func (s *Service) DeployWarTroops(ctx context.Context, nodeID string, infDelta, arcDelta, cavDelta int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.DeployWarTroops(w, p, nodeID, infDelta, arcDelta, cavDelta, now)
	})
}

func (s *Service) TriggerWarSettlement(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !p.IsAdmin {
			return domain.ErrForbidden("仅平台管理员可手动强制执行 20:00 战争结算")
		}
		domain.SettleWarDay(w, p, now)
		return nil
	})
}

func (s *Service) RedeemSeasonChest(ctx context.Context, count int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.RedeemSeasonChest(p, count, now)
	})
}

func (s *Service) OpenSeasonChest(ctx context.Context, clientSeedHint int64) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.OpenSeasonChest(w, p, clientSeedHint, now)
	})
}

func (s *Service) ControlSimulation(ctx context.Context, action string, speedMultiplier int32, advanceSeconds int64, targetHandle string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !p.IsAdmin {
			return domain.ErrForbidden("仅平台管理员可执行数值模拟与调速指令")
		}
		target := p
		if clean := strings.TrimSpace(targetHandle); clean != "" {
			if tp, ok := w.Players[clean]; ok && tp != nil {
				target = tp
			} else {
				return domain.ErrNotFound(fmt.Sprintf("目标账号 %s 不存在", clean))
			}
		}

		switch action {
		case "set_speed":
			if speedMultiplier != 1 && speedMultiplier != 10 && speedMultiplier != 60 && speedMultiplier != 300 {
				return domain.ErrInvalidInput("仅支持 1x / 10x / 60x / 300x 时间倍率")
			}
			target.SpeedMultiplier = speedMultiplier
			domain.AppendLog(target, now, "PRODUCTION", fmt.Sprintf("管理员已将账号 %s 模拟时间流速调整为 %dx。", target.Handle, speedMultiplier))
			return nil

		case "fast_forward":
			if advanceSeconds <= 0 {
				advanceSeconds = 60
			}
			if advanceSeconds > domain.OfflineCapSeconds {
				advanceSeconds = domain.OfflineCapSeconds
			}
			domain.AdvancePlayerSeconds(target, advanceSeconds)
			domain.AppendLog(target, now, "PRODUCTION", fmt.Sprintf("管理员已快进账号 %s 模拟生产 +%d 秒。", target.Handle, advanceSeconds))
			return nil

		case "unlock_treasure_ready":
			if target.PopulationTotal < 40 {
				target.PopulationTotal = 40
			}
			for _, bp := range domain.BlueprintCatalog {
				if bp.Code != domain.BPMysteryTreasure {
					target.UnlockedBlueprints[bp.Code] = true
				}
			}
			domain.ApplyBalancedAllocation(target)
			if target.ResourcesMilli[domain.ResWater] < 5000*domain.ResourceScale {
				target.ResourcesMilli[domain.ResWater] = 5000 * domain.ResourceScale
			}
			if target.ResourcesMilli[domain.ResWood] < 2400*domain.ResourceScale {
				target.ResourcesMilli[domain.ResWood] = 2400 * domain.ResourceScale
			}
			if target.ResourcesMilli[domain.ResStone] < 800*domain.ResourceScale {
				target.ResourcesMilli[domain.ResStone] = 800 * domain.ResourceScale
			}
			if target.SimulatedElapsedSeconds < 1780 {
				target.SimulatedElapsedSeconds = 1780
			}
			domain.AppendLog(target, now, "BLUEPRINT", "【管理员沙盒】已将进度推进至第 29 分钟里程碑（40 人口 + 基础工坊 + 宝藏三部件），可直接点击开启【神秘的宝藏】！")
			return nil

		case "reset_player":
			prevHash := target.PasswordHash
			prevAdmin := target.IsAdmin
			// Return any player-held or escrow gold to central treasury to preserve Monetary Supply Identity!
			returnedGold := target.GoldBasis + target.GoldFrozenBasis
			if returnedGold > 0 {
				w.TreasuryHeldBasis += returnedGold
			}
			// Cancel any open market orders by this player
			for i := range w.Orders {
				if !w.Orders[i].IsNPC && w.Orders[i].MakerHandle == target.Handle && w.Orders[i].Status == "OPEN" {
					w.Orders[i].Status = "CANCELLED"
				}
			}
			fresh := domain.NewBlankPlayer(target.Handle, now)
			fresh.PasswordHash = prevHash
			fresh.IsAdmin = prevAdmin
			w.Players[target.Handle] = fresh
			return nil

		default:
			return domain.ErrInvalidInput("未知的模拟控制指令")
		}
	})
}

func (s *Service) RunBenchmark30m(ctx context.Context) ([]domain.BenchmarkRun, error) {
	if _, err := s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, _ time.Time) error {
		if !p.IsAdmin {
			return domain.ErrForbidden("仅平台管理员可运行 30 分钟全阶段数值基准模拟器")
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return domain.RunPhase1Benchmarks(), nil
}
