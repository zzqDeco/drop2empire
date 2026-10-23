package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"drop2empire/services/game/internal/domain"
)

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
	var out *domain.WorldState
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		if w.ActiveHandle == "" {
			w.ActiveHandle = "pioneer"
		}
		p, ok := w.Players[w.ActiveHandle]
		if !ok {
			p = domain.NewBlankPlayer(w.ActiveHandle, now)
			w.Players[w.ActiveHandle] = p
		}
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

func (s *Service) GetDashboard(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, nil)
}

func (s *Service) SwitchAccount(ctx context.Context, handle string) (*domain.WorldState, error) {
	clean := strings.TrimSpace(handle)
	if len(clean) < 2 || len(clean) > 24 {
		return nil, domain.ErrInvalidInput("账号标识长度需在 2–24 个字符之间")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if _, exists := w.Players[clean]; !exists {
			w.Players[clean] = domain.NewBlankPlayer(clean, now)
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

func (s *Service) ControlSimulation(ctx context.Context, action string, speedMultiplier int32, advanceSeconds int64) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		switch action {
		case "set_speed":
			if speedMultiplier != 1 && speedMultiplier != 10 && speedMultiplier != 60 && speedMultiplier != 300 {
				return domain.ErrInvalidInput("仅支持 1x / 10x / 60x / 300x 时间倍率")
			}
			p.SpeedMultiplier = speedMultiplier
			domain.AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已将当前账号模拟时间流速调整为 %dx。", speedMultiplier))
			return nil

		case "fast_forward":
			if advanceSeconds <= 0 {
				advanceSeconds = 60
			}
			if advanceSeconds > domain.OfflineCapSeconds {
				advanceSeconds = domain.OfflineCapSeconds
			}
			domain.AdvancePlayerSeconds(p, advanceSeconds)
			domain.AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已快进模拟生产 +%d 秒。", advanceSeconds))
			return nil

		case "unlock_treasure_ready":
			// Fast-forward current player to 40 population and all pre-treasure parts unlocked, with resources ready to click Mystery Treasure
			if p.PopulationTotal < 40 {
				p.PopulationTotal = 40
			}
			for _, bp := range domain.BlueprintCatalog {
				if bp.Code != domain.BPMysteryTreasure {
					p.UnlockedBlueprints[bp.Code] = true
				}
			}
			domain.ApplyBalancedAllocation(p)
			if p.ResourcesMilli[domain.ResWater] < 5000*domain.ResourceScale {
				p.ResourcesMilli[domain.ResWater] = 5000 * domain.ResourceScale
			}
			if p.ResourcesMilli[domain.ResWood] < 2400*domain.ResourceScale {
				p.ResourcesMilli[domain.ResWood] = 2400 * domain.ResourceScale
			}
			if p.ResourcesMilli[domain.ResStone] < 800*domain.ResourceScale {
				p.ResourcesMilli[domain.ResStone] = 800 * domain.ResourceScale
			}
			if p.SimulatedElapsedSeconds < 1780 {
				p.SimulatedElapsedSeconds = 1780
			}
			domain.AppendLog(p, now, "BLUEPRINT", "【调试快进】已将当前进度推进至第 29 分钟里程碑（40 人口 + 基础工坊 + 宝藏三部件），可直接点击开启【神秘的宝藏】！")
			return nil

		case "reset_player":
			fresh := domain.NewBlankPlayer(p.Handle, now)
			w.Players[p.Handle] = fresh
			return nil

		default:
			return domain.ErrInvalidInput("未知的模拟控制指令")
		}
	})
}

func (s *Service) RunBenchmark30m(_ context.Context) []domain.BenchmarkRun {
	return domain.RunPhase1Benchmarks()
}
