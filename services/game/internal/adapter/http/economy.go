package httpadapter

import (
	"context"
	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/services/game/internal/domain"
	"sort"
	"time"
)

func economyCosts(needs, stock map[string]int64) []*empire.CostItemDTO {
	keys := make([]string, 0, len(needs))
	for k := range needs {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := []*empire.CostItemDTO{}
	for _, k := range keys {
		out = append(out, &empire.CostItemDTO{ResourceKey: k, ResourceName: domain.ResourceName(k), RequiredMilli: needs[k], CurrentMilli: stock[k], EtaSeconds: -1})
	}
	return out
}
func mapCompanyPlan(p domain.CompanyPlan) *empire.CompanyPlanDTO {
	return &empire.CompanyPlanDTO{Route: p.Route, ActiveLines: p.ActiveLines, AskPriceBasis: p.AskPrice, InputBudgetBasis: p.InputBudget, Pack: p.Pack, ExpandWith: p.ExpandWith, DividendBasis: p.Dividend, CapitalBudgetBasis: p.CapitalBudget}
}
func readCompanyPlan(p *empire.CompanyPlanDTO) domain.CompanyPlan {
	if p == nil {
		return domain.CompanyPlan{}
	}
	return domain.CompanyPlan{Route: p.Route, ActiveLines: p.ActiveLines, AskPrice: p.AskPriceBasis, InputBudget: p.InputBudgetBasis, Pack: p.Pack, ExpandWith: p.ExpandWith, Dividend: p.DividendBasis, CapitalBudget: p.CapitalBudgetBasis}
}
func date(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func mapEconomy(w *domain.WorldState, p *domain.PlayerState, admin bool) *empire.EconomyStateDTO {
	domain.EnsureEconomy(w, time.Now().UTC())
	e := w.Economy
	ps := domain.EnsureProfessional(p)
	professional := &empire.ProfessionalDTO{Level: ps.Level, FacilityName: domain.ProfessionFacilityName(p.Profession, max(int32(1), ps.Level)), BuildCosts: []*empire.CostItemDTO{}, ProductionMode: ps.ProductionMode, ProductionCharges: ps.ProductionCharges, ConstructionTool: ps.ConstructionTool, GuildTool: ps.GuildTool, SigilSeconds: ps.SigilSeconds, Consumables: []*empire.ConsumableDTO{}}
	out := &empire.EconomyStateDTO{Professional: professional, Companies: []*empire.CompanyDTO{}, CompanyCatalog: []*empire.CompanyDTO{}, Policies: []*empire.MonetaryPolicyDTO{}, PublicInventory: []*empire.InventoryAmountDTO{}, IssuedBasis: e.Issued, CancelledBasis: e.Cancelled, ReserveBasis: e.Reserve, PublicCashBasis: e.Public.Cash + e.Public.Escrow, HoldingsBasis: domain.MoneyHoldings(w)}
	if admin {
		for _, key := range sortedInventoryKeys(e.Public.Stock) {
			if e.Public.Stock[key] > 0 {
				out.PublicInventory = append(out.PublicInventory, &empire.InventoryAmountDTO{ItemKey: key, Name: domain.ResourceName(key), QuantityMilli: e.Public.Stock[key]})
			}
		}
	}
	for _, c := range e.Companies {
		out.CorporateCashBasis += c.Wallet.Cash + c.Wallet.Escrow
		out.IpoEscrowBasis += c.IPOCash
	}
	if p.Profession == domain.ProfNone && !admin && !domain.HasFinancialPosition(w, p) {
		return out
	}
	if p.Profession != domain.ProfNone || admin {
		professional.BuildCosts = economyCosts(domain.ProfessionFacilityCosts(ps.Level, ""), p.ResourcesMilli)
		if ps.Queue != nil {
			professional.QueueItem = ps.Queue.Item
			professional.QueueOutputMilli = ps.Queue.Output
			professional.RemainingSeconds = ps.Queue.RemainingSeconds
		}
		for _, s := range domain.ConsumableCatalog {
			professional.Consumables = append(professional.Consumables, &empire.ConsumableDTO{ItemKey: s.Key, Name: s.Name, Profession: s.Profession, Use: s.Use, Effect: s.Effect, InventoryMilli: p.ResourcesMilli[s.Key], OutputMilli: s.Output * 1000, Seconds: s.Seconds, Costs: economyCosts(s.Inputs, p.ResourcesMilli)})
		}
	}
	for _, s := range domain.CompanyCatalog {
		d := &empire.CompanyDTO{ID: s.ID, Name: s.Name, Asset: s.Asset, OutputKey: s.Output, OutputName: domain.ResourceName(s.Output), OutputMilli: s.OutputUnits * 1000, Status: "unannounced", Plan: mapCompanyPlan(domain.CompanyPlan{}), Vote: &empire.CompanyVoteDTO{Plan: mapCompanyPlan(domain.CompanyPlan{})}, Routes: []*empire.CompanyRouteDTO{}, Inventory: []*empire.InventoryAmountDTO{}}
		c := e.Companies[s.ID]
		stock := map[string]int64{}
		if c != nil {
			stock = c.Wallet.Stock
		}
		for _, r := range s.Recipes {
			d.Routes = append(d.Routes, &empire.CompanyRouteDTO{Code: r.Route, Seconds: r.Seconds, Inputs: economyCosts(r.Inputs, stock)})
		}
		if c == nil {
			if admin {
				out.CompanyCatalog = append(out.CompanyCatalog, d)
			}
			continue
		}
		d.Status = c.Status
		d.CashBasis = c.Wallet.Cash
		d.EscrowBasis = c.Wallet.Escrow
		d.RevenueBasis = c.Revenue
		d.ProfitBasis = c.RealizedProfit
		d.DividendsBasis = c.Dividends
		d.TotalShares = c.Shares
		d.IpoPriceBasis = c.IPOPrice
		d.IpoMinimumShares = c.IPOMinShares
		d.IpoEndsAt = date(c.IPOEnds)
		d.MySubscription = c.Subscriptions[p.Handle]
		for _, n := range c.Subscriptions {
			d.SubscribedShares += n
		}
		key := domain.ShareKey(s.ID)
		d.MyShares = p.ResourcesMilli[key] / 1000
		d.MyFrozenShares = p.FrozenResourcesMilli[key] / 1000
		d.LastTradeBasis = w.LastPricesBasis[key]
		for _, o := range w.Orders {
			if o.ItemKey != key || o.Status != "OPEN" {
				continue
			}
			if o.Side == "BID" {
				d.BestBidBasis = max(d.BestBidBasis, o.PriceBasis)
			} else if d.BestAskBasis == 0 || o.PriceBasis < d.BestAskBasis {
				d.BestAskBasis = o.PriceBasis
			}
		}
		d.Lines = c.Lines
		d.RunningLines = int32(len(c.Batches))
		d.CompletedBatches = c.CompletedBatches
		d.StatusReason = c.StatusReason
		d.NextVoteAt = date(c.NextVoteAt)
		d.Plan = mapCompanyPlan(c.Plan)
		if c.Expansion != nil {
			d.ExpansionPack = c.Expansion.Pack
			d.ExpansionBudgetBasis = c.Expansion.Budget
		}
		if v := c.Vote; v != nil {
			d.Vote = &empire.CompanyVoteDTO{ID: v.ID, EndsAt: date(v.Ends), MyWeight: v.Weights[p.Handle], Result: v.Result, Plan: mapCompanyPlan(v.Plan)}
			if b, ok := v.Ballots[p.Handle]; ok {
				if b {
					d.Vote.MyBallot = "yes"
				} else {
					d.Vote.MyBallot = "no"
				}
			}
			for h, b := range v.Ballots {
				if b {
					d.Vote.YesShares += v.Weights[h]
				} else {
					d.Vote.NoShares += v.Weights[h]
				}
			}
		}
		for _, meta := range domain.ResourceCatalog {
			if c.Wallet.Stock[meta.Key]+c.Wallet.Frozen[meta.Key] > 0 {
				d.Inventory = append(d.Inventory, &empire.InventoryAmountDTO{ItemKey: meta.Key, Name: meta.Name, QuantityMilli: c.Wallet.Stock[meta.Key], FrozenMilli: c.Wallet.Frozen[meta.Key]})
			}
		}
		out.Companies = append(out.Companies, d)
		if admin && c.Status == "failed" {
			out.CompanyCatalog = append(out.CompanyCatalog, d)
		}
	}
	for i := len(e.Policies) - 1; i >= 0 && len(out.Policies) < 50; i-- {
		p := e.Policies[i]
		out.Policies = append(out.Policies, &empire.MonetaryPolicyDTO{ID: p.ID, Action: p.Action, AmountBasis: p.Amount, ItemKey: p.Item, QuantityMilli: p.Quantity, PriceBasis: p.Price, At: date(p.At)})
	}
	return out
}

func sortedInventoryKeys(stock map[string]int64) []string {
	keys := make([]string, 0, len(stock))
	for key := range stock {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (s *Server) EconomyAction(ctx context.Context, r *empire.EconomyActionReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.EconomyAction(ctx, r.CommandSeq, domain.EconomyCommand{Action: r.Action, Target: r.Target, Option: r.Option, Quantity: r.Quantity, VoteID: r.VoteId, Approve: r.Approve, Plan: readCompanyPlan(r.Plan)})
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}
func (s *Server) MonetaryPolicy(ctx context.Context, r *empire.MonetaryPolicyReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.MonetaryPolicy(ctx, domain.MonetaryPolicy{ID: r.PolicyId, Action: r.Action, Amount: r.AmountBasis, Item: r.ItemKey, Quantity: r.QuantityMilli, Price: r.PriceBasis})
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}
func (s *Server) IntroduceCompany(ctx context.Context, r *empire.IntroduceCompanyReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.IntroduceCompany(ctx, r.CompanyId, r.Shares, r.PriceBasis, r.MinimumShares, r.DurationHours)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}
