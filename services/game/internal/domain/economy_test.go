package domain

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"
)

func mustEconomy(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func fundPlayerByProcurement(t *testing.T, w *WorldState, p *PlayerState, amount int64, now time.Time) {
	t.Helper()
	id := fmt.Sprintf("fund-%s-%d", p.Handle, len(w.Economy.Policies))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: id, Action: "issue", Amount: amount}, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: id + "-budget", Action: "fund_public", Amount: amount}, now))
	oldProf := p.Profession
	p.Profession = ProfScientist
	p.ResourcesMilli[ResMeteorOre] += 1000
	mustEconomy(t, PlaceMarketOrder(w, p, ResMeteorOre, "ASK", amount, 1000, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: id + "-buy", Action: "procure", Item: ResMeteorOre, Price: amount, Quantity: 1000}, now))
	p.Profession = oldProf
	mustEconomy(t, CheckEconomy(w))
}
func fundedEconomy(t *testing.T) (*WorldState, *PlayerState, time.Time) {
	t.Helper()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	fundPlayerByProcurement(t, w, p, 1000*GoldScale, now)
	return w, p, now
}
func listedCompany(t *testing.T, w *WorldState, p *PlayerState, id string, now time.Time) *Company {
	t.Helper()
	mustEconomy(t, IntroduceCompany(w, id, 1000, 1000, 500, now.Add(time.Hour), now))
	mustEconomy(t, SubscribeIPO(w, p, id, 1000, now))
	settleIPO(w, w.Economy.Companies[id], now.Add(time.Hour))
	return w.Economy.Companies[id]
}

func TestCleanEconomyPoliciesAndPublicEscrow(t *testing.T) {
	now := time.Now().UTC()
	w := NewDefaultWorld(now)
	if w.TotalIssuedBasis != 0 || len(w.Orders) != 0 || len(w.Trades) != 0 {
		t.Fatal("clean world fabricated money or trading")
	}
	policy := MonetaryPolicy{ID: "issue-1", Action: "issue", Amount: 1000 * GoldScale}
	mustEconomy(t, ApplyMonetaryPolicy(w, policy, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, policy, now))
	if len(w.Economy.Policies) != 1 || len(w.PendingEconomyRecords) != 1 {
		t.Fatal("duplicate issuance")
	}
	policy.Amount++
	if ApplyMonetaryPolicy(w, policy, now) == nil {
		t.Fatal("policy rewrite accepted")
	}
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "fund-1", Action: "fund_public", Amount: 100 * GoldScale}, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "buy-1", Action: "procure", Item: ResWood, Price: GoldScale, Quantity: 100 * 1000}, now))
	if w.Economy.Public.Cash != 0 || w.Economy.Public.Escrow != 100*GoldScale {
		t.Fatal("public bid not escrowed")
	}
	if ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "overdraw", Action: "recall_public", Amount: GoldScale}, now) == nil {
		t.Fatal("spent escrow twice")
	}
	p := w.Players["archon_demo"]
	p.ResourcesMilli[ResWood] = 5000
	mustEconomy(t, PlaceMarketOrder(w, p, ResWood, "ASK", GoldScale, 5000, now))
	if p.GoldBasis != 5*GoldScale*99/100 || w.Economy.Public.Stock[ResWood] != 5000 {
		t.Fatal("public purchase failed")
	}
	if w.PermanentlyBurnedBasis != 0 {
		t.Fatal("trade silently burned money")
	}
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "cancel-1", Action: "cancel", Amount: 10 * GoldScale}, now))
	mustEconomy(t, CheckEconomy(w))
}

func TestIPOProrationShareTradingVotingAndDividends(t *testing.T) {
	w, p, now := fundedEconomy(t)
	q := NewBlankPlayer("investor", now)
	q.Profession = ProfMage
	w.Players[q.Handle] = q
	fundPlayerByProcurement(t, w, q, 1000*GoldScale, now)
	mustEconomy(t, IntroduceCompany(w, "alloy", 1001, 1000, 600, now.Add(time.Hour), now))
	mustEconomy(t, SubscribeIPO(w, p, "alloy", 1000, now))
	mustEconomy(t, SubscribeIPO(w, q, "alloy", 1000, now))
	c := w.Economy.Companies["alloy"]
	before := w.TotalIssuedBasis
	settleIPO(w, c, now.Add(time.Hour))
	if c.Wallet.Cash != 1001000 || c.Shares != 1001 || p.ResourcesMilli[ShareKey(c.ID)] != 501000 || q.ResourcesMilli[ShareKey(c.ID)] != 500000 {
		t.Fatal("incorrect largest-remainder allocation")
	}
	if before != w.TotalIssuedBasis {
		t.Fatal("IPO minted money")
	}
	mustEconomy(t, CheckEconomy(w))
	plan := c.Plan
	plan.Dividend = GoldScale
	voteAt := c.NextVoteAt
	mustEconomy(t, OpenCompanyVote(w, p, c.ID, plan, voteAt))
	id := c.Vote.ID
	mustEconomy(t, PlaceMarketOrder(w, p, ShareKey(c.ID), "ASK", 2000, 501000, voteAt))
	mustEconomy(t, PlaceMarketOrder(w, q, ShareKey(c.ID), "BID", 2000, 501000, voteAt))
	if c.Wallet.Cash != 1001000 {
		t.Fatal("secondary trading paid issuer")
	}
	if c.Vote.Weights[p.Handle] != 501 || c.Vote.Weights[q.Handle] != 500 {
		t.Fatal("vote rights moved with traded shares")
	}
	mustEconomy(t, VoteCompany(w, p, c.ID, id, true, voteAt))
	mustEconomy(t, VoteCompany(w, q, c.ID, id, true, voteAt))
	settleCompanyVote(w, c, voteAt.Add(24*time.Hour))
	if c.Dividends != 0 {
		t.Fatal("IPO principal paid as dividend")
	}
	// A real product sale recognizes cost and creates distributable earnings.
	c.Wallet.Stock[ResConductiveAlloy] = 10 * 1000
	c.StockCost[ResConductiveAlloy] = 10 * GoldScale
	mustEconomy(t, PlaceMarketOrder(w, q, ResConductiveAlloy, "BID", 20000, 10000, voteAt))
	mustEconomy(t, placeMarketOrder(w, walletMarketAccount(&c.Wallet), ResConductiveAlloy, "ASK", 20000, 10000, voteAt))
	if c.RealizedProfit != 98000 {
		t.Fatalf("COGS/tax recognition %d", c.RealizedProfit)
	}
	plan.ActiveLines = 0
	plan.InputBudget = 0
	plan.Dividend = 98000
	mustEconomy(t, OpenCompanyVote(w, q, c.ID, plan, c.NextVoteAt))
	mustEconomy(t, VoteCompany(w, q, c.ID, c.Vote.ID, true, c.NextVoteAt.Add(-7*24*time.Hour)))
	settleCompanyVote(w, c, c.Vote.Ends)
	if c.Dividends != 98000 {
		t.Fatalf("realized dividend not paid: %s", c.Vote.Result)
	}
	mustEconomy(t, CheckEconomy(w))
	RolloverSeason(w, "S2", now.Add(30*24*time.Hour))
	mustEconomy(t, CheckEconomy(w))
	if q.ResourcesMilli[ShareKey(c.ID)] != 1001000 || q.GoldBasis == 0 {
		t.Fatal("season erased financial rights")
	}
	mustEconomy(t, PlaceMarketOrder(w, q, ShareKey(c.ID), "ASK", 2000, 1000, now.Add(30*24*time.Hour)))
	mustEconomy(t, CheckEconomy(w))
}

func TestFailedIPORefundAndRetry(t *testing.T) {
	w, p, now := fundedEconomy(t)
	cash := p.GoldBasis
	mustEconomy(t, IntroduceCompany(w, "alloy", 1000, 1000, 800, now.Add(time.Hour), now))
	mustEconomy(t, SubscribeIPO(w, p, "alloy", 500, now))
	c := w.Economy.Companies["alloy"]
	settleIPO(w, c, c.IPOEnds)
	if p.GoldBasis != cash || c.IPOCash != 0 || c.Status != "failed" {
		t.Fatal("failed IPO did not refund")
	}
	settleIPO(w, c, c.IPOEnds.Add(time.Minute))
	if p.GoldBasis != cash {
		t.Fatal("refund replayed")
	}
	mustEconomy(t, IntroduceCompany(w, "alloy", 1000, 1000, 800, now.Add(2*time.Hour), now))
	mustEconomy(t, CheckEconomy(w))
}

func TestCompaniesUseRealMarketInputsAndPauseWithoutSales(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	s, _ := FindCompanySpec("alloy")
	for _, r := range ResourceCatalog {
		if n := s.Recipes[0].Inputs[r.Key]; n > 0 {
			p.ResourcesMilli[r.Key] += n * 20
			mustEconomy(t, PlaceMarketOrder(w, p, r.Key, "ASK", r.InitPriceBasis, n*20, now.Add(time.Hour)))
		}
	}
	// IPO capital is intentionally too small: no output or partial-input purchase.
	cash := c.Wallet.Cash
	mustEconomy(t, operateCompany(w, c, now.Add(time.Hour)))
	if len(c.Batches) != 0 || c.Wallet.Cash != cash {
		t.Fatal("unfunded batch started")
	}
	// Finance from an existing owner balance, explicitly as a test setup transfer.
	c.Wallet.Cash += 500 * GoldScale
	p.GoldBasis -= 500 * GoldScale
	mustEconomy(t, operateCompany(w, c, now.Add(time.Hour)))
	if len(c.Batches) != 1 {
		t.Fatal(c.StatusReason)
	}
	for _, n := range c.Wallet.Stock {
		if n < 0 {
			t.Fatal("negative stock")
		}
	}
	mustEconomy(t, AdvanceEconomy(w, now.Add(5*time.Hour)))
	if c.CompletedBatches != 2 {
		t.Fatalf("unbounded production without sales: %d", c.CompletedBatches)
	}
	if c.RealizedProfit != 0 || c.Revenue != 0 {
		t.Fatal("unsold stock recognized as profit")
	}
	mustEconomy(t, CheckEconomy(w))
}

func TestProfessionalFacilityCraftUseAndRetry(t *testing.T) {
	for _, prof := range []string{ProfScientist, ProfAlchemist, ProfMage, ProfArtisan} {
		t.Run(prof, func(t *testing.T) {
			w := NewDefaultWorld(time.Now())
			p := w.Players["pioneer"]
			p.Profession = prof
			p.UnlockedBlueprints[BPBasicWorkshop] = true
			for _, r := range ResourceCatalog {
				p.ResourcesMilli[r.Key] = 1_000_000
			}
			cmd := EconomyCommand{Action: "build_facility"}
			mustEconomy(t, ApplyEconomyCommand(w, p, 1, cmd, time.Now()))
			before := p.ResourcesMilli[ResIronIngot]
			mustEconomy(t, ApplyEconomyCommand(w, p, 1, cmd, time.Now()))
			if before != p.ResourcesMilli[ResIronIngot] || p.Professional.Level != 1 {
				t.Fatal("build replay charged twice")
			}
			for _, s := range ConsumableCatalog {
				if s.Profession != prof {
					if QueueProfessionalCraft(p, s.Key, 1, time.Now()) == nil {
						t.Fatal("cross-profession manufacturing allowed")
					}
					continue
				}
				p.ResourcesMilli[s.Key] = 0
				mustEconomy(t, QueueProfessionalCraft(p, s.Key, 1, time.Now()))
				AdvancePlayerSeconds(p, s.Seconds)
				if p.ResourcesMilli[s.Key] != s.Output*1000 {
					t.Fatal("no crafted output")
				}
			}
			if p.GoldBasis != 0 || w.TotalIssuedBasis != 0 {
				t.Fatal("zero-Gold entry failed")
			}
			p.ResourcesMilli[ResOverload] = 1000
			mustEconomy(t, UseConsumable(w, p, ResOverload, "", time.Now()))
			if p.Professional.ProductionCharges != 5 {
				t.Fatal("universal use blocked")
			}
		})
	}
}

func TestConsumableQueuePartitionAndFiveBatchLimit(t *testing.T) {
	now := time.Now()
	w := NewDefaultWorld(now)
	p := w.Players["archon_demo"]
	p.Professional = &ProfessionalState{Level: 1}
	for _, r := range ResourceCatalog {
		p.ResourcesMilli[r.Key] = 1_000_000
	}
	mustEconomy(t, UseConsumable(w, p, ResOverload, "", now))
	water := p.ResourcesMilli[ResWater]
	mustEconomy(t, QueueProfessionalCraft(p, ResOverload, 6, now))
	if p.Professional.Queue.RemainingSeconds != 600 || water-p.ResourcesMilli[ResWater] != 140000 {
		t.Fatal("consumable affected wrong batch count or water cost")
	}
	raw, _ := json.Marshal(p)
	var q PlayerState
	mustEconomy(t, json.Unmarshal(raw, &q))
	AdvancePlayerSeconds(p, 600)
	for i := 0; i < 60; i++ {
		AdvancePlayerSeconds(&q, 10)
	}
	if !reflect.DeepEqual(p.ResourcesMilli, q.ResourcesMilli) || p.Professional.Queue != nil || q.Professional.Queue != nil {
		t.Fatal("polling changed output")
	}
}

func TestCompanyProductionClockPartitions(t *testing.T) {
	w, p, now := fundedEconomy(t)
	c := listedCompany(t, w, p, "alloy", now)
	for k, n := range CompanyCatalog[0].Recipes[0].Inputs {
		c.Wallet.Stock[k] = n * 5
	}
	raw, _ := json.Marshal(w)
	var q WorldState
	mustEconomy(t, json.Unmarshal(raw, &q))
	mustEconomy(t, AdvanceEconomy(w, now.Add(3*time.Hour)))
	for i := 1; i <= 180; i++ {
		mustEconomy(t, AdvanceEconomy(&q, now.Add(time.Duration(i)*time.Minute)))
	}
	a, _ := json.Marshal(w.Economy)
	b, _ := json.Marshal(q.Economy)
	if string(a) != string(b) {
		t.Fatal("company output depends on polling frequency")
	}
}
