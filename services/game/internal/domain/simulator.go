package domain

import (
	"fmt"
	"math"
)

type BenchmarkMilestone struct {
	Code           string
	Name           string
	ReachedSeconds float64
	FormattedTime  string
	Population     int32
}

type BenchmarkRun struct {
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

// RunPhase1Benchmarks runs the deterministic 0.5s-step simulation from 0 water & 10 initial manual clicks
// through all Phase 1 milestones including the 3 Treasure Parts (GDD 4.4 & 21.1).
func RunPhase1Benchmarks() []BenchmarkRun {
	strategies := []struct {
		code       string
		name       string
		desc       string
		waterShare [4]float64 // [before_axe, axe_to_quarry, quarry_to_workshop, workshop_to_treasure]
		woodShare  [4]float64
		stoneShare [4]float64
		useUpgrades bool
	}{
		{
			code:        "gdd_baseline",
			name:        "GDD 4.4 原始基准策略（无中间工具增效）",
			desc:        "仅开局手点 10 次水，严格按 100% → 70/30 → 60/25/15 → 50/30/20 固定比例分配，不购买引水轮/石锯/三部件增效。",
			waterShare:  [4]float64{1.0, 0.70, 0.60, 0.50},
			woodShare:   [4]float64{0.0, 0.30, 0.25, 0.30},
			stoneShare:  [4]float64{0.0, 0.00, 0.15, 0.20},
			useUpgrades: false,
		},
		{
			code:        "balanced_parts",
			name:        "V1 推荐均衡策略（含引水轮 + 石锯 + 宝藏三部件）",
			desc:        "在第 9–30 分钟区间依次制造【导水阀芯】【承压木框】【铭文石板】，每 3–5 分钟获得一次阶段性产能正反馈。",
			waterShare:  [4]float64{1.0, 0.70, 0.60, 0.48},
			woodShare:   [4]float64{0.0, 0.30, 0.25, 0.30},
			stoneShare:  [4]float64{0.0, 0.00, 0.15, 0.22},
			useUpgrades: true,
		},
		{
			code:        "sprint_dynamic",
			name:        "激进动态调仓策略（按缺口实时切换重心）",
			desc:        "人口达标前全力打水，解锁伐木/采石后根据当前目标蓝图的短板资源动态倾斜劳动力。",
			waterShare:  [4]float64{1.0, 0.65, 0.55, 0.44},
			woodShare:   [4]float64{0.0, 0.35, 0.28, 0.32},
			stoneShare:  [4]float64{0.0, 0.00, 0.17, 0.24},
			useUpgrades: true,
		},
	}

	runs := make([]BenchmarkRun, 0, len(strategies))
	for _, st := range strategies {
		runs = append(runs, simulateSingleRun(st.code, st.name, st.desc, st.waterShare, st.woodShare, st.stoneShare, st.useUpgrades))
	}
	return runs
}

func simulateSingleRun(
	code, name, desc string,
	waterShare, woodShare, stoneShare [4]float64,
	useUpgrades bool,
) BenchmarkRun {
	// Start after 10 manual clicks (10s elapsed at 1 click/sec = 10,000 milli water)
	simSec := 10.0
	water := int64(10) * ResourceScale
	wood := int64(0)
	stone := int64(0)
	pop := int32(0)

	unlocked := map[string]bool{}
	var milestones []BenchmarkMilestone

	recordMilestone := func(mCode, mName string) {
		milestones = append(milestones, BenchmarkMilestone{
			Code:           mCode,
			Name:           mName,
			ReachedSeconds: simSec,
			FormattedTime:  FormatDurationMMSS(simSec),
			Population:     pop,
		})
	}

	// Step 0.5s ticks up to 60 minutes max
	for step := 0; step < 7200; step++ {
		// Determine current target population cap
		targetPop := int32(10)
		if unlocked[BPAxeBlueprint] {
			targetPop = 25
		}
		if unlocked[BPQuarryTech] {
			targetPop = 40
		}

		// Recruit residents if below targetPop
		for pop < targetPop {
			cost := NextResidentCostMilli(pop)
			if water >= cost {
				water -= cost
				pop++
				if pop == 1 {
					recordMilestone("first_resident", "首位居民（自动打水）")
				}
			} else {
				break
			}
		}

		// Check blueprint unlocks
		if !unlocked[BPAxeBlueprint] && pop >= 10 && water >= 200*ResourceScale {
			water -= 200 * ResourceScale
			unlocked[BPAxeBlueprint] = true
			recordMilestone(BPAxeBlueprint, "斧头蓝图（解锁伐木）")
		}
		if useUpgrades && unlocked[BPAxeBlueprint] && !unlocked[BPWaterWheel1] && pop >= 16 &&
			water >= 350*ResourceScale && wood >= 80*ResourceScale {
			water -= 350 * ResourceScale
			wood -= 80 * ResourceScale
			unlocked[BPWaterWheel1] = true
			recordMilestone(BPWaterWheel1, "木制引水轮（打水+25%）")
		}
		if unlocked[BPAxeBlueprint] && !unlocked[BPQuarryTech] && pop >= 25 &&
			water >= 600*ResourceScale && wood >= 300*ResourceScale {
			water -= 600 * ResourceScale
			wood -= 300 * ResourceScale
			unlocked[BPQuarryTech] = true
			recordMilestone(BPQuarryTech, "采石技术（解锁采石）")
		}
		if useUpgrades && unlocked[BPQuarryTech] && !unlocked[BPStoneSaw1] && pop >= 32 &&
			water >= 1600*ResourceScale && wood >= 650*ResourceScale && stone >= 180*ResourceScale {
			water -= 1600 * ResourceScale
			wood -= 650 * ResourceScale
			stone -= 180 * ResourceScale
			unlocked[BPStoneSaw1] = true
			recordMilestone(BPStoneSaw1, "石刃联动锯台（木/石+25%）")
		}
		if unlocked[BPQuarryTech] && !unlocked[BPBasicWorkshop] && pop >= 40 &&
			water >= 5000*ResourceScale && wood >= 1500*ResourceScale && stone >= 500*ResourceScale {
			water -= 5000 * ResourceScale
			wood -= 1500 * ResourceScale
			stone -= 500 * ResourceScale
			unlocked[BPBasicWorkshop] = true
			recordMilestone(BPBasicWorkshop, "基础工坊（开放宝藏锻造）")
		}

		if useUpgrades {
			if unlocked[BPBasicWorkshop] && !unlocked[BPPartValve] &&
				water >= 4200*ResourceScale && wood >= 1400*ResourceScale && stone >= 400*ResourceScale {
				water -= 4200 * ResourceScale
				wood -= 1400 * ResourceScale
				stone -= 400 * ResourceScale
				unlocked[BPPartValve] = true
				recordMilestone(BPPartValve, "宝藏部件 I · 导水阀芯")
			}
			if unlocked[BPPartValve] && !unlocked[BPPartFrame] &&
				water >= 4800*ResourceScale && wood >= 2200*ResourceScale && stone >= 550*ResourceScale {
				water -= 4800 * ResourceScale
				wood -= 2200 * ResourceScale
				stone -= 550 * ResourceScale
				unlocked[BPPartFrame] = true
				recordMilestone(BPPartFrame, "宝藏部件 II · 承压木框")
			}
			if unlocked[BPPartFrame] && !unlocked[BPPartTablet] &&
				water >= 5000*ResourceScale && wood >= 1600*ResourceScale && stone >= 800*ResourceScale {
				water -= 5000 * ResourceScale
				wood -= 1600 * ResourceScale
				stone -= 800 * ResourceScale
				unlocked[BPPartTablet] = true
				recordMilestone(BPPartTablet, "宝藏部件 III · 铭文石板")
			}
			if unlocked[BPPartTablet] && !unlocked[BPMysteryTreasure] &&
				water >= 4000*ResourceScale && wood >= 1800*ResourceScale && stone >= 450*ResourceScale {
				water -= 4000 * ResourceScale
				wood -= 1800 * ResourceScale
				stone -= 450 * ResourceScale
				unlocked[BPMysteryTreasure] = true
				recordMilestone(BPMysteryTreasure, "神秘的宝藏（选择职业）")
				break
			}
		} else {
			// Original GDD 4.4 lump-sum treasure cost: 18,000 water + 7,000 wood + 2,200 stone
			if unlocked[BPBasicWorkshop] && !unlocked[BPMysteryTreasure] &&
				water >= 18000*ResourceScale && wood >= 7000*ResourceScale && stone >= 2200*ResourceScale {
				water -= 18000 * ResourceScale
				wood -= 7000 * ResourceScale
				stone -= 2200 * ResourceScale
				unlocked[BPMysteryTreasure] = true
				recordMilestone(BPMysteryTreasure, "神秘的宝藏（选择职业）")
				break
			}
		}

		// Allocate integer workers for this 0.5s tick
		stageIdx := 0
		if unlocked[BPBasicWorkshop] {
			stageIdx = 3
		} else if unlocked[BPQuarryTech] {
			stageIdx = 2
		} else if unlocked[BPAxeBlueprint] {
			stageIdx = 1
		}

		wWood := int32(math.Round(float64(pop) * woodShare[stageIdx]))
		wStone := int32(math.Round(float64(pop) * stoneShare[stageIdx]))
		wWater := pop - wWood - wStone

		waterMult := int64(100)
		woodMult := int64(100)
		stoneMult := int64(100)
		if useUpgrades {
			if unlocked[BPWaterWheel1] {
				waterMult += 25
			}
			if unlocked[BPStoneSaw1] {
				woodMult += 25
				stoneMult += 25
			}
			if unlocked[BPPartValve] {
				waterMult += 20
			}
			if unlocked[BPPartFrame] {
				woodMult += 25
			}
			if unlocked[BPPartTablet] {
				stoneMult += 30
			}
		}

		// 0.5s tick output: (workers * baseRateMilliPerSec * mult / 100) / 2
		water += (int64(wWater) * 2000 * waterMult) / 200
		wood += (int64(wWood) * 450 * woodMult) / 200
		stone += (int64(wStone) * 220 * stoneMult) / 200
		simSec += 0.5
	}

	return BenchmarkRun{
		StrategyCode:   code,
		StrategyName:   name,
		Description:    desc,
		TotalSeconds:   simSec,
		FormattedTotal: FormatDurationMMSS(simSec),
		Milestones:     milestones,
	}
}
