package domain

import (
	"reflect"
	"testing"
	"time"
)

func TestProfessionChoiceUnlocksProductionWithoutFreeStockOrWarRewards(t *testing.T) {
	for _, spec := range ProfessionCatalog {
		t.Run(spec.Code, func(t *testing.T) {
			now := time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)
			p := NewBlankPlayer("new-lord", now)
			p.UnlockedBlueprints[BPMysteryTreasure] = true
			before := make(map[string]int64)
			for k, n := range p.ResourcesMilli {
				before[k] = n
			}
			if err := ChooseProfession(p, spec.Code, now); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(before, p.ResourcesMilli) || p.ActivityPoints != 0 || p.GoldBasis != 0 {
				t.Fatal("choosing a profession bypassed paid manufacturing or actual war participation")
			}
			if EnsureProfessional(p).Level != 0 {
				t.Fatal("profession choice built a facility")
			}
		})
	}
}

func TestProfessionalCostsExplainStorageAndIronShortfalls(t *testing.T) {
	p := NewBlankPlayer("builder", time.Now())
	for k, n := range ProfessionFacilityCosts(0, "") {
		p.ResourcesMilli[k] = n
	}
	p.ResourcesMilli[ResIronIngot] = 0
	if CostsBlockReason(p, ProfessionFacilityCosts(0, "")) == "" {
		t.Fatal("missing iron was reported as affordable")
	}
}

func TestSimultaneousEventsRemainDistinctAfterLogFills(t *testing.T) {
	now := time.Now()
	p := NewBlankPlayer("events", now)
	seen := map[string]bool{}
	for i := 0; i < OverallBalance.MaxEventLogEntries+8; i++ {
		AppendLog(p, now, "IPO", "company event")
		id := p.EventLogs[0].ID
		if seen[id] {
			t.Fatal("events sharing a settlement timestamp overwrite notification identity")
		}
		seen[id] = true
	}
}

func TestNewEconomyHasNoDemoAccountsAndCannotRecreateThem(t *testing.T) {
	w := NewEmptyWorld(time.Now())
	EnsureDefaultAccounts(w, time.Now())
	if len(w.Players) != 0 || w.TotalIssuedBasis != 0 || len(w.Orders) != 0 || len(w.Economy.Companies) != 0 {
		t.Fatal("production bootstrap seeded accounts, goods or liquidity")
	}
}

func TestLaunchReplayUsesRealProductionAndFiniteDemand(t *testing.T) {
	r, err := RunLaunchProgression()
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Players) != 4 || len(r.Companies) != 6 || r.TerminalPacksConsumed != 16 || r.IssuedBasis != r.HoldingsBasis || r.LedgerChecks < 700 {
		t.Fatalf("incomplete launch chain: %+v", r)
	}
	for _, p := range r.Players {
		if p.FacilitySeconds <= p.OpeningSeconds || p.FirstCraftSeconds <= p.FacilitySeconds || p.FirstSaleSeconds == 0 || p.ProductionUseSeconds == 0 || p.UpgradeSeconds == 0 || len(p.Crafted) != 3 {
			t.Fatalf("profession loop stalled: %+v", p)
		}
		if p.Profession != ProfAlchemist && p.CrossProfessionPurchases != 1 {
			t.Fatalf("no actual cross-profession purchase: %+v", p)
		}
	}
	for _, c := range r.Companies {
		if c.Batches == 0 || c.Revenue == 0 || c.Cash < 0 {
			t.Fatalf("unfunded or inactive chain: %+v", c)
		}
	}
}
