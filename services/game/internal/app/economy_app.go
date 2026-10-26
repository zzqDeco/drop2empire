package app

import (
	"context"
	"drop2empire/services/game/internal/domain"
	"time"
)

func (s *Service) EconomyAction(ctx context.Context, seq int64, cmd domain.EconomyCommand) (*domain.WorldState, error) {
	return s.mutate(ctx, func(w *domain.WorldState, p *domain.PlayerState, now time.Time) error {
		return domain.ApplyEconomyCommand(w, p, seq, cmd, now)
	})
}
func (s *Service) MonetaryPolicy(ctx context.Context, policy domain.MonetaryPolicy) (*domain.WorldState, error) {
	if IsPublicSurface(ctx) {
		return nil, domain.ErrForbidden("货币政策仅开放于管理隧道")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅策划可发布货币政策")
		}
		return domain.ApplyMonetaryPolicy(w, policy, now)
	})
}
func (s *Service) IntroduceCompany(ctx context.Context, id string, shares, price, minShares, durationHours int64) (*domain.WorldState, error) {
	if IsPublicSurface(ctx) {
		return nil, domain.ErrForbidden("公司引入仅开放于管理隧道")
	}
	return s.mutate(ctx, func(w *domain.WorldState, _ *domain.PlayerState, now time.Time) error {
		if !w.AdminMode {
			return domain.ErrForbidden("仅策划可引入公司")
		}
		if durationHours < 1 || durationHours > 336 {
			return domain.ErrInvalidInput("认购窗口需为 1–336 小时")
		}
		return domain.IntroduceCompany(w, id, shares, price, minShares, now.Add(time.Duration(durationHours)*time.Hour), now)
	})
}

// TickEconomy is used by the process clock as well as polling. The persisted
// minute cursor and realm lock make multiple processes and retries harmless.
func (s *Service) TickEconomy(ctx context.Context) error {
	return s.tx.WithinTx(ctx, func(txCtx context.Context) error {
		now := s.now()
		w, err := s.repo.LoadWorld(txCtx, now)
		if err != nil {
			return err
		}
		if w.Economy != nil && !w.Economy.LastTick.Before(now.UTC().Truncate(time.Minute)) {
			return nil
		}
		if err := domain.AdvanceEconomy(w, now); err != nil {
			return err
		}
		if err := domain.CheckEconomy(w); err != nil {
			return err
		}
		return s.repo.SaveWorld(txCtx, w)
	})
}
