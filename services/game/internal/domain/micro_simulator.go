package domain

import (
	"fmt"
	"math"
	"time"
)

type BenchmarkMilestone struct {
	Code           string
	Name           string
	ReachedSeconds float64
	FormattedTime  string
	Population     int32
}

type BenchmarkRun struct {
	Completed      bool
	FailureReason  string
	StrategyCode   string
	StrategyName   string
	Description    string
	TotalSeconds   float64
	FormattedTotal string
	Milestones     []BenchmarkMilestone
}

func FormatDurationMMSS(sec float64) string {
	totalTenths := int64(math.Round(sec * 10))
	mins := totalTenths / 600
	remTenths := totalTenths % 600
	secs := remTenths / 10
	tenths := remTenths % 10
	if tenths == 0 {
		return fmt.Sprintf("%02d:%02d", mins, secs)
	}
	return fmt.Sprintf("%02d:%02d.%d", mins, secs, tenths)
}

// RunPhase1Benchmarks uses the same commands, integer production and capacity
// checks as actual players. Only ten opening clicks are supplied. No inventory,
// population or milestone is injected; decisions are attempted every ten seconds.
func RunPhase1Benchmarks() []BenchmarkRun {
	runs := []BenchmarkRun{}
	for _, st := range []struct {
		code, name string
		population int32
		explore    bool
	}{
		{"expansion", "扩张经营", 12, false},
		{"small_colony", "低人口经营", 8, false},
		{"early_exploration", "优先探索并承担一次失败", 12, true},
	} {
		run, _ := simulateSettlementOpening(st.code, st.name, st.population, st.explore)
		runs = append(runs, run)
	}
	return runs
}

func simulateSettlementOpening(code, name string, population int32, explore bool) (BenchmarkRun, *WorldState) {
	now := time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	p := w.Players["pioneer"]
	_ = GatherWater(p, 10, now)
	run := BenchmarkRun{StrategyCode: code, StrategyName: name, Description: "真实领域指令；开局 10 次取水，此后仅自动生产；每 10 秒作一次经营决策。", Milestones: []BenchmarkMilestone{}}
	type step struct {
		code, name string
		done       func() bool
		action     func(time.Time) error
	}
	steps := []step{}
	recruit := func(target int32) {
		steps = append(steps, step{fmt.Sprintf("population_%d", target), fmt.Sprintf("人口达到 %d", target), func() bool { return p.PopulationTotal >= target }, func(at time.Time) error { return RecruitResident(p, 1, at) }})
	}
	research := func(code string) {
		t, _ := FindTechnology(code)
		steps = append(steps, step{"research_" + code, t.Name, func() bool { return p.ResearchedTechnologies[code] }, func(at time.Time) error { return ResearchTechnology(p, code, p.SettlementCommandSeq+1, at) }})
	}
	build := func(code string, target int32) {
		b, _ := FindBuilding(code)
		steps = append(steps, step{fmt.Sprintf("%s_%d", code, target), b.Name, func() bool { return p.BuildingCounts[code] >= target }, func(at time.Time) error { return ConstructBuilding(p, code, 1, p.SettlementCommandSeq+1, at) }})
	}
	project := func(code string) {
		steps = append(steps, step{code, code, func() bool { return p.UnlockedBlueprints[code] }, func(at time.Time) error { return UnlockBlueprint(w, p, code, at) }})
	}
	recruit(1)
	research(TechWoodworking)
	recruit(4)
	build(BuildingLumberCamp, 1)
	build(BuildingHouse, 1)
	recruit(8)
	if population > 8 {
		build(BuildingLumberCamp, 2)
	}
	research(TechMining)
	build(BuildingQuarry, 1)
	research(TechCharcoal)
	build(BPCharcoalKiln, 1)
	if population > 8 {
		build(BuildingHouse, 2)
		recruit(population)
	}
	build(BPWaterCistern, 1)
	if explore {
		build(BPScoutCamp, 1)
		for _, item := range []string{"gear_wood_spear", "gear_linen_vest"} {
			steps = append(steps, step{item, "基础整备", func() bool { return p.RaidGearInventory[item] > 0 }, func(at time.Time) error { return ManageRaidGear(p, "craft", item, at) }})
		}
		steps = append(steps, step{"raid_mia", "首次探索失败后恢复建设", func() bool { return p.RaidLoadout.LastSettlementReport != nil }, func(at time.Time) error {
			if err := StartRaid(p, at); err != nil {
				return err
			}
			return ApplyRaidCommand(p, p.RaidLoadout.ActiveSession.RaidID, 1, RaidCommand{Action: "finish", Status: "MIA"}, at)
		}})
	}
	research(TechMechanics)
	build(BPBasicWorkshop, 1)
	if population <= 8 {
		project(BPPartFrame)
		project(BPPartTablet)
		project(BPPartValve)
	} else {
		project(BPPartValve)
		project(BPPartFrame)
		project(BPPartTablet)
	}
	project(BPMysteryTreasure)
	current := 0
	for sec := 0; sec <= 3600; sec++ {
		at := now.Add(time.Duration(sec) * time.Second)
		if sec%10 == 0 && current < len(steps) {
			st := steps[current]
			err := st.action(at)
			if err != nil {
				run.FailureReason = st.name + ": " + err.Error()
			}
			if st.done() {
				run.Milestones = append(run.Milestones, BenchmarkMilestone{Code: st.code, Name: st.name, ReachedSeconds: float64(sec), FormattedTime: FormatDurationMMSS(float64(sec)), Population: p.PopulationTotal})
				current++
			}
			// Cap-aware, fixed integer staffing. Basic gathering bootstraps the first
			// lumber camp; surplus workers gather water rather than exceeding job slots.
			if p.PopulationTotal < 2 {
				p.Workers = map[string]int32{JobWater: p.PopulationTotal}
			} else if JobCapacity(p, JobWood) == 0 {
				_ = AllocateWorkers(p, "manual", map[string]int32{JobForage: 1, JobWater: p.PopulationTotal - 1}, "", at)
			} else {
				remaining := p.PopulationTotal
				desired := map[string]int32{}
				water := max(int32(1), (p.PopulationTotal*180+1999)/2000)
				remaining -= water
				for _, j := range []struct {
					key  string
					want int32
				}{{JobCharcoal, max(1, p.PopulationTotal/6)}, {JobStone, p.PopulationTotal / 4}, {JobWood, remaining}} {
					n := min(j.want, JobCapacity(p, j.key), remaining)
					desired[j.key] = n
					remaining -= n
				}
				desired[JobWater] = water + remaining
				_ = AllocateWorkers(p, "manual", desired, "", at)
			}
		}
		if current == len(steps) {
			run.Completed = true
			run.FailureReason = ""
			run.TotalSeconds = float64(sec)
			run.FormattedTotal = FormatDurationMMSS(float64(sec))
			return run, w
		}
		AdvancePlayerSeconds(p, 1)
	}
	run.TotalSeconds = 3600
	run.FormattedTotal = "未完成"
	return run, w
}
