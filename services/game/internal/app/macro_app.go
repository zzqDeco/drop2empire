package app

import (
	"context"
	"fmt"
	"time"

	"drop2empire/services/game/internal/domain"
)

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
		if p.DailyWarBudgetUsed > 0 {
			return domain.ErrPrecondition("war_faction_locked", "本期已出兵，结算前不能切换阵营")
		}
		p.GuildCode = guildCode
		name := "黑曜商会 (OBSIDIAN)"
		if guildCode == domain.GuildArgent {
			name = "白银同盟 (ARGENT)"
		}
		domain.AppendLog(p, now, "WAR", fmt.Sprintf("已切换所属商会阵营为【%s】。", name))
		return nil
	})
}

func (s *Service) GuildAction(ctx context.Context, action, guildID, name, tag, faction, rallyNodeID string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.PerformGuildAction(w, p, action, guildID, name, tag, faction, rallyNodeID, now)
	})
}

func (s *Service) DeployWarTroops(ctx context.Context, nodeID string, infDelta, arcDelta, cavDelta int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.DeployWarTroops(w, p, nodeID, infDelta, arcDelta, cavDelta, now)
	})
}

func (s *Service) TriggerWarSettlement(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅平台管理员可手动强制执行 20:00 战争结算")
		}
		domain.SettleWarDay(w, p, now)
		return nil
	})
}
