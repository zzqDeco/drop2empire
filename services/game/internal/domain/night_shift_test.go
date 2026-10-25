package domain

import (
	"reflect"
	"testing"
	"time"
)

func nightShiftPlayer(t *testing.T) *PlayerState {
	t.Helper()
	p := NewBlankPlayer("night-shift", time.Unix(1000, 0))
	p.PopulationTotal = 4
	p.Workers = map[string]int32{JobWater: 3, JobForage: 1}
	p.BuildingCounts[BPColonyEdicts] = 1
	p.BuildingCounts[BuildingLumberCamp] = 1
	p.BuildingCounts[BPCharcoalKiln] = 1
	p.ResourcesMilli[ResWater] = 100 * ResourceScale
	EnsureSettlementState(p)
	if err := ToggleEdict(p, EdictNightShift, time.Unix(1000, 0)); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestNightShiftRequiresOneFullTickOfStoredFuel(t *testing.T) {
	for _, tc := range []struct {
		name       string
		wood       int64
		remainder  int64
		job        string
		disabled   bool
		wantActive bool
	}{
		{name: "zero wood with forager", job: JobForage},
		{name: "positive but insufficient", wood: 1, job: JobForage},
		{name: "just below threshold", wood: 399, remainder: 999, job: JobForage},
		{name: "exact fuel", wood: 400, job: JobForage, wantActive: true},
		{name: "above threshold", wood: 401, job: JobForage, wantActive: true},
		{name: "future lumber output cannot pay upfront", job: JobWood},
		{name: "funded lumber shift", wood: 400, job: JobWood, wantActive: true},
		{name: "disabled with fuel", wood: 400, job: JobForage, disabled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := nightShiftPlayer(t)
			p.Workers = map[string]int32{JobWater: 3, tc.job: 1}
			p.ResourcesMilli[ResWood] = tc.wood
			p.ProductionRemainders = map[string]int64{ResWood: tc.remainder}
			p.ActiveEdicts[EdictNightShift] = !tc.disabled
			wantWater, wantWaterDrain, wantWood, wantFuel := int64(6000), int64(720), int64(150), int64(0)
			if tc.job == JobWood {
				wantWood = 450
			}
			if tc.wantActive {
				wantWater, wantWaterDrain, wantFuel = 8700, 1280, 400
				wantWood = wantWood * 145 / 100
			}
			gross, drain, net := ComputeResourceFlows(p)
			if gross[ResWater] != wantWater || drain[ResWater] != wantWaterDrain || gross[ResWood] != wantWood || drain[ResWood] != wantFuel {
				t.Fatalf("unfunded or incorrectly priced shift: gross=%v drain=%v", gross, drain)
			}
			AdvancePlayerSeconds(p, 1)
			if p.ResourcesMilli[ResWater] != 100*ResourceScale+net[ResWater] || p.ResourcesMilli[ResWood] != tc.wood+net[ResWood] || p.ProductionRemainders[ResWood] != tc.remainder {
				t.Fatalf("preview and paid production diverged: stocks=%v remainders=%v net=%v", p.ResourcesMilli, p.ProductionRemainders, net)
			}
			if p.ActiveEdicts[EdictNightShift] != !tc.disabled {
				t.Fatal("fuel shortage changed the player's edict setting")
			}
		})
	}
}

func TestNightShiftForagerPausesAndResumesWithoutUnpaidFuel(t *testing.T) {
	p := nightShiftPlayer(t)
	// Three ordinary ticks build the first fuel reserve. Every active tick then
	// burns exactly 400 milli; the forager cannot sustain a continuous night shift.
	wantWood := []int64{150, 300, 450, 267, 417, 234, 384, 534, 351, 501}
	wantWaterGain := []int64{5280, 5280, 5280, 7420, 5280, 7420, 5280, 5280, 7420, 5280}
	for i := range wantWood {
		waterBefore := p.ResourcesMilli[ResWater]
		AdvancePlayerSeconds(p, 1)
		if p.ResourcesMilli[ResWood] != wantWood[i] || p.ResourcesMilli[ResWater]-waterBefore != wantWaterGain[i] {
			t.Fatalf("tick %d: wood=%d, water gain=%d", i+1, p.ResourcesMilli[ResWood], p.ResourcesMilli[ResWater]-waterBefore)
		}
	}
	if !p.ActiveEdicts[EdictNightShift] || p.ResourcesMilli[ResWater] != 159220 {
		t.Fatal("shift did not resume automatically with fully paid ticks")
	}
}

func TestNightShiftFuelCannotAlsoFeedCharcoalProduction(t *testing.T) {
	p := nightShiftPlayer(t)
	p.Workers = map[string]int32{JobWater: 3, JobCharcoal: 1}
	p.ResourcesMilli[ResWood] = 400
	gross, drain, _ := ComputeResourceFlows(p)
	if gross[ResCharcoal] != 0 || drain[ResWood] != 400 {
		t.Fatalf("preview reused reserved fuel: gross=%v drain=%v", gross, drain)
	}
	AdvancePlayerSeconds(p, 1)
	if p.ResourcesMilli[ResWood] != 0 || p.ResourcesMilli[ResCharcoal] != 0 || p.ResourcesMilli[ResWater] != 107420 {
		t.Fatalf("night shift and charcoal reused fuel: %v", p.ResourcesMilli)
	}
}

func TestNightShiftFuelAccountingIsIndependentOfPolling(t *testing.T) {
	batch, seconds, fractional := nightShiftPlayer(t), nightShiftPlayer(t), nightShiftPlayer(t)
	AdvancePlayerSeconds(batch, 60)
	for i := 0; i < 60; i++ {
		AdvancePlayerSeconds(seconds, 1)
	}
	for i := 1; i <= 600; i++ {
		SettleProduction(fractional, time.Unix(1000, 0).Add(time.Duration(i)*100*time.Millisecond))
	}
	for _, other := range []*PlayerState{seconds, fractional} {
		if !reflect.DeepEqual(batch.ResourcesMilli, other.ResourcesMilli) || !reflect.DeepEqual(batch.ProductionRemainders, other.ProductionRemainders) || batch.SimulatedElapsedSeconds != other.SimulatedElapsedSeconds || batch.SimulatedRemainderMs != other.SimulatedRemainderMs {
			t.Fatal("polling frequency changed paid night-shift production")
		}
	}
}
