package app

import (
	"context"
	"strings"
	"time"

	"drop2empire/services/game/internal/domain"
)

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

func (s *Service) ToggleEdict(ctx context.Context, code string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.ToggleEdict(p, code, now)
	})
}

func (s *Service) DispatchExpedition(ctx context.Context, routeCode string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.DispatchExpedition(p, routeCode, now)
	})
}

func (s *Service) ClaimExpedition(ctx context.Context) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.ClaimExpedition(p, now)
	})
}

func (s *Service) TradeCaravan(ctx context.Context, offerCode string) (*domain.WorldState, error) {
	return s.mutate(ctx, func(_ *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.TradeCaravan(p, offerCode, now)
	})
}
