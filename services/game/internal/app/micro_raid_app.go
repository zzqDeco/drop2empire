package app

import (
	"context"
	"time"

	"drop2empire/services/game/internal/domain"
)

func (s *Service) EquipCosmetic(ctx context.Context, slot, itemKey string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.EquipCosmetic(p, slot, itemKey, now)
	})
}

func (s *Service) LearnRaidBlueprint(ctx context.Context, blueprintKey string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.LearnRaidBlueprint(p, blueprintKey, now)
	})
}

func (s *Service) ManageRaidGear(ctx context.Context, action, itemKey string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.ManageRaidGear(p, action, itemKey, now)
	})
}

func (s *Service) DraftRaidBuff(ctx context.Context, action, cardCode string, replaceSlot int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.DraftRaidBuff(p, action, cardCode, replaceSlot, now)
	})
}

func (s *Service) StartRaid(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.StartRaid(p, now)
	})
}

func (s *Service) FinishRaid(ctx context.Context, status string, backpackLootKeys, safeBoxLootKeys, usedPotionKeys []string, zonesVisited, chestsOpened, bossesKilled int32) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.FinishRaid(p, status, backpackLootKeys, safeBoxLootKeys, usedPotionKeys, zonesVisited, chestsOpened, bossesKilled, now)
	})
}
