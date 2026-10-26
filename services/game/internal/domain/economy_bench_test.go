package domain

import (
	"fmt"
	"testing"
	"time"
)

// Saturated-book scenario: 100 accounts, 10,000 funded asks and six idle
// companies. It measures the domain tick and ledger audit, not SQL throughput.
func BenchmarkEconomyTickFullOrderBook(b *testing.B) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	w.Players = map[string]*PlayerState{}
	for i := 0; i < 100; i++ {
		p := NewBlankPlayer(fmt.Sprintf("bench%03d", i), now)
		p.Profession = ProfScientist
		w.Players[p.Handle] = p
		p.FrozenResourcesMilli[ResWood] = 100 * ResourceScale
		for j := 0; j < 100; j++ {
			w.NextOrderSeq++
			w.Orders = append(w.Orders, MarketOrder{ID: fmt.Sprintf("ord_%d", w.NextOrderSeq), MakerHandle: p.Handle, ItemKey: ResWood, Side: "ASK", Status: "OPEN", PriceBasis: GoldScale, QuantityMilli: 1000, RemainingMilli: 1000})
		}
	}
	for _, spec := range CompanyCatalog {
		if err := IntroduceCompany(w, spec.ID, 1000, 1000, 500, now.Add(time.Hour), now); err != nil {
			b.Fatal(err)
		}
		c := w.Economy.Companies[spec.ID]
		c.Status = "listed"
		w.Players["bench000"].ResourcesMilli[ShareKey(c.ID)] = 1000 * ResourceScale
	}
	if err := CheckEconomy(w); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		now = now.Add(time.Minute)
		if err := AdvanceEconomy(w, now); err != nil {
			b.Fatal(err)
		}
		if err := CheckEconomy(w); err != nil {
			b.Fatal(err)
		}
	}
}
