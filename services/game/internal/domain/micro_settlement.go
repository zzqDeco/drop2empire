package domain

import (
	"fmt"
	"math"
	"time"
)

// NextResidentCostMilli computes the exact water cost (in milli-units) to recruit resident #(n+1) when current population is n,
// driven entirely by SettlementBalance parameters.
func NextResidentCostMilli(n int32) int64 {
	if n < 0 {
		n = 0
	}
	if n < SettlementBalance.EarlyPopThreshold {
		cost := math.Ceil(SettlementBalance.EarlyBaseCost * math.Pow(SettlementBalance.EarlyGrowthFactor, float64(n)))
		return int64(cost) * ResourceScale
	}
	extra := float64(n - SettlementBalance.EarlyPopThreshold + 1)
	cost := math.Ceil(SettlementBalance.LateBaseCost + SettlementBalance.LateSlope*math.Pow(extra, SettlementBalance.LateExponent))
	return int64(cost) * ResourceScale
}

// ResourceCapacityMilli computes the storage capacity for resKey by starting from BaseResourceCapacityUnits
// and applying any unlocked BlueprintSpec.CapacityOverrideUnits modifiers.
func ResourceCapacityMilli(p *PlayerState, resKey string) int64 {
	capUnits, exists := BaseResourceCapacityUnits[resKey]
	if !exists {
		return 0
	}
	for _, bp := range BlueprintCatalog {
		if !p.UnlockedBlueprints[bp.Code] {
			continue
		}
		if override, ok := bp.CapacityOverrideUnits[resKey]; ok && override > capUnits {
			capUnits = override
		}
	}
	return capUnits * ResourceScale
}

func addResourceWithCap(p *PlayerState, resKey string, deltaMilli int64) int64 {
	if deltaMilli <= 0 {
		return 0
	}
	capMilli := ResourceCapacityMilli(p, resKey)
	cur := p.ResourcesMilli[resKey]
	if capMilli <= 0 {
		p.ResourcesMilli[resKey] = cur + deltaMilli
		return 0
	}
	if cur+deltaMilli <= capMilli {
		p.ResourcesMilli[resKey] = cur + deltaMilli
		return 0
	}
	overflow := (cur + deltaMilli) - capMilli
	p.ResourcesMilli[resKey] = capMilli
	return overflow
}

type ComputedJob struct {
	JobKey                 string
	Name                   string
	OutputResourceKey      string
	Assigned               int32
	BaseRateMilli          int64
	EffectiveRateMilli     int64
	TotalOutputPerSecMilli int64
	EfficiencyPct          int32
	Unlocked               bool
	UnlockHint             string
	InputSummary           string
}

func isEdictEffectivelyActive(p *PlayerState, ed EdictSpec) bool {
	if !p.ActiveEdicts[ed.Code] {
		return false
	}
	if ed.PrerequisiteCode != "" && !p.UnlockedBlueprints[ed.PrerequisiteCode] {
		return false
	}
	if ed.Code == EdictNightShift && p.ResourcesMilli[ResWood] <= 0 && p.Workers[JobWood] <= 0 {
		return false
	}
	if ed.Code == EdictHydroSaw && p.ResourcesMilli[ResWater] <= 0 {
		return false
	}
	return true
}

// ComputeJobs evaluates all worker job efficiencies and outputs purely by aggregating modifiers
// from BlueprintCatalog, EdictCatalog, ProfessionCatalog, and EquipmentCatalog.
func ComputeJobs(p *PlayerState) []ComputedJob {
	effByJob := make(map[string]int64, len(JobCatalog))
	for _, js := range JobCatalog {
		effByJob[js.Key] = 100
	}

	// 1. Unlocked Blueprint modifiers
	for _, bp := range BlueprintCatalog {
		if !p.UnlockedBlueprints[bp.Code] {
			continue
		}
		for jobKey, bonusPct := range bp.JobEfficiencyBonusPct {
			effByJob[jobKey] += bonusPct
		}
	}

	// 2. Active Edict & Mechanism modifiers
	for _, ed := range EdictCatalog {
		if !isEdictEffectivelyActive(p, ed) {
			continue
		}
		for jobKey, bonusPct := range ed.JobEfficiencyBonusPct {
			effByJob[jobKey] += bonusPct
		}
	}

	// 3. Chosen Profession passive modifiers
	for _, prof := range ProfessionCatalog {
		if p.Profession == prof.Code {
			for jobKey, bonusPct := range prof.JobEfficiencyBonusPct {
				effByJob[jobKey] += bonusPct
			}
			break
		}
	}

	// 4. Installed Workshop Equipment stack modifiers
	for _, eq := range EquipmentCatalog {
		stacks := int64(p.InstalledEquipments[eq.ItemKey])
		if stacks <= 0 {
			continue
		}
		for jobKey, perStackPct := range eq.JobEfficiencyPerStack {
			effByJob[jobKey] += stacks * perStackPct
		}
	}

	// 5. Dehydration penalty on non-water jobs
	if p.HydrationWarning {
		for _, js := range JobCatalog {
			if js.Key != JobWater {
				effByJob[js.Key] = (effByJob[js.Key] * SettlementBalance.DehydrationEfficiencyPct) / 100
			}
		}
	}

	out := make([]ComputedJob, 0, len(JobCatalog))
	for _, js := range JobCatalog {
		unlocked := p.PopulationTotal > 0
		if js.RequiredBlueprint != "" && !p.UnlockedBlueprints[js.RequiredBlueprint] {
			unlocked = false
		}
		if js.RequiresProfession && p.Profession == ProfNone {
			unlocked = false
		}
		assigned := p.Workers[js.Key]
		if !unlocked {
			assigned = 0
		}
		effPct := effByJob[js.Key]
		effRate := (js.BaseRateMilli * effPct) / 100
		totalRate := int64(assigned) * effRate
		out = append(out, ComputedJob{
			JobKey:                 js.Key,
			Name:                   js.Name,
			OutputResourceKey:      js.OutputResourceKey,
			Assigned:               assigned,
			BaseRateMilli:          js.BaseRateMilli,
			EffectiveRateMilli:     effRate,
			TotalOutputPerSecMilli: totalRate,
			EfficiencyPct:          int32(effPct),
			Unlocked:               unlocked,
			UnlockHint:             js.UnlockHint,
			InputSummary:           js.InputSummary,
		})
	}
	return out
}

func ComputeResourceFlows(p *PlayerState) (gross map[string]int64, drain map[string]int64, net map[string]int64) {
	gross = make(map[string]int64, len(ResourceCatalog))
	drain = make(map[string]int64, len(ResourceCatalog))
	net = make(map[string]int64, len(ResourceCatalog))

	jobs := ComputeJobs(p)
	jobMap := make(map[string]ComputedJob, len(jobs))
	for _, j := range jobs {
		jobMap[j.JobKey] = j
	}

	byproductMult := int64(1)
	for _, bp := range BlueprintCatalog {
		if p.UnlockedBlueprints[bp.Code] && bp.DoublesByproductProc {
			byproductMult = 2
			break
		}
	}

	gross[ResWater] += jobMap[JobWater].TotalOutputPerSecMilli

	woodOut := jobMap[JobWood].TotalOutputPerSecMilli
	gross[ResWood] += woodOut
	if woodOut > 0 {
		gross[ResFlint] += (woodOut * byproductMult) / SettlementBalance.WoodToFlintDivisor
	}

	stoneOut := jobMap[JobStone].TotalOutputPerSecMilli
	gross[ResStone] += stoneOut
	if stoneOut > 0 {
		gross[ResFlint] += (stoneOut * byproductMult) / SettlementBalance.StoneToFlintDivisor
		gross[ResAncientShard] += (stoneOut * byproductMult) / SettlementBalance.StoneToAncientShardDivisor
	}

	if p.PopulationTotal >= SettlementBalance.MinPopForHydrationDrain {
		perPopWater := SettlementBalance.BaseWaterDrainPerPop
		for _, ed := range EdictCatalog {
			if isEdictEffectivelyActive(p, ed) {
				perPopWater += ed.PerResidentWaterDrainMod
			}
		}
		if perPopWater < 0 {
			perPopWater = 0
		}
		drain[ResWater] += int64(p.PopulationTotal) * perPopWater
	}

	for _, ed := range EdictCatalog {
		if !isEdictEffectivelyActive(p, ed) {
			continue
		}
		for resKey, flatDrain := range ed.FlatResourceDrainMilliSec {
			drain[resKey] += flatDrain
		}
	}

	for _, js := range JobCatalog {
		if len(js.InputsPerWorkerMilli) == 0 {
			continue
		}
		cj := jobMap[js.Key]
		if cj.Assigned <= 0 || cj.TotalOutputPerSecMilli <= 0 {
			continue
		}
		switch js.Key {
		case JobCharcoal:
			woodNeed := int64(cj.Assigned) * js.InputsPerWorkerMilli[ResWood]
			if p.ResourcesMilli[ResWood] > 0 || gross[ResWood] >= drain[ResWood]+woodNeed {
				drain[ResWood] += woodNeed
				gross[ResCharcoal] += cj.TotalOutputPerSecMilli
			} else if availWood := gross[ResWood] - drain[ResWood]; availWood > 0 {
				drain[ResWood] += availWood
				gross[ResCharcoal] += (cj.TotalOutputPerSecMilli * availWood) / woodNeed
			}
		case JobSmeltIron:
			stoneNeed := int64(cj.Assigned) * js.InputsPerWorkerMilli[ResStone]
			coalNeed := int64(cj.Assigned) * js.InputsPerWorkerMilli[ResCharcoal]
			hasStone := p.ResourcesMilli[ResStone] > 0 || gross[ResStone] >= stoneNeed
			hasCoal := p.ResourcesMilli[ResCharcoal] > 0 || gross[ResCharcoal] >= coalNeed || p.ResourcesMilli[ResWood] > 0
			if hasStone && hasCoal {
				drain[ResStone] += stoneNeed
				if p.ResourcesMilli[ResCharcoal] > 0 || gross[ResCharcoal] > 0 {
					drain[ResCharcoal] += coalNeed
				} else {
					drain[ResWood] += coalNeed
				}
				gross[ResIronIngot] += cj.TotalOutputPerSecMilli
			}
		case JobPrepRation:
			waterNeed := int64(cj.Assigned) * js.InputsPerWorkerMilli[ResWater]
			woodNeed := int64(cj.Assigned) * js.InputsPerWorkerMilli[ResWood]
			if (p.ResourcesMilli[ResWater] > 0 || gross[ResWater] >= drain[ResWater]+waterNeed) &&
				(p.ResourcesMilli[ResWood] > 0 || gross[ResWood] >= drain[ResWood]+woodNeed) {
				drain[ResWater] += waterNeed
				drain[ResWood] += woodNeed
				gross[ResRation] += cj.TotalOutputPerSecMilli
			}
		}
	}

	waterCap := ResourceCapacityMilli(p, ResWater)
	if p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice] &&
		waterCap > 0 && p.ResourcesMilli[ResWater] >= waterCap && gross[ResWater] > drain[ResWater] {
		overflow := gross[ResWater] - drain[ResWater]
		drain[ResWater] += overflow
		gross[ResStone] += overflow / SettlementBalance.SiphonStoneDivisor
		gross[ResFlint] += overflow / SettlementBalance.SiphonFlintDivisor
	}

	for _, r := range ResourceCatalog {
		net[r.Key] = gross[r.Key] - drain[r.Key]
	}
	return gross, drain, net
}

func NetResourceRatesPerSecMilli(p *PlayerState) map[string]int64 {
	_, _, net := ComputeResourceFlows(p)
	return net
}

func applyElapsedSimMs(p *PlayerState, simMs int64) {
	if simMs <= 0 {
		return
	}
	_, _, net := ComputeResourceFlows(p)
	siphonOn := p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice]

	for _, r := range ResourceCatalog {
		rate := net[r.Key]
		if rate == 0 {
			continue
		}
		delta := (rate * simMs) / 1000
		if delta > 0 {
			overflow := addResourceWithCap(p, r.Key, delta)
			if r.Key == ResWater && overflow > 0 && siphonOn {
				addResourceWithCap(p, ResStone, overflow/SettlementBalance.SiphonStoneDivisor)
				addResourceWithCap(p, ResFlint, overflow/SettlementBalance.SiphonFlintDivisor)
			}
		} else if delta < 0 {
			rem := p.ResourcesMilli[r.Key] + delta
			if rem < 0 {
				rem = 0
			}
			p.ResourcesMilli[r.Key] = rem
		}
	}

	grossAfter, drainAfter, _ := ComputeResourceFlows(p)
	p.HydrationWarning = p.PopulationTotal >= SettlementBalance.MinPopForHydrationDrain &&
		p.ResourcesMilli[ResWater] == 0 && grossAfter[ResWater] < drainAfter[ResWater]
}

// SettleProduction performs tickless authoritative production settlement for the elapsed interval [LastSettledAt, now].
func SettleProduction(p *PlayerState, now time.Time) {
	nowUTC := now.UTC()
	if p.LastSettledAt.IsZero() {
		p.LastSettledAt = nowUTC
		return
	}
	elapsedMs := nowUTC.Sub(p.LastSettledAt).Milliseconds()
	if elapsedMs <= 0 {
		return
	}
	mult := int64(p.SpeedMultiplier)
	if mult < 1 {
		mult = 1
	}
	simMs := elapsedMs * mult
	maxMs := OfflineCapSeconds * 1000
	capped := false
	if simMs > maxMs {
		simMs = maxMs
		capped = true
	}

	applyElapsedSimMs(p, simMs)
	p.SimulatedElapsedSeconds += simMs / 1000
	p.LastSettledAt = nowUTC
	if capped {
		p.LastOfflineSummary = "离线产出已达单次 8 小时封顶上限（GDD 6.4）。"
	}
}

// AdvancePlayerSeconds fast-forwards a player's production deterministically by sec seconds.
func AdvancePlayerSeconds(p *PlayerState, sec int64) {
	if sec <= 0 {
		return
	}
	if sec > OfflineCapSeconds {
		sec = OfflineCapSeconds
	}
	applyElapsedSimMs(p, sec*1000)
	p.SimulatedElapsedSeconds += sec
}

func AssignedPopulation(p *PlayerState) int32 {
	var sum int32
	for _, c := range p.Workers {
		if c > 0 {
			sum += c
		}
	}
	return sum
}

// GatherWater processes manual water gathering with server-authoritative batch cap and leaky-bucket anti-macro rate-limiting.
func GatherWater(p *PlayerState, clicks int32, now time.Time) error {
	if clicks <= 0 {
		clicks = 1
	}
	if clicks > SettlementBalance.MaxClicksPerRequest {
		return ErrPrecondition("gather_rate_limited", fmt.Sprintf("单次手动打水请求不得超过 %d 次", SettlementBalance.MaxClicksPerRequest))
	}
	// Leaky-bucket rate limiter with a burst window to absorb TCP jitter while blocking sustained macros
	burstWindow := time.Duration(SettlementBalance.GatherBurstAllowanceMs) * time.Millisecond
	stepCost := time.Duration(clicks) * time.Duration(SettlementBalance.MinGatherIntervalMs) * time.Millisecond
	floorTime := now.Add(-burstWindow)
	baseTime := p.LastGatherWaterAt
	if baseTime.IsZero() || baseTime.Before(floorTime) {
		baseTime = floorTime
	}
	nextTime := baseTime.Add(stepCost)
	if nextTime.After(now.Add(burstWindow)) {
		return ErrPrecondition("gather_rate_limited", "打水点击频率超出人类极限，请按正常节奏汲水")
	}
	p.LastGatherWaterAt = nextTime

	perClickMilli := SettlementBalance.BaseGatherClickMilli
	if p.UnlockedBlueprints[BPFirstResident] {
		perClickMilli = SettlementBalance.UpgradedGatherClickMilli
	}
	gain := int64(clicks) * perClickMilli
	overflow := addResourceWithCap(p, ResWater, gain)
	if overflow > 0 && p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice] {
		addResourceWithCap(p, ResStone, overflow/SettlementBalance.SiphonStoneDivisor)
		addResourceWithCap(p, ResFlint, overflow/SettlementBalance.SiphonFlintDivisor)
	}
	prevClicks := p.TotalManualClicks
	p.TotalManualClicks += int64(clicks)
	procInterval := SettlementBalance.FlintProcEveryNClicks
	if p.UnlockedBlueprints[BPFirstResident] && (p.TotalManualClicks/procInterval) > (prevClicks/procInterval) {
		procs := (p.TotalManualClicks / procInterval) - (prevClicks / procInterval)
		addResourceWithCap(p, ResFlint, procs*SettlementBalance.FlintProcAmountMilli)
	}
	if p.TotalManualClicks == 10 && p.PopulationTotal == 0 {
		AppendLog(p, now, "PRODUCTION", "已累计 10 滴水！右侧【招募居民】入口已就绪，立即招募首位居民开启自动取水。")
	}
	return nil
}

func RecruitResident(p *PlayerState, count int32, now time.Time) error {
	if count <= 0 {
		count = 1
	}
	if count > SettlementBalance.MaxRecruitBatchCount {
		count = SettlementBalance.MaxRecruitBatchCount
	}
	recruited := int32(0)
	var totalSpentMilli int64
	for i := int32(0); i < count; i++ {
		cost := NextResidentCostMilli(p.PopulationTotal)
		if p.ResourcesMilli[ResWater] < cost {
			if recruited == 0 {
				return ErrPrecondition("insufficient_water", fmt.Sprintf("水资源不足：招募下一位居民需要 %.1f 水", float64(cost)/float64(ResourceScale)))
			}
			break
		}
		p.ResourcesMilli[ResWater] -= cost
		totalSpentMilli += cost
		p.PopulationTotal++
		p.Workers[JobWater]++
		recruited++
	}
	if p.PopulationTotal == 1 && recruited == 1 {
		AppendLog(p, now, "PRODUCTION", "第一位居民已加入并自动分配至【打水】（+2.00 水/秒）！第一次自动化生产已启动。")
	} else {
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("成功招募 %d 名居民（消耗 %.1f 水），当前总人口 %d。", recruited, float64(totalSpentMilli)/1000.0, p.PopulationTotal))
	}
	return nil
}

func isJobUnlockedForPlayer(p *PlayerState, jobKey string) (bool, string) {
	for _, js := range JobCatalog {
		if js.Key != jobKey {
			continue
		}
		if js.RequiredBlueprint != "" && !p.UnlockedBlueprints[js.RequiredBlueprint] {
			return false, fmt.Sprintf("尚未解锁前置科技（%s）", js.UnlockHint)
		}
		if js.RequiresProfession && p.Profession == ProfNone {
			return false, "尚未开启工坊高炉/军需产线，无法分配该岗位"
		}
		return true, ""
	}
	return false, "未知的岗位"
}

func AllocateWorkers(p *PlayerState, mode string, entries map[string]int32, presetName string, now time.Time) error {
	total := p.PopulationTotal
	if total <= 0 {
		return ErrPrecondition("no_population", "当前尚无居民可供分配，请先招募居民")
	}

	switch mode {
	case "delta":
		for k, delta := range entries {
			if delta == 0 {
				continue
			}
			if ok, reason := isJobUnlockedForPlayer(p, k); !ok {
				return ErrPrecondition("job_locked", reason)
			}
			assigned := AssignedPopulation(p)
			idle := total - assigned
			if idle < 0 {
				idle = 0
			}
			if delta > 0 {
				useIdle := delta
				if useIdle > idle {
					useIdle = idle
				}
				needTransfer := delta - useIdle
				if needTransfer > 0 {
					if k != JobWater {
						if p.Workers[JobWater] < needTransfer {
							return ErrPrecondition("no_available_workers", "当前无闲置或打水居民可供调配，请先从其他岗位调出居民")
						}
						p.Workers[JobWater] -= needTransfer
					} else {
						for _, src := range []string{JobPrepRation, JobSmeltIron, JobStone, JobCharcoal, JobWood} {
							if needTransfer <= 0 {
								break
							}
							avail := p.Workers[src]
							if avail <= 0 {
								continue
							}
							take := needTransfer
							if take > avail {
								take = avail
							}
							p.Workers[src] -= take
							needTransfer -= take
						}
						if needTransfer > 0 {
							return ErrPrecondition("no_available_workers", "所有居民均已在打水岗位")
						}
					}
				}
				p.Workers[k] += delta
			} else {
				rem := -delta
				if rem > p.Workers[k] {
					rem = p.Workers[k]
				}
				if rem > 0 {
					p.Workers[k] -= rem
					if k != JobWater {
						p.Workers[JobWater] += rem
					}
				}
			}
		}
		return nil

	case "manual":
		next := map[string]int32{
			JobWater:      0,
			JobWood:       0,
			JobCharcoal:   0,
			JobStone:      0,
			JobSmeltIron:  0,
			JobPrepRation: 0,
		}
		var sum int32
		for k, v := range entries {
			if v < 0 {
				return ErrInvalidInput("分配人数不能为负数")
			}
			if v == 0 {
				continue
			}
			if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
				return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】，无法分配伐木工")
			}
			if k == JobCharcoal && !p.UnlockedBlueprints[BPCharcoalKiln] {
				return ErrPrecondition("job_locked", "尚未解锁【砖砌炭窑】，无法分配烧炭工")
			}
			if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
				return ErrPrecondition("job_locked", "尚未解锁【采石技术】，无法分配采石工")
			}
			if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
				return ErrPrecondition("job_locked", "尚未建成【基础工坊】，无法分配工坊岗位")
			}
			next[k] = v
			sum += v
		}
		if sum > total {
			excess := sum - total
			if next[JobWater] >= excess && next[JobWater] == p.Workers[JobWater] {
				next[JobWater] -= excess
				sum -= excess
			} else {
				return ErrPrecondition("population_exceeded", fmt.Sprintf("分配总人数 (%d) 超过当前人口上限 (%d)", sum, total))
			}
		}
		p.Workers = next
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已更新劳动力分配：打水 %d / 伐木 %d / 采石 %d / 炼铁 %d / 军粮 %d（闲置 %d）。",
			next[JobWater], next[JobWood], next[JobStone], next[JobSmeltIron], next[JobPrepRation], total-sum))
		return nil

	case "auto_balanced":
		ApplyBalancedAllocation(p)
		AppendLog(p, now, "PRODUCTION", "已按当前科技阶段执行【智能均衡分配】。")
		return nil

	case "water_focus":
		ApplyFocusAllocation(p, JobWater)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先打水】劳动力配置。")
		return nil

	case "wood_focus":
		if !p.UnlockedBlueprints[BPAxeBlueprint] {
			return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】")
		}
		ApplyFocusAllocation(p, JobWood)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先伐木】劳动力配置。")
		return nil

	case "stone_focus":
		if !p.UnlockedBlueprints[BPQuarryTech] {
			return ErrPrecondition("job_locked", "尚未解锁【采石技术】")
		}
		ApplyFocusAllocation(p, JobStone)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先采石】劳动力配置。")
		return nil

	case "preset":
		for _, pr := range p.Presets {
			if pr.Name == presetName {
				ApplyScaledPreset(p, pr.Allocations)
				AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已应用分配方案【%s】。", presetName))
				return nil
			}
		}
		return ErrNotFound("未找到指定的分配方案")

	default:
		return ErrInvalidInput("未知的分配模式")
	}
}

func ApplyBalancedAllocation(p *PlayerState) {
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobCharcoal:   0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	if total <= 0 {
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPAxeBlueprint] {
		next[JobWater] = total
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPQuarryTech] {
		wood := int32(math.Round(float64(total) * 0.30))
		if wood < 1 {
			wood = 1
		}
		next[JobWood] = wood
		next[JobWater] = total - wood
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		wood := int32(math.Round(float64(total) * 0.25))
		stone := int32(math.Round(float64(total) * 0.15))
		if stone < 1 {
			stone = 1
		}
		next[JobWood] = wood
		next[JobStone] = stone
		next[JobWater] = total - wood - stone
		p.Workers = next
		return
	}
	if p.Profession == ProfNone {
		wood := int32(math.Round(float64(total) * 0.30))
		stone := int32(math.Round(float64(total) * 0.20))
		next[JobWood] = wood
		next[JobStone] = stone
		next[JobWater] = total - wood - stone
		p.Workers = next
		return
	}
	iron := int32(math.Max(1, math.Round(float64(total)*0.10)))
	ration := int32(math.Max(1, math.Round(float64(total)*0.10)))
	wood := int32(math.Round(float64(total) * 0.25))
	stone := int32(math.Round(float64(total) * 0.20))
	water := total - iron - ration - wood - stone
	if water < 1 {
		water = 1
	}
	next[JobWater] = water
	next[JobWood] = wood
	next[JobStone] = stone
	next[JobSmeltIron] = iron
	next[JobPrepRation] = ration
	p.Workers = next
}

func ApplyFocusAllocation(p *PlayerState, focusJob string) {
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobCharcoal:   0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	primary := int32(math.Ceil(float64(total) * 0.75))
	rem := total - primary
	next[focusJob] = primary
	if focusJob != JobWater {
		next[JobWater] = rem
	} else if p.UnlockedBlueprints[BPAxeBlueprint] {
		next[JobWood] = rem
	} else {
		next[JobWater] = total
	}
	p.Workers = next
}

func ApplyScaledPreset(p *PlayerState, raw map[string]int32) {
	var rawSum int32
	for k, v := range raw {
		if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
			continue
		}
		if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
			continue
		}
		if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
			continue
		}
		if v > 0 {
			rawSum += v
		}
	}
	if rawSum <= 0 {
		ApplyBalancedAllocation(p)
		return
	}
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobCharcoal:   0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	var assigned int32
	for _, k := range []string{JobWood, JobStone, JobSmeltIron, JobPrepRation} {
		v := raw[k]
		if v <= 0 {
			continue
		}
		if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
			continue
		}
		if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
			continue
		}
		if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
			continue
		}
		scaled := int32(math.Round(float64(total) * float64(v) / float64(rawSum)))
		if assigned+scaled > total {
			scaled = total - assigned
		}
		next[k] = scaled
		assigned += scaled
	}
	next[JobWater] = total - assigned
	p.Workers = next
}

func SavePreset(p *PlayerState, name string, now time.Time) error {
	if len(name) == 0 || len([]rune(name)) > 20 {
		return ErrInvalidInput("方案名称长度需在 1–20 个字符之间")
	}
	copyAlloc := make(map[string]int32, len(p.Workers))
	for k, v := range p.Workers {
		copyAlloc[k] = v
	}
	for i := range p.Presets {
		if p.Presets[i].Name == name {
			p.Presets[i].Allocations = copyAlloc
			AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已更新人口分配方案【%s】。", name))
			return nil
		}
	}
	p.Presets = append(p.Presets, AllocationPreset{
		Name:        name,
		Allocations: copyAlloc,
	})
	AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已保存人口分配方案【%s】。", name))
	return nil
}

func UnlockBlueprint(w *WorldState, p *PlayerState, code string, now time.Time) error {
	var spec *BlueprintSpec
	for i := range BlueprintCatalog {
		if BlueprintCatalog[i].Code == code {
			spec = &BlueprintCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的蓝图节点")
	}
	if p.UnlockedBlueprints[code] {
		return ErrPrecondition("already_unlocked", "该蓝图已经解锁")
	}
	if spec.PrerequisiteCode != "" && !p.UnlockedBlueprints[spec.PrerequisiteCode] {
		return ErrPrecondition("prerequisite_missing", "尚未完成前置蓝图研发")
	}
	if p.PopulationTotal < spec.RequiredPopulation {
		return ErrPrecondition("insufficient_population", fmt.Sprintf("需要人口达到 %d 人（当前 %d 人）", spec.RequiredPopulation, p.PopulationTotal))
	}
	for resKey, reqMilli := range spec.CostsMilli {
		if p.ResourcesMilli[resKey] < reqMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.1f，当前 %.1f",
				ResourceName(resKey), float64(reqMilli)/1000.0, float64(p.ResourcesMilli[resKey])/1000.0))
		}
	}
	for resKey, reqMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= reqMilli
	}
	p.UnlockedBlueprints[code] = true

	if spec.AutoEnableEdict != "" {
		if p.ActiveEdicts == nil {
			p.ActiveEdicts = map[string]bool{}
		}
		p.ActiveEdicts[spec.AutoEnableEdict] = true
	}

	if spec.GrantsGoldBasis > 0 {
		if p.Phase < 2 {
			p.Phase = 2
		}
		starterGold := spec.GrantsGoldBasis
		if w.TreasuryHeldBasis >= starterGold {
			w.TreasuryHeldBasis -= starterGold
			p.GoldBasis += starterGold
		} else {
			w.TotalIssuedBasis += starterGold
			p.GoldBasis += starterGold
		}
		AppendLog(p, now, "BLUEPRINT", "★ 已开启【神秘的宝藏】！获得中央财政发放的 500.0000 启动金币，请立即在职业面板抉择你的终身职业！")
	} else {
		AppendLog(p, now, "BLUEPRINT", fmt.Sprintf("已解锁【%s】：%s", spec.Name, spec.EffectSummary))
	}
	return nil
}

func ToggleEdict(p *PlayerState, code string, now time.Time) error {
	var spec *EdictSpec
	for i := range EdictCatalog {
		if EdictCatalog[i].Code == code {
			spec = &EdictCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的聚落政令或机关")
	}
	if spec.PrerequisiteCode != "" && !p.UnlockedBlueprints[spec.PrerequisiteCode] {
		return ErrPrecondition("edict_locked", "尚未解锁该政令或机关的前置建筑")
	}
	if p.ActiveEdicts == nil {
		p.ActiveEdicts = map[string]bool{}
	}
	nextState := !p.ActiveEdicts[code]
	p.ActiveEdicts[code] = nextState
	if nextState {
		if spec.MutuallyExclusiveWith != "" {
			p.ActiveEdicts[spec.MutuallyExclusiveWith] = false
		}
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已开启【%s】：%s（代价：%s）。", spec.Name, spec.EffectSummary, spec.DrawbackSummary))
	} else {
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已停用【%s】。", spec.Name))
	}
	return nil
}

func DispatchExpedition(p *PlayerState, routeCode string, now time.Time) error {
	if !p.UnlockedBlueprints[BPScoutCamp] {
		return ErrPrecondition("scout_camp_locked", "请先建造【荒原斥候营】后再派遣远征队")
	}
	if p.ActiveExpedition != nil {
		return ErrPrecondition("expedition_busy", "当前已有斥候小队在外探索，请等待其归来")
	}
	var spec *ExpeditionRouteSpec
	for i := range ExpeditionCatalog {
		if ExpeditionCatalog[i].RouteCode == routeCode {
			spec = &ExpeditionCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的远征探索路线")
	}
	for resKey, reqMilli := range spec.CostsMilli {
		if p.ResourcesMilli[resKey] < reqMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：远征需要 %.1f", ResourceName(resKey), float64(reqMilli)/1000.0))
		}
	}
	for resKey, reqMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= reqMilli
	}
	p.ActiveExpedition = &ActiveExpeditionState{
		RouteCode:       spec.RouteCode,
		RouteName:       spec.Name,
		StartedAtSimSec: p.SimulatedElapsedSeconds,
		DurationSeconds: int64(spec.DurationSeconds),
	}
	AppendLog(p, now, "PRODUCTION", fmt.Sprintf("斥候小队已出发前往【%s】（预计耗时 %d 秒）。", spec.Name, spec.DurationSeconds))
	return nil
}

func ClaimExpedition(p *PlayerState, now time.Time) error {
	if p.ActiveExpedition == nil {
		return ErrPrecondition("no_expedition", "当前没有正在进行的远征")
	}
	elapsed := p.SimulatedElapsedSeconds - p.ActiveExpedition.StartedAtSimSec
	if elapsed < p.ActiveExpedition.DurationSeconds {
		rem := p.ActiveExpedition.DurationSeconds - elapsed
		return ErrPrecondition("expedition_in_progress", fmt.Sprintf("斥候仍在探索中，还需 %d 秒归来", rem))
	}
	route := p.ActiveExpedition.RouteCode
	p.ActiveExpedition = nil

	for _, spec := range ExpeditionCatalog {
		if spec.RouteCode != route {
			continue
		}
		for resKey, rewardMilli := range spec.RewardsMilli {
			addResourceWithCap(p, resKey, rewardMilli)
		}
		if spec.EvenSimSecBonusPop > 0 && p.SimulatedElapsedSeconds%2 == 0 {
			p.PopulationTotal += spec.EvenSimSecBonusPop
			p.Workers[JobWater] += spec.EvenSimSecBonusPop
			AppendLog(p, now, "PRODUCTION", spec.CompletionLogWithPop)
		} else {
			AppendLog(p, now, "PRODUCTION", spec.CompletionLogNormal)
		}
		return nil
	}
	return nil
}

func TradeCaravan(p *PlayerState, offerCode string, now time.Time) error {
	if !p.UnlockedBlueprints[BPScoutCamp] {
		return ErrPrecondition("scout_camp_locked", "请先建造【荒原斥候营】点亮信标以吸引流浪行商")
	}
	var spec *CaravanOfferSpec
	for i := range CaravanOfferCatalog {
		if CaravanOfferCatalog[i].OfferCode == offerCode {
			spec = &CaravanOfferCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的行商契约")
	}
	for resKey, reqMilli := range spec.CostsMilli {
		if p.ResourcesMilli[resKey] < reqMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.1f", ResourceName(resKey), float64(reqMilli)/1000.0))
		}
	}
	for resKey, reqMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= reqMilli
	}
	for resKey, rewardMilli := range spec.RewardsMilli {
		addResourceWithCap(p, resKey, rewardMilli)
	}
	if spec.RewardPopulation > 0 {
		p.PopulationTotal += spec.RewardPopulation
		p.Workers[JobWater] += spec.RewardPopulation
	}
	AppendLog(p, now, "MARKET", fmt.Sprintf("已与流浪行商完成契约【%s】：%s。", spec.Title, spec.RewardSummary))
	return nil
}
