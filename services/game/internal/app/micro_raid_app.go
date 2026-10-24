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

// Raid commands persist one player and do not advance unrelated settlement clocks.
func (s *Service) RaidCommand(ctx context.Context, raidID string, seq int64, cmd domain.RaidCommand) (*domain.PlayerState, error) {
	token := SessionTokenFromContext(ctx)
	if token == "" {
		return nil, domain.ErrUnauthorized("请先登录")
	}
	var out *domain.PlayerState
	err := s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		p, admin, err := s.players.LoadSessionPlayer(txCtx, token)
		if err != nil {
			return err
		}
		if admin && IsPublicSurface(ctx) {
			return domain.ErrForbidden("管理后台仅限 SSH 隧道访问")
		}
		now := s.now() // Capture authoritative time after acquiring the player lock.
		if err := domain.ApplyRaidCommand(p, raidID, seq, cmd, now); err != nil {
			return err
		}
		if err := s.players.SavePlayer(txCtx, p); err != nil {
			return err
		}
		out = p
		return nil
	})
	return out, err
}
