package pg

import (
	"context"
	"sync"
	"testing"
	"time"

	"drop2empire/services/game/internal/domain"
)

func TestConcurrentConstructionRetriesPersistOnePayment(t *testing.T) {
	s := integrationStore(t)
	ctx := context.Background()
	now := time.Now()
	err := s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		w.Players["pioneer"] = domain.NewBlankPlayer("pioneer", now)
		p := w.Players["pioneer"]
		p.PopulationTotal = 4
		p.Workers[domain.JobWater] = 4
		p.ResearchedTechnologies[domain.TechWoodworking] = true
		p.ResourcesMilli[domain.ResWater] = 200 * domain.ResourceScale
		p.ResourcesMilli[domain.ResWood] = 50 * domain.ResourceScale
		return s.SaveWorld(tx, w)
	})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errors := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errors <- s.WithinTx(ctx, func(tx context.Context) error {
				w, err := s.LoadWorld(tx, now)
				if err != nil {
					return err
				}
				p := w.Players["pioneer"]
				domain.EnsureSettlementState(p)
				if err := domain.ConstructBuilding(p, domain.BuildingLumberCamp, 1, 1, now); err != nil {
					return err
				}
				return s.SaveWorld(tx, w)
			})
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	err = s.WithinTx(ctx, func(tx context.Context) error {
		w, err := s.LoadWorld(tx, now)
		if err != nil {
			return err
		}
		p := w.Players["pioneer"]
		if p.BuildingCounts[domain.BuildingLumberCamp] != 1 || p.ResourcesMilli[domain.ResWater] != 180*domain.ResourceScale || p.ResourcesMilli[domain.ResWood] != 40*domain.ResourceScale || p.SettlementCommandSeq != 1 {
			t.Fatalf("duplicate payment/asset or lost receipt after reload: %+v", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
