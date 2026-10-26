// economy-sim is an offline, deterministic calibration tool. It has no database
// or network configuration and cannot change a live realm.
package main

import (
	"drop2empire/services/game/internal/domain"
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

func main() {
	consumables := flag.Bool("consumables", false, "report profession recipe reference costs only")
	flag.Parse()
	if *consumables {
		e := json.NewEncoder(os.Stdout)
		e.SetIndent("", "  ")
		if err := e.Encode(domain.ConsumableCostReports()); err != nil {
			panic(err)
		}
		return
	}
	scenarios := []domain.EconomyScenario{
		{Name: "industrial-consumables", Players: 48, Days: 14, DemandPerPlayer: 2, InputPricePct: 100, InitialPublicGold: 100000, Pack: domain.ResPrecisionPack},
		{Name: "price-recovery-vote", Players: 12, Days: 14, DemandPerPlayer: 2, InputPricePct: 200, InitialPublicGold: 100000, VotePricePct: 200},
		{Name: "baseline-12", Players: 12, Days: 14, DemandPerPlayer: 2, InputPricePct: 100, InitialPublicGold: 100000},
		{Name: "growth-48", Players: 48, Days: 14, DemandPerPlayer: 2, InputPricePct: 100, InitialPublicGold: 100000},
		{Name: "demand-collapse", Players: 12, Days: 14, DemandPerPlayer: 2, ShockDay: 4, InputPricePct: 100, InitialPublicGold: 100000},
		{Name: "input-price-shock", Players: 12, Days: 14, DemandPerPlayer: 2, InputPricePct: 200, InitialPublicGold: 100000},
		{Name: "cash-shortage", Players: 12, Days: 14, DemandPerPlayer: 2, InputPricePct: 100, InitialPublicGold: 12000},
	}
	for _, s := range domain.CompanyCatalog {
		scenarios = append(scenarios, domain.EconomyScenario{Name: "outage-" + s.ID, Players: 12, Days: 14, DemandPerPlayer: 2, StopCompany: s.ID, ShockDay: 4, InputPricePct: 100, InitialPublicGold: 100000})
	}
	var reports []domain.EconomySimulationReport
	for _, s := range scenarios {
		r, err := domain.RunEconomyScenario(s)
		if err != nil {
			fmt.Fprintln(os.Stderr, s.Name, err)
			os.Exit(1)
		}
		reports = append(reports, r)
	}
	e := json.NewEncoder(os.Stdout)
	e.SetIndent("", "  ")
	if err := e.Encode(reports); err != nil {
		panic(err)
	}
}
