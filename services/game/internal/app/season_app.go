package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"drop2empire/services/game/internal/domain"
)

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

func (s *Service) RolloverSeason(ctx context.Context, nextSeasonTitle string) (*domain.WorldState, error) {
	if IsPublicSurface(ctx) {
		return nil, domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可执行跨赛季结算与新纪元轮换")
		}
		domain.RolloverSeason(w, nextSeasonTitle, now)
		return nil
	})
}

func (s *Service) PublishNotice(ctx context.Context, title, effectiveIn, summary string, demandShifts []string) (*domain.WorldState, error) {
	if IsPublicSurface(ctx) {
		return nil, domain.ErrForbidden("管理后台未在公网开放，请通过 SSH 本地隧道访问")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可发布帝国公告")
		}
		return domain.PublishNotice(w, title, effectiveIn, summary, demandShifts, now)
	})
}

func (s *Service) ControlSimulation(ctx context.Context, action string, speedMultiplier int32, advanceSeconds int64, targetHandle string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
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
			if target.PopulationTotal < 12 {
				target.PopulationTotal = 12
			}
			for _, bp := range domain.BlueprintCatalog {
				if bp.Code != domain.BPMysteryTreasure {
					target.UnlockedBlueprints[bp.Code] = true
				}
			}
			for _, tech := range domain.TechnologyCatalog {
				target.ResearchedTechnologies[tech.Code] = true
			}
			for _, building := range domain.BuildingCatalog {
				target.BuildingCounts[building.Code] = max(1, target.BuildingCounts[building.Code])
			}
			houses := min(domain.MaxBuildingCount, max(int32(0), (target.PopulationTotal-domain.InitialHousing+3)/4))
			target.BuildingCounts[domain.BuildingHouse] = max(houses, target.BuildingCounts[domain.BuildingHouse])
			target.SettlementCommandSeq++
			target.LastSettlementCommand = ""
			domain.RefreshSettlementDiscovery(target)
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
			domain.AppendLog(target, now, "BLUEPRINT", "【管理员沙盒】已补齐技术、设施与三个工程部件，可直接装配古代装置；装配开放职业，金币仅通过有预算的市场交易取得。")
			return nil

		case "reset_player":
			if domain.HasFinancialPosition(w, target) {
				return domain.ErrPrecondition("financial_position_active", "该账号持有股份、认购或投票快照，不能单独清档")
			}
			prevHash := target.PasswordHash
			prevAdmin := target.IsAdmin
			returnedGold := target.GoldBasis + target.GoldFrozenBasis
			if returnedGold > 0 {
				w.TreasuryHeldBasis += returnedGold
			}
			for i := range w.Orders {
				if !w.Orders[i].IsNPC && w.Orders[i].MakerHandle == target.Handle && w.Orders[i].Status == "OPEN" {
					w.Orders[i].Status = "CANCELLED"
				}
			}
			fresh := domain.NewBlankPlayer(target.Handle, now)
			fresh.PasswordHash = prevHash
			fresh.IsAdmin = prevAdmin
			fresh.SettlementCommandSeq = target.SettlementCommandSeq + 1
			w.Players[target.Handle] = fresh
			return nil

		default:
			return domain.ErrInvalidInput("未知的模拟控制指令")
		}
	})
}

func (s *Service) RunBenchmark30m(ctx context.Context) ([]domain.BenchmarkRun, error) {
	if _, err := s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, _ time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可运行 30 分钟全阶段数值基准模拟器")
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return domain.RunPhase1Benchmarks(), nil
}
