package httpadapter

import (
	"context"

	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/services/game/internal/domain"
)

func settlementCosts(p *domain.PlayerState, costs map[string]int64, rates map[string]int64) []*empire.CostItemDTO {
	out := make([]*empire.CostItemDTO, 0, len(costs))
	for _, key := range []string{domain.ResWater, domain.ResWood, domain.ResStone, domain.ResCharcoal, domain.ResFlint, domain.ResAncientShard} {
		need, ok := costs[key]
		if !ok {
			continue
		}
		cap := domain.ResourceCapacityMilli(p, key)
		eta := computeETASeconds(need, p.ResourcesMilli[key], rates[key])
		if cap > 0 && need > cap && p.ResourcesMilli[key] < need {
			eta = -1
		}
		out = append(out, &empire.CostItemDTO{ResourceKey: key, ResourceName: domain.ResourceName(key), RequiredMilli: need, CurrentMilli: p.ResourcesMilli[key], EtaSeconds: eta, CapacityMilli: cap})
	}
	return out
}

func mapSettlement(p *domain.PlayerState, rates map[string]int64) *empire.SettlementProgressDTO {
	guide := domain.CurrentSettlementGuide(p)
	out := &empire.SettlementProgressDTO{CommandSeq: p.SettlementCommandSeq, HousingCapacity: domain.HousingCapacity(p), Technologies: []*empire.TechnologyNodeDTO{}, Buildings: []*empire.BuildingNodeDTO{}, GuideCode: guide.Code, GuideTitle: guide.Title, GuideText: guide.Text}
	for _, t := range domain.TechnologyCatalog {
		available := domain.TechnologyAvailable(p, t)
		researched := p.ResearchedTechnologies[t.Code]
		reason := domain.CostsBlockReason(p, t.CostsMilli)
		if !available {
			reason = "请完成前置建设"
		}
		if researched {
			reason = "已掌握"
		}
		// Unknown future technology names and costs are not transmitted to players.
		if !available && !researched {
			continue
		}
		out.Technologies = append(out.Technologies, &empire.TechnologyNodeDTO{Code: t.Code, Name: t.Name, EffectSummary: t.EffectSummary, Costs: settlementCosts(p, t.CostsMilli, rates), Researched: researched, Visible: true, CanResearch: !researched && available && reason == "", BlockedReason: reason})
	}
	for _, b := range domain.BuildingCatalog {
		owned := p.BuildingCounts[b.Code]
		available := domain.BuildingAvailable(p, b)
		if !available && owned == 0 {
			continue
		}
		tech, _ := domain.FindTechnology(b.TechnologyCode)
		var costs map[string]int64
		var err error
		reason := "已建成"
		if owned < b.Limit {
			costs, err = domain.BuildingCosts(b, owned, 1)
			reason = domain.CostsBlockReason(p, costs)
			if err != nil {
				reason = err.Error()
			}
			if !available {
				reason = "请先研究技术并完成前置建设"
			}
		}
		out.Buildings = append(out.Buildings, &empire.BuildingNodeDTO{Code: b.Code, Name: b.Name, TechnologyName: tech.Name, EffectSummary: b.EffectSummary, Costs: settlementCosts(p, costs, rates), Owned: owned, Limit: b.Limit, Visible: true, Researched: p.ResearchedTechnologies[b.TechnologyCode], CanBuild: owned < b.Limit && available && err == nil && reason == "", BlockedReason: reason, JobKey: b.JobKey, Assigned: p.Workers[b.JobKey], TotalSlots: domain.JobCapacity(p, b.JobKey)})
	}
	return out
}

func (s *Server) ResearchTechnology(ctx context.Context, req *empire.ResearchTechnologyReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ResearchTechnology(ctx, req.Code, req.CommandSeq)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) ConstructBuilding(ctx context.Context, req *empire.ConstructBuildingReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ConstructBuilding(ctx, req.Code, req.Quantity, req.CommandSeq)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}
