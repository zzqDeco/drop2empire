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

// ResourceCapacityMilli derives storage from built assets.
func ResourceCapacityMilli(p *PlayerState, resKey string) int64 {
	capMilli := BaseResourceCapacityUnits[resKey] * ResourceScale
	multiplier := int64(1)
	if p.UnlockedBlueprints[BPStoneVault] {
		multiplier = 2
	}
	for _, b := range BuildingCatalog {
		capMilli += int64(p.BuildingCounts[b.Code]) * b.CapacityUnits[resKey] * ResourceScale * multiplier
	}
	return capMilli
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
	// Market purchases can legitimately exceed production capacity. Never destroy
	// existing inventory when passive production resumes.
	if cur >= capMilli {
		return deltaMilli
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
	Capacity               int32
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
	// Determine the whole tick's bonus and upkeep from its opening inventory.
	// Future gathering (especially one forager) cannot fund an unpaid bonus.
	// Upkeep is paid before industrial jobs can consume this reserved fuel.
	if ed.Code == EdictNightShift && p.ResourcesMilli[ResWood] < ed.FlatResourceDrainMilliSec[ResWood] {
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
		capacity := JobCapacity(p, js.Key)
		unlocked := capacity > 0
		assigned := min(max(0, p.Workers[js.Key]), capacity)
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
			Capacity:               capacity,
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
	gross[ResWood] += woodOut + jobMap[JobForage].TotalOutputPerSecMilli
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
		available := func(key string) int64 { return max(0, p.ResourcesMilli[key]+gross[key]-drain[key]) }
		inputs := js.InputsPerWorkerMilli
		if js.Key == JobSmeltIron {
			stoneNeed := int64(cj.Assigned) * inputs[ResStone]
			fuelNeed := int64(cj.Assigned) * inputs[ResCharcoal]
			coal := min(fuelNeed, available(ResCharcoal))
			wood := min(fuelNeed, available(ResWood))
			work := min(int64(1_000_000), min(stoneNeed, available(ResStone))*1_000_000/stoneNeed,
				min(fuelNeed, coal+wood)*1_000_000/fuelNeed)
			fuel := fuelNeed * work / 1_000_000
			coalUsed := min(fuel, coal)
			drain[ResStone] += stoneNeed * work / 1_000_000
			drain[ResCharcoal] += coalUsed
			drain[ResWood] += fuel - coalUsed
			gross[cj.OutputResourceKey] += cj.TotalOutputPerSecMilli * work / 1_000_000
			continue
		}
		// Preview one second of work using actual available inputs. A nonzero
		// stock smaller than one second's demand must not advertise full output.
		work := int64(1_000_000)
		for key, perWorker := range inputs {
			need := int64(cj.Assigned) * perWorker
			if need > 0 {
				work = min(work, min(need, available(key))*1_000_000/need)
			}
		}
		for key, perWorker := range inputs {
			drain[key] += int64(cj.Assigned) * perWorker * work / 1_000_000
		}
		gross[cj.OutputResourceKey] += cj.TotalOutputPerSecMilli * work / 1_000_000
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

// Production uses deterministic one-second simulation ticks. The fractional
// clock and sub-milli output remainders are persisted, so request frequency cannot
// change output. Each conversion spends actual available inputs before producing.
func applyElapsedSimMs(p *PlayerState, simMs int64) {
	if simMs <= 0 {
		return
	}
	if p.ProductionRemainders == nil {
		p.ProductionRemainders = map[string]int64{}
	}
	total := p.SimulatedRemainderMs + simMs
	ticks := total / 1000
	p.SimulatedRemainderMs = total % 1000
	for i := int64(0); i < ticks; i++ {
		produceSecond(p)
	}
	p.SimulatedElapsedSeconds += ticks
	RefreshSettlementDiscovery(p)
}

func productionStock(p *PlayerState, key string) int64 {
	return p.ResourcesMilli[key]*1000 + p.ProductionRemainders[key]
}

func changeProductionStock(p *PlayerState, key string, delta int64) {
	stock := productionStock(p, key)
	next := stock + delta
	if delta > 0 {
		cap := ResourceCapacityMilli(p, key) * 1000
		if cap > 0 {
			// Do not truncate stock brought in through trading or rewards.
			if stock >= cap {
				next = stock
			} else if next > cap {
				next = cap
			}
		}
	}
	if next < 0 {
		next = 0
	}
	p.ResourcesMilli[key], p.ProductionRemainders[key] = next/1000, next%1000
}

func produceSecond(p *PlayerState) {
	activeEdicts := make(map[string]bool, len(EdictCatalog))
	for _, ed := range EdictCatalog {
		activeEdicts[ed.Code] = isEdictEffectivelyActive(p, ed)
	}
	jobs := ComputeJobs(p)
	byproductMult := int64(1)
	for _, bp := range BlueprintCatalog {
		if p.UnlockedBlueprints[bp.Code] && bp.DoublesByproductProc {
			byproductMult = 2
			break
		}
	}
	waterBefore := productionStock(p, ResWater)
	var waterProduced, waterDemand int64
	// Gather, pay upkeep, then route only net water overflow into the siphon.
	for _, job := range jobs {
		if job.JobKey != JobWater && job.JobKey != JobWood && job.JobKey != JobStone && job.JobKey != JobForage {
			continue
		}
		output := job.TotalOutputPerSecMilli * 1000
		if job.JobKey == JobWater {
			waterProduced = output
			next := productionStock(p, ResWater) + output
			p.ResourcesMilli[ResWater], p.ProductionRemainders[ResWater] = next/1000, next%1000
		} else {
			changeProductionStock(p, job.OutputResourceKey, output)
		}

		if job.JobKey == JobWood {
			changeProductionStock(p, ResFlint, output*byproductMult/SettlementBalance.WoodToFlintDivisor)
		}
		if job.JobKey == JobStone {
			changeProductionStock(p, ResFlint, output*byproductMult/SettlementBalance.StoneToFlintDivisor)
			changeProductionStock(p, ResAncientShard, output*byproductMult/SettlementBalance.StoneToAncientShardDivisor)
		}
	}
	perPop := SettlementBalance.BaseWaterDrainPerPop
	for _, ed := range EdictCatalog {
		if !activeEdicts[ed.Code] {
			continue
		}
		perPop += ed.PerResidentWaterDrainMod
		for key, rate := range ed.FlatResourceDrainMilliSec {
			if key == ResWater {
				waterDemand += rate * 1000
			}
			changeProductionStock(p, key, -rate*1000)
		}
	}
	if perPop < 0 {
		perPop = 0
	}
	if p.PopulationTotal >= SettlementBalance.MinPopForHydrationDrain {
		waterDemand += int64(p.PopulationTotal) * perPop * 1000
		changeProductionStock(p, ResWater, -int64(p.PopulationTotal)*perPop*1000)
	}
	// JobCatalog order is the documented conversion priority: charcoal, iron, ration.
	for i, job := range jobs {
		spec := JobCatalog[i]
		if len(spec.InputsPerWorkerMilli) == 0 || job.Assigned <= 0 || job.EffectiveRateMilli <= 0 {
			continue
		}
		workMs := int64(job.Assigned) * 1000
		if job.JobKey == JobSmeltIron {
			stoneRate := spec.InputsPerWorkerMilli[ResStone]
			fuelRate := spec.InputsPerWorkerMilli[ResCharcoal]
			if availStone := productionStock(p, ResStone) / stoneRate; availStone < workMs {
				workMs = availStone
			}
			coalMs := min(workMs, productionStock(p, ResCharcoal)/fuelRate)
			woodMs := min(workMs-coalMs, productionStock(p, ResWood)/fuelRate)
			workMs = coalMs + woodMs
			if workMs <= 0 {
				continue
			}
			changeProductionStock(p, ResStone, -stoneRate*workMs)
			changeProductionStock(p, ResCharcoal, -fuelRate*coalMs)
			changeProductionStock(p, ResWood, -fuelRate*woodMs)
			changeProductionStock(p, job.OutputResourceKey, job.EffectiveRateMilli*workMs)
			continue
		}
		for key, rate := range spec.InputsPerWorkerMilli {
			if available := productionStock(p, key) / rate; available < workMs {
				workMs = available
			}
		}
		if workMs <= 0 {
			continue
		}
		for key, rate := range spec.InputsPerWorkerMilli {
			if key == ResWater {
				waterDemand += rate * workMs
			}
			changeProductionStock(p, key, -rate*workMs)
		}
		changeProductionStock(p, job.OutputResourceKey, job.EffectiveRateMilli*workMs)
	}
	waterCeiling := max(waterBefore, ResourceCapacityMilli(p, ResWater)*1000)
	if overflow := productionStock(p, ResWater) - waterCeiling; overflow > 0 {
		changeProductionStock(p, ResWater, -overflow)
		if p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice] {
			changeProductionStock(p, ResStone, overflow/SettlementBalance.SiphonStoneDivisor)
			changeProductionStock(p, ResFlint, overflow/SettlementBalance.SiphonFlintDivisor)
		}
	}
	p.HydrationWarning = p.PopulationTotal >= SettlementBalance.MinPopForHydrationDrain && productionStock(p, ResWater) == 0 && waterProduced < waterDemand
}

// SettleProduction lazily advances deterministic one-second production ticks,
// retaining fractional time for the next request.
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
	p.LastSettledAt = p.LastSettledAt.Add(time.Duration(elapsedMs) * time.Millisecond)
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
		if p.PopulationTotal >= HousingCapacity(p) {
			if recruited == 0 {
				return ErrPrecondition("housing_full", "住房已满，请先建造木屋")
			}
			break
		}
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

func isJobUnlockedForPlayer(p *PlayerState, key string) (bool, string) {
	for _, js := range JobCatalog {
		if js.Key == key {
			if JobCapacity(p, key) > 0 {
				return true, ""
			}
			return false, js.UnlockHint
		}
	}
	return false, "未知的岗位"
}

func AllocateWorkers(p *PlayerState, mode string, entries map[string]int32, presetName string, now time.Time) error {
	if p.PopulationTotal <= 0 {
		return ErrPrecondition("no_population", "请先招募居民")
	}
	switch mode {
	case "auto_balanced":
		ApplyBalancedAllocation(p)
		return nil
	case "water_focus", "wood_focus", "stone_focus":
		key := map[string]string{"water_focus": JobWater, "wood_focus": JobWood, "stone_focus": JobStone}[mode]
		if ok, reason := isJobUnlockedForPlayer(p, key); !ok {
			return ErrPrecondition("job_locked", reason)
		}
		ApplyFocusAllocation(p, key)
		return nil
	case "preset":
		for _, preset := range p.Presets {
			if preset.Name == presetName {
				ApplyScaledPreset(p, preset.Allocations)
				return nil
			}
		}
		return ErrNotFound("未找到分配方案")
	case "manual", "delta":
	default:
		return ErrInvalidInput("未知的分配模式")
	}
	next := map[string]int32{}
	if mode == "delta" {
		for k, v := range p.Workers {
			next[k] = v
		}
	}
	for key, value := range entries {
		known := false
		for _, js := range JobCatalog {
			if js.Key == key {
				known = true
				break
			}
		}
		if !known {
			return ErrInvalidInput("未知的岗位")
		}
		if mode == "manual" && value < 0 {
			return ErrInvalidInput("分配人数不能为负数")
		}
		if value > 0 {
			if ok, reason := isJobUnlockedForPlayer(p, key); !ok {
				return ErrPrecondition("job_locked", reason)
			}
		}
		if mode == "manual" {
			next[key] = value
		}
	}
	if mode == "delta" {
		// Apply releases before additions in stable catalog order. Nothing mutates p
		// until all requests, capacities and population have been validated.
		for _, js := range JobCatalog {
			if delta := entries[js.Key]; delta < 0 {
				removed := int32(min(int64(next[js.Key]), -int64(delta)))
				next[js.Key] -= removed
				if js.Key != JobWater {
					next[JobWater] += removed
				}
			}
		}
		for _, js := range JobCatalog {
			if delta := entries[js.Key]; delta > 0 {
				if int64(next[js.Key])+int64(delta) > int64(JobCapacity(p, js.Key)) {
					return ErrPrecondition("job_capacity", "岗位已满，请先增建设施")
				}
				var used int64
				for _, n := range next {
					used += int64(n)
				}
				need := max(int64(0), int64(delta)-(int64(p.PopulationTotal)-used))
				if js.Key != JobWater {
					if need > int64(next[JobWater]) {
						return ErrPrecondition("no_available_workers", "没有可调配的居民")
					}
					next[JobWater] -= int32(need)
				} else {
					for _, source := range JobCatalog {
						if source.Key == JobWater {
							continue
						}
						take := min(need, int64(next[source.Key]))
						next[source.Key] -= int32(take)
						need -= take
					}
					if need > 0 {
						return ErrPrecondition("no_available_workers", "没有可调配的居民")
					}
				}
				next[js.Key] += delta
			}
		}
	}
	var sum int64
	for key, n := range next {
		if n < 0 || n > JobCapacity(p, key) {
			return ErrPrecondition("job_capacity", "分配超过已建设施的岗位容量")
		}
		sum += int64(n)
	}
	if sum > int64(p.PopulationTotal) {
		return ErrPrecondition("population_exceeded", "分配总人数超过当前人口")
	}
	p.Workers = next
	return nil
}

// Presets and automatic allocation respect installed capacity; overflow returns
// to water gathering, keeping a recovery path available at zero stock.
func ApplyScaledPreset(p *PlayerState, raw map[string]int32) {
	var totalWeight int64
	for _, js := range JobCatalog {
		if JobCapacity(p, js.Key) > 0 && raw[js.Key] > 0 {
			totalWeight += int64(raw[js.Key])
		}
	}
	next := map[string]int32{}
	remaining := p.PopulationTotal
	if totalWeight > 0 {
		for _, js := range JobCatalog {
			if js.Key == JobWater || raw[js.Key] <= 0 {
				continue
			}
			n := int32(int64(p.PopulationTotal) * int64(raw[js.Key]) / totalWeight)
			n = min(n, JobCapacity(p, js.Key), remaining)
			next[js.Key] = n
			remaining -= n
		}
	}
	next[JobWater] = remaining
	p.Workers = next
}

func ApplyBalancedAllocation(p *PlayerState) {
	if p.PopulationTotal < 2 {
		p.Workers = map[string]int32{JobWater: p.PopulationTotal}
		return
	}
	if JobCapacity(p, JobWood) == 0 {
		p.Workers = map[string]int32{JobWater: p.PopulationTotal - 1, JobForage: 1}
		return
	}
	ApplyScaledPreset(p, map[string]int32{JobWater: 3, JobWood: 5, JobStone: 3, JobCharcoal: 2, JobSmeltIron: 1, JobPrepRation: 1})
}

func ApplyFocusAllocation(p *PlayerState, focus string) {
	if focus == JobWater {
		p.Workers = map[string]int32{JobWater: p.PopulationTotal}
		return
	}
	ApplyScaledPreset(p, map[string]int32{focus: 3, JobWater: 1})
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
	if spec.Kind == "building" {
		return ErrPrecondition("construction_required", "这是一项设施，请先研究技术再在建设区建造")
	}
	if !BlueprintPrerequisitesMet(p, *spec) {
		return ErrPrecondition("prerequisite_missing", "请完成前置设施或全部工程部件")
	}
	if p.PopulationTotal < spec.RequiredPopulation {
		return ErrPrecondition("insufficient_population", fmt.Sprintf("需要人口达到 %d 人（当前 %d 人）", spec.RequiredPopulation, p.PopulationTotal))
	}
	if reason := CostsBlockReason(p, spec.CostsMilli); reason != "" {
		return ErrPrecondition("insufficient_resource", reason)
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

	for _, spec := range ExpeditionCatalog {
		if spec.RouteCode != route {
			continue
		}
		if spec.EvenSimSecBonusPop > 0 && p.SimulatedElapsedSeconds%2 == 0 && p.PopulationTotal+spec.EvenSimSecBonusPop > HousingCapacity(p) {
			return ErrPrecondition("housing_full", "请扩建住房后安置归来的居民")
		}
		p.ActiveExpedition = nil
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
	if p.BuildingCounts[BuildingCaravan] == 0 {
		return ErrPrecondition("caravan_locked", "请先建造游商驿站")
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
	if p.PopulationTotal+spec.RewardPopulation > HousingCapacity(p) {
		return ErrPrecondition("housing_full", "住房不足以安置这些居民")
	}
	if !CaravanOfferVisible(p, *spec) {
		return ErrPrecondition("offer_locked", "尚未认识这份契约中的物资")
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
