package domain

import (
	"fmt"
	"math"
	"time"
)

var BlueprintCatalog = []BlueprintSpec{
	{
		Code:               BPFirstResident,
		Name:               "定居引水渠",
		Stage:              "phase1_early",
		RequiredPopulation: 1,
		PrerequisiteCode:   "",
		CostsMilli:         map[string]int64{ResWater: 15 * ResourceScale},
		EffectSummary:      "手动打水翻倍（+2/次） · 点击小概率伴生燧石结晶",
	},
	{
		Code:               BPWaterCistern,
		Name:               "深井蓄水池",
		Stage:              "phase1_early",
		RequiredPopulation: 4,
		PrerequisiteCode:   BPFirstResident,
		CostsMilli:         map[string]int64{ResWater: 85 * ResourceScale},
		EffectSummary:      "【基建扩容】净水仓储上限提升至 1,200",
	},
	{
		Code:               BPColonyEdicts,
		Name:               "聚落法令碑",
		Stage:              "phase1_early",
		RequiredPopulation: 6,
		PrerequisiteCode:   BPFirstResident,
		CostsMilli:         map[string]int64{ResWater: 120 * ResourceScale},
		EffectSummary:      "【机制解锁】开放聚落政令开关（篝火夜班 / 节水配给）",
	},
	{
		Code:               BPScoutCamp,
		Name:               "荒原斥候营",
		Stage:              "phase1_early",
		RequiredPopulation: 8,
		PrerequisiteCode:   BPColonyEdicts,
		CostsMilli:         map[string]int64{ResWater: 160 * ResourceScale},
		EffectSummary:      "【新系统】开放荒原远征探索与流浪行商易物驿站",
	},
	{
		Code:               BPAxeBlueprint,
		Name:               "斧头蓝图",
		Stage:              "phase1_early",
		RequiredPopulation: 10,
		PrerequisiteCode:   "",
		CostsMilli:         map[string]int64{ResWater: 200 * ResourceScale},
		EffectSummary:      "解锁【伐木】岗位 · 伐木伴生燧石结晶",
	},
	{
		Code:               BPCharcoalKiln,
		Name:               "砖砌炭窑",
		Stage:              "phase1_early",
		RequiredPopulation: 12,
		PrerequisiteCode:   BPAxeBlueprint,
		CostsMilli:         map[string]int64{ResWater: 240 * ResourceScale, ResWood: 65 * ResourceScale},
		EffectSummary:      "【转化链】解锁【烧炭】岗位（实时消耗原木烧制木炭）",
	},
	{
		Code:               BPLumberYard,
		Name:               "巨木料场",
		Stage:              "phase1_early",
		RequiredPopulation: 14,
		PrerequisiteCode:   BPAxeBlueprint,
		CostsMilli:         map[string]int64{ResWater: 280 * ResourceScale, ResWood: 120 * ResourceScale},
		EffectSummary:      "【基建扩容】木材上限提升至 1,500 · 烧炭效率 +20%",
	},
	{
		Code:               BPWaterWheel1,
		Name:               "木制引水轮",
		Stage:              "phase1_early",
		RequiredPopulation: 16,
		PrerequisiteCode:   BPAxeBlueprint,
		CostsMilli:         map[string]int64{ResWater: 350 * ResourceScale, ResWood: 80 * ResourceScale},
		EffectSummary:      "打水 +25% · 水上限提升至 2,400 · 解锁《水压锯木锤》机关",
	},
	{
		Code:               BPSiphonSluice,
		Name:               "虹吸冲矿槽",
		Stage:              "phase1_early",
		RequiredPopulation: 20,
		PrerequisiteCode:   BPWaterWheel1,
		CostsMilli:         map[string]int64{ResWater: 500 * ResourceScale, ResWood: 180 * ResourceScale, ResFlint: 3 * ResourceScale},
		EffectSummary:      "【跨资源联动】开启后，净水满仓溢出量按 10:1 自动冲刷转化为石材与燧石",
	},
	{
		Code:               BPQuarryTech,
		Name:               "采石技术",
		Stage:              "phase1_early",
		RequiredPopulation: 25,
		PrerequisiteCode:   BPAxeBlueprint,
		CostsMilli:         map[string]int64{ResWater: 600 * ResourceScale, ResWood: 300 * ResourceScale},
		EffectSummary:      "解锁【采石】岗位 · 深层采掘伴生古文明残片",
	},
	{
		Code:               BPStoneVault,
		Name:               "石砌坚库",
		Stage:              "phase1_early",
		RequiredPopulation: 28,
		PrerequisiteCode:   BPQuarryTech,
		CostsMilli:         map[string]int64{ResWater: 900 * ResourceScale, ResWood: 360 * ResourceScale, ResStone: 110 * ResourceScale},
		EffectSummary:      "【基建扩容】水上限 6,000 / 木上限 2,500 / 石上限 1,500",
	},
	{
		Code:               BPStoneSaw1,
		Name:               "石刃锯台",
		Stage:              "phase1_early",
		RequiredPopulation: 32,
		PrerequisiteCode:   BPQuarryTech,
		CostsMilli:         map[string]int64{ResWater: 1600 * ResourceScale, ResWood: 650 * ResourceScale, ResStone: 180 * ResourceScale},
		EffectSummary:      "伐木、采石效率 +25% · 伴生矿掉落率翻倍",
	},
	{
		Code:               BPBasicWorkshop,
		Name:               "基础工坊",
		Stage:              "phase1_workshop",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPQuarryTech,
		CostsMilli:         map[string]int64{ResWater: 5000 * ResourceScale, ResWood: 1500 * ResourceScale, ResStone: 500 * ResourceScale},
		EffectSummary:      "全资源库容巨幅扩充 · 解锁工坊合成与宝藏三部件修复",
	},
	{
		Code:               BPPartValve,
		Name:               "导水阀芯 (1/3)",
		Stage:              "phase1_treasure",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPBasicWorkshop,
		CostsMilli:         map[string]int64{ResWater: 4200 * ResourceScale, ResWood: 1400 * ResourceScale, ResStone: 400 * ResourceScale},
		EffectSummary:      "宝藏部件 I · 打水效率 +20%",
	},
	{
		Code:               BPPartFrame,
		Name:               "承压木框 (2/3)",
		Stage:              "phase1_treasure",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPPartValve,
		CostsMilli:         map[string]int64{ResWater: 4800 * ResourceScale, ResWood: 2200 * ResourceScale, ResStone: 550 * ResourceScale},
		EffectSummary:      "宝藏部件 II · 伐木效率 +25%",
	},
	{
		Code:               BPPartTablet,
		Name:               "铭文石板 (3/3)",
		Stage:              "phase1_treasure",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPPartFrame,
		CostsMilli:         map[string]int64{ResWater: 5000 * ResourceScale, ResWood: 1600 * ResourceScale, ResStone: 800 * ResourceScale},
		EffectSummary:      "宝藏部件 III · 采石效率 +30%",
	},
	{
		Code:               BPMysteryTreasure,
		Name:               "神秘的宝藏",
		Stage:              "phase1_treasure",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPPartTablet,
		CostsMilli:         map[string]int64{ResWater: 4000 * ResourceScale, ResWood: 1800 * ResourceScale, ResStone: 450 * ResourceScale},
		EffectSummary:      "获得 500 金币 · 开启四大终身职业抉择",
	},
}

var EdictCatalog = []EdictSpec{
	{
		Code:             EdictNightShift,
		Name:             "篝火夜班令",
		Category:         "edict",
		PrerequisiteCode: BPColonyEdicts,
		EffectSummary:    "全岗位采集与工业产出 +45%",
		DrawbackSummary:  "居民耗水 +0.15/秒，且每秒燃烧 0.40 木材（缺木时自动失效）",
	},
	{
		Code:             EdictWaterRation,
		Name:             "节水配给制",
		Category:         "edict",
		PrerequisiteCode: BPColonyEdicts,
		EffectSummary:    "居民日常饮水维持消耗降低 -50%",
		DrawbackSummary:  "全岗位基础作业效率 -15%",
	},
	{
		Code:             EdictHydroSaw,
		Name:             "水压联动水锤",
		Category:         "mechanism",
		PrerequisiteCode: BPWaterWheel1,
		EffectSummary:    "将水轮水压注入林场与炭窑，伐木与烧炭产出 +40%",
		DrawbackSummary:  "水渠引流每秒额外消耗 1.50 水/秒",
	},
	{
		Code:             EdictSiphonSluice,
		Name:             "虹吸冲矿机关",
		Category:         "mechanism",
		PrerequisiteCode: BPSiphonSluice,
		EffectSummary:    "净水满仓溢出时，溢出水量按 10:1 自动冲刷转化为石材与燧石",
		DrawbackSummary:  "需保持净水处于满仓溢出状态方可触发",
	},
}

var ExpeditionCatalog = []ExpeditionRouteSpec{
	{
		RouteCode:       ExpRouteWoods,
		Name:            "枯木林边缘巡弋",
		DurationSeconds: 20,
		CostsMilli:      map[string]int64{ResWater: 25 * ResourceScale},
		RewardSummary:   "带回 35~55 木材 + 2~4 燧石结晶，40% 概率寻获 +1 流民人口",
	},
	{
		RouteCode:       ExpRouteQuarry,
		Name:            "断崖古矿道勘探",
		DurationSeconds: 35,
		CostsMilli:      map[string]int64{ResWater: 45 * ResourceScale, ResWood: 30 * ResourceScale},
		RewardSummary:   "带回 25~40 石材 + 3~5 燧石结晶 + 1 古文明残片",
	},
	{
		RouteCode:       ExpRouteSanctum,
		Name:            "沉没圣殿深潜",
		DurationSeconds: 50,
		CostsMilli:      map[string]int64{ResWater: 90 * ResourceScale, ResCharcoal: 15 * ResourceScale, ResFlint: 3 * ResourceScale},
		RewardSummary:   "带回 2~3 古文明残片 + 80 石材 + 6 铁锭",
	},
}

var CaravanOfferCatalog = []CaravanOfferSpec{
	{
		OfferCode:     "offer_flint_lumber",
		Title:         "燧石换急用木料",
		CostsMilli:    map[string]int64{ResFlint: 3 * ResourceScale},
		RewardSummary: "换取 +50 木材、+60 水",
	},
	{
		OfferCode:     "offer_wood_stone",
		Title:         "原木易石契约",
		CostsMilli:    map[string]int64{ResWood: 80 * ResourceScale},
		RewardSummary: "换取 +35 石材、+2 燧石结晶",
	},
	{
		OfferCode:     "offer_charcoal_shard",
		Title:         "燃料换古物拓片",
		CostsMilli:    map[string]int64{ResCharcoal: 20 * ResourceScale},
		RewardSummary: "换取 +2 古文明残片、+120 水",
	},
	{
		OfferCode:     "offer_refugee_escort",
		Title:         "荒原流民赎买契约",
		CostsMilli:    map[string]int64{ResFlint: 5 * ResourceScale, ResWood: 50 * ResourceScale},
		RewardSummary: "直接安置 +2 名居民人口（免除高昂饮水招募费）",
	},
	{
		OfferCode:     "offer_shard_supply",
		Title:         "古物折抵筑城物资",
		CostsMilli:    map[string]int64{ResAncientShard: 2 * ResourceScale},
		RewardSummary: "换取 +700 水、+280 木材、+110 石材",
	},
}

// NextResidentCostMilli computes the exact water cost (in milli-units) to recruit resident #(n+1) when current population is n.
func NextResidentCostMilli(n int32) int64 {
	if n < 0 {
		n = 0
	}
	if n < 40 {
		cost := math.Ceil(10.0 * math.Pow(1.12, float64(n)))
		return int64(cost) * ResourceScale
	}
	extra := float64(n - 39)
	cost := math.Ceil(931.0 + 55.0*math.Pow(extra, 1.32))
	return int64(cost) * ResourceScale
}

func ResourceCapacityMilli(p *PlayerState, resKey string) int64 {
	switch resKey {
	case ResWater:
		capUnits := int64(250)
		if p.UnlockedBlueprints[BPWaterCistern] {
			capUnits = 1200
		}
		if p.UnlockedBlueprints[BPWaterWheel1] && capUnits < 2400 {
			capUnits = 2400
		}
		if p.UnlockedBlueprints[BPStoneVault] && capUnits < 6000 {
			capUnits = 6000
		}
		if p.UnlockedBlueprints[BPBasicWorkshop] && capUnits < 30000 {
			capUnits = 30000
		}
		return capUnits * ResourceScale

	case ResWood:
		capUnits := int64(450)
		if p.UnlockedBlueprints[BPLumberYard] {
			capUnits = 1500
		}
		if p.UnlockedBlueprints[BPStoneVault] && capUnits < 2500 {
			capUnits = 2500
		}
		if p.UnlockedBlueprints[BPBasicWorkshop] && capUnits < 15000 {
			capUnits = 15000
		}
		return capUnits * ResourceScale

	case ResCharcoal:
		capUnits := int64(250)
		if p.UnlockedBlueprints[BPLumberYard] {
			capUnits = 800
		}
		if p.UnlockedBlueprints[BPBasicWorkshop] && capUnits < 4000 {
			capUnits = 4000
		}
		return capUnits * ResourceScale

	case ResStone:
		capUnits := int64(350)
		if p.UnlockedBlueprints[BPStoneVault] {
			capUnits = 1500
		}
		if p.UnlockedBlueprints[BPBasicWorkshop] && capUnits < 10000 {
			capUnits = 10000
		}
		return capUnits * ResourceScale

	case ResFlint, ResAncientShard, ResMeteorOre:
		return 500 * ResourceScale

	case ResIronIngot, ResRation:
		return 2000 * ResourceScale

	default:
		return 0
	}
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

func ComputeJobs(p *PlayerState) []ComputedJob {
	pumpCount := int64(p.InstalledEquipments[ResAutoPump])
	catalystCount := int64(p.InstalledEquipments[ResAlchCatalyst])
	scrollCount := int64(p.InstalledEquipments[ResEnchantScroll])
	toolsetCount := int64(p.InstalledEquipments[ResHeavyToolset])

	waterEff := int64(100)
	woodEff := int64(100)
	charcoalEff := int64(100)
	stoneEff := int64(100)
	ironEff := int64(100)
	rationEff := int64(100)

	if p.UnlockedBlueprints[BPWaterWheel1] {
		waterEff += 25
	}
	if p.UnlockedBlueprints[BPLumberYard] {
		charcoalEff += 20
	}
	if p.UnlockedBlueprints[BPStoneSaw1] {
		woodEff += 25
		stoneEff += 25
	}
	if p.UnlockedBlueprints[BPPartValve] {
		waterEff += 20
	}
	if p.UnlockedBlueprints[BPPartFrame] {
		woodEff += 25
	}
	if p.UnlockedBlueprints[BPPartTablet] {
		stoneEff += 30
	}

	if p.ActiveEdicts[EdictNightShift] && p.UnlockedBlueprints[BPColonyEdicts] && (p.ResourcesMilli[ResWood] > 0 || p.Workers[JobWood] > 0) {
		waterEff += 45
		woodEff += 45
		charcoalEff += 45
		stoneEff += 45
		ironEff += 45
		rationEff += 45
	}
	if p.ActiveEdicts[EdictWaterRation] && p.UnlockedBlueprints[BPColonyEdicts] {
		waterEff -= 15
		woodEff -= 15
		charcoalEff -= 15
		stoneEff -= 15
		ironEff -= 15
		rationEff -= 15
	}
	if p.ActiveEdicts[EdictHydroSaw] && p.UnlockedBlueprints[BPWaterWheel1] && p.ResourcesMilli[ResWater] > 0 {
		woodEff += 40
		charcoalEff += 40
	}

	switch p.Profession {
	case ProfScientist:
		waterEff += 15
		woodEff += 15
		stoneEff += 15
	case ProfAlchemist:
		rationEff += 20
		waterEff += 10
		charcoalEff += 15
	case ProfMage:
		stoneEff += 20
		rationEff += 15
	case ProfArtisan:
		ironEff += 25
		woodEff += 15
		charcoalEff += 20
	}

	waterEff += pumpCount*15 + catalystCount*12
	woodEff += pumpCount*15 + toolsetCount*15 + catalystCount*12
	charcoalEff += toolsetCount*15 + catalystCount*12
	stoneEff += scrollCount*15 + catalystCount*12
	ironEff += toolsetCount*15 + catalystCount*12
	rationEff += scrollCount*15 + catalystCount*12

	if p.HydrationWarning {
		woodEff = (woodEff * 50) / 100
		charcoalEff = (charcoalEff * 50) / 100
		stoneEff = (stoneEff * 50) / 100
		ironEff = (ironEff * 50) / 100
		rationEff = (rationEff * 50) / 100
	}

	specs := []struct {
		key       string
		name      string
		outRes    string
		baseMilli int64
		effPct    int64
		unlocked  bool
		hint      string
		inputNote string
	}{
		{
			key:       JobWater,
			name:      "打水",
			outRes:    ResWater,
			baseMilli: 2000,
			effPct:    waterEff,
			unlocked:  p.PopulationTotal > 0,
			hint:      "1 人口解锁",
			inputNote: "产出净水",
		},
		{
			key:       JobWood,
			name:      "伐木",
			outRes:    ResWood,
			baseMilli: 450,
			effPct:    woodEff,
			unlocked:  p.UnlockedBlueprints[BPAxeBlueprint],
			hint:      "解锁斧头蓝图",
			inputNote: "产出木材 · 伴生燧石",
		},
		{
			key:       JobCharcoal,
			name:      "烧炭",
			outRes:    ResCharcoal,
			baseMilli: 280,
			effPct:    charcoalEff,
			unlocked:  p.UnlockedBlueprints[BPCharcoalKiln],
			hint:      "解锁砖砌炭窑",
			inputNote: "消耗 0.30 木/s → 木炭",
		},
		{
			key:       JobStone,
			name:      "采石",
			outRes:    ResStone,
			baseMilli: 220,
			effPct:    stoneEff,
			unlocked:  p.UnlockedBlueprints[BPQuarryTech],
			hint:      "解锁采石技术",
			inputNote: "产出石材 · 伴生残片",
		},
		{
			key:       JobSmeltIron,
			name:      "炼铁",
			outRes:    ResIronIngot,
			baseMilli: 110,
			effPct:    ironEff,
			unlocked:  p.UnlockedBlueprints[BPBasicWorkshop] && p.Profession != ProfNone,
			hint:      "选定职业解锁",
			inputNote: "消耗石+炭 → 铁锭",
		},
		{
			key:       JobPrepRation,
			name:      "制粮",
			outRes:    ResRation,
			baseMilli: 150,
			effPct:    rationEff,
			unlocked:  p.UnlockedBlueprints[BPBasicWorkshop] && p.Profession != ProfNone,
			hint:      "选定职业解锁",
			inputNote: "消耗水+木 → 军粮",
		},
	}

	out := make([]ComputedJob, 0, len(specs))
	for _, s := range specs {
		assigned := p.Workers[s.key]
		if !s.unlocked {
			assigned = 0
		}
		effRate := (s.baseMilli * s.effPct) / 100
		totalRate := int64(assigned) * effRate
		out = append(out, ComputedJob{
			JobKey:                 s.key,
			Name:                   s.name,
			OutputResourceKey:      s.outRes,
			Assigned:               assigned,
			BaseRateMilli:          s.baseMilli,
			EffectiveRateMilli:     effRate,
			TotalOutputPerSecMilli: totalRate,
			EfficiencyPct:          int32(s.effPct),
			Unlocked:               s.unlocked,
			UnlockHint:             s.hint,
			InputSummary:           s.inputNote,
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

	gross[ResWater] += jobMap[JobWater].TotalOutputPerSecMilli

	woodOut := jobMap[JobWood].TotalOutputPerSecMilli
	gross[ResWood] += woodOut
	if woodOut > 0 {
		flintMult := int64(1)
		if p.UnlockedBlueprints[BPStoneSaw1] {
			flintMult = 2
		}
		gross[ResFlint] += (woodOut * flintMult) / 30
	}

	stoneOut := jobMap[JobStone].TotalOutputPerSecMilli
	gross[ResStone] += stoneOut
	if stoneOut > 0 {
		procMult := int64(1)
		if p.UnlockedBlueprints[BPStoneSaw1] {
			procMult = 2
		}
		gross[ResFlint] += (stoneOut * procMult) / 16
		gross[ResAncientShard] += (stoneOut * procMult) / 45
	}

	if p.PopulationTotal >= 2 {
		perPopWater := int64(180)
		if p.ActiveEdicts[EdictWaterRation] && p.UnlockedBlueprints[BPColonyEdicts] {
			perPopWater = 90
		}
		if p.ActiveEdicts[EdictNightShift] && p.UnlockedBlueprints[BPColonyEdicts] {
			perPopWater += 140
		}
		drain[ResWater] += int64(p.PopulationTotal) * perPopWater
	}
	if p.ActiveEdicts[EdictHydroSaw] && p.UnlockedBlueprints[BPWaterWheel1] && p.ResourcesMilli[ResWater] > 0 {
		drain[ResWater] += 1500
	}
	if p.ActiveEdicts[EdictNightShift] && p.UnlockedBlueprints[BPColonyEdicts] && (p.ResourcesMilli[ResWood] > 0 || gross[ResWood] > 0) {
		drain[ResWood] += 400
	}

	if cj := jobMap[JobCharcoal]; cj.Assigned > 0 && cj.TotalOutputPerSecMilli > 0 {
		woodNeed := int64(cj.Assigned) * 300
		if p.ResourcesMilli[ResWood] > 0 || gross[ResWood] >= drain[ResWood]+woodNeed {
			drain[ResWood] += woodNeed
			gross[ResCharcoal] += cj.TotalOutputPerSecMilli
		} else if availWood := gross[ResWood] - drain[ResWood]; availWood > 0 {
			drain[ResWood] += availWood
			gross[ResCharcoal] += (cj.TotalOutputPerSecMilli * availWood) / woodNeed
		}
	}

	if ij := jobMap[JobSmeltIron]; ij.Assigned > 0 && ij.TotalOutputPerSecMilli > 0 {
		stoneNeed := int64(ij.Assigned) * 180
		coalNeed := int64(ij.Assigned) * 100
		hasStone := p.ResourcesMilli[ResStone] > 0 || gross[ResStone] >= stoneNeed
		hasCoal := p.ResourcesMilli[ResCharcoal] > 0 || gross[ResCharcoal] >= coalNeed || p.ResourcesMilli[ResWood] > 0
		if hasStone && hasCoal {
			drain[ResStone] += stoneNeed
			if p.ResourcesMilli[ResCharcoal] > 0 || gross[ResCharcoal] > 0 {
				drain[ResCharcoal] += coalNeed
			} else {
				drain[ResWood] += coalNeed
			}
			gross[ResIronIngot] += ij.TotalOutputPerSecMilli
		}
	}

	if rj := jobMap[JobPrepRation]; rj.Assigned > 0 && rj.TotalOutputPerSecMilli > 0 {
		waterNeed := int64(rj.Assigned) * 220
		woodNeed := int64(rj.Assigned) * 100
		if (p.ResourcesMilli[ResWater] > 0 || gross[ResWater] >= drain[ResWater]+waterNeed) &&
			(p.ResourcesMilli[ResWood] > 0 || gross[ResWood] >= drain[ResWood]+woodNeed) {
			drain[ResWater] += waterNeed
			drain[ResWood] += woodNeed
			gross[ResRation] += rj.TotalOutputPerSecMilli
		}
	}

	waterCap := ResourceCapacityMilli(p, ResWater)
	if p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice] &&
		waterCap > 0 && p.ResourcesMilli[ResWater] >= waterCap && gross[ResWater] > drain[ResWater] {
		overflow := gross[ResWater] - drain[ResWater]
		drain[ResWater] += overflow
		gross[ResStone] += overflow / 10
		gross[ResFlint] += overflow / 80
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
				addResourceWithCap(p, ResStone, overflow/10)
				addResourceWithCap(p, ResFlint, overflow/80)
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
	p.HydrationWarning = p.PopulationTotal >= 2 && p.ResourcesMilli[ResWater] == 0 && grossAfter[ResWater] < drainAfter[ResWater]
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

func GatherWater(p *PlayerState, clicks int32, now time.Time) error {
	if clicks <= 0 {
		clicks = 1
	}
	if clicks > 50 {
		clicks = 50
	}
	perClickMilli := ResourceScale
	if p.UnlockedBlueprints[BPFirstResident] {
		perClickMilli = 2 * ResourceScale
	}
	gain := int64(clicks) * perClickMilli
	overflow := addResourceWithCap(p, ResWater, gain)
	if overflow > 0 && p.ActiveEdicts[EdictSiphonSluice] && p.UnlockedBlueprints[BPSiphonSluice] {
		addResourceWithCap(p, ResStone, overflow/10)
		addResourceWithCap(p, ResFlint, overflow/80)
	}
	prevClicks := p.TotalManualClicks
	p.TotalManualClicks += int64(clicks)
	if p.UnlockedBlueprints[BPFirstResident] && (p.TotalManualClicks/4) > (prevClicks/4) {
		procs := (p.TotalManualClicks / 4) - (prevClicks / 4)
		addResourceWithCap(p, ResFlint, procs*500)
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
	if count > 50 {
		count = 50
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
			if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
				return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】，无法分配伐木工")
			}
			if k == JobCharcoal && !p.UnlockedBlueprints[BPCharcoalKiln] {
				return ErrPrecondition("job_locked", "尚未解锁【砖砌炭窑】，无法分配烧炭工")
			}
			if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
				return ErrPrecondition("job_locked", "尚未解锁【采石技术】，无法分配采石工")
			}
			if (k == JobSmeltIron || k == JobPrepRation) && (!p.UnlockedBlueprints[BPBasicWorkshop] || p.Profession == ProfNone) {
				return ErrPrecondition("job_locked", "尚未开启工坊高炉/军需产线，无法分配该岗位")
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

	if code == BPSiphonSluice {
		if p.ActiveEdicts == nil {
			p.ActiveEdicts = map[string]bool{}
		}
		p.ActiveEdicts[EdictSiphonSluice] = true
	}

	if code == BPMysteryTreasure {
		if p.Phase < 2 {
			p.Phase = 2
		}
		starterGold := int64(500) * GoldScale
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
		if code == EdictNightShift {
			p.ActiveEdicts[EdictWaterRation] = false
		} else if code == EdictWaterRation {
			p.ActiveEdicts[EdictNightShift] = false
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

	switch route {
	case ExpRouteWoods:
		addResourceWithCap(p, ResWood, 45*ResourceScale)
		addResourceWithCap(p, ResFlint, 3*ResourceScale)
		if p.SimulatedElapsedSeconds%2 == 0 {
			p.PopulationTotal++
			p.Workers[JobWater]++
			AppendLog(p, now, "PRODUCTION", "★ 斥候自【枯木林】归来：带回 +45 木材、+3 燧石结晶，并救回 +1 名荒原流民！")
		} else {
			AppendLog(p, now, "PRODUCTION", "★ 斥候自【枯木林】归来：带回 +45 木材、+3 燧石结晶。")
		}
	case ExpRouteQuarry:
		addResourceWithCap(p, ResStone, 35*ResourceScale)
		addResourceWithCap(p, ResFlint, 4*ResourceScale)
		addResourceWithCap(p, ResAncientShard, 1*ResourceScale)
		AppendLog(p, now, "PRODUCTION", "★ 斥候自【断崖古矿道】归来：带回 +35 石材、+4 燧石结晶、+1 古文明残片！")
	case ExpRouteSanctum:
		addResourceWithCap(p, ResAncientShard, 3*ResourceScale)
		addResourceWithCap(p, ResStone, 80*ResourceScale)
		addResourceWithCap(p, ResIronIngot, 6*ResourceScale)
		AppendLog(p, now, "PRODUCTION", "★ 斥候自【沉没圣殿】归来：带回 +3 古文明残片、+80 石材、+6 铁锭！")
	default:
		addResourceWithCap(p, ResWood, 30*ResourceScale)
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

	switch offerCode {
	case "offer_flint_lumber":
		addResourceWithCap(p, ResWood, 50*ResourceScale)
		addResourceWithCap(p, ResWater, 60*ResourceScale)
	case "offer_wood_stone":
		addResourceWithCap(p, ResStone, 35*ResourceScale)
		addResourceWithCap(p, ResFlint, 2*ResourceScale)
	case "offer_charcoal_shard":
		addResourceWithCap(p, ResAncientShard, 2*ResourceScale)
		addResourceWithCap(p, ResWater, 120*ResourceScale)
	case "offer_refugee_escort":
		p.PopulationTotal += 2
		p.Workers[JobWater] += 2
	case "offer_shard_supply":
		addResourceWithCap(p, ResWater, 700*ResourceScale)
		addResourceWithCap(p, ResWood, 280*ResourceScale)
		addResourceWithCap(p, ResStone, 110*ResourceScale)
	}
	AppendLog(p, now, "MARKET", fmt.Sprintf("已与流浪行商完成契约【%s】：%s。", spec.Title, spec.RewardSummary))
	return nil
}
