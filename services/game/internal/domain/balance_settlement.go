package domain

// SettlementBalanceConfig centralizes all numerical parameters for Settlement production,
// population recruitment curves, hydration drain, byproduct proc ratios, and anti-macro rate limits.
var SettlementBalance = struct {
	// Population cost curve parameters:
	// For n < EarlyPopThreshold: ceil(EarlyBaseCost * EarlyGrowthFactor^n)
	// For n >= EarlyPopThreshold: ceil(LateBaseCost + LateSlope * (n - EarlyPopThreshold + 1)^LateExponent)
	EarlyPopThreshold int32
	EarlyBaseCost     float64
	EarlyGrowthFactor float64
	LateBaseCost      float64
	LateSlope         float64
	LateExponent      float64

	// Hydration & Siphon parameters:
	MinPopForHydrationDrain int32
	BaseWaterDrainPerPop    int64 // milli-water/sec per resident
	DehydrationEfficiencyPct int64 // 50% efficiency when dehydrated
	SiphonStoneDivisor      int64 // 10:1 water overflow -> stone
	SiphonFlintDivisor      int64 // 80:1 water overflow -> flint

	// Byproduct proc divisors:
	WoodToFlintDivisor        int64
	StoneToFlintDivisor       int64
	StoneToAncientShardDivisor int64

	// Manual water gathering & anti-cheat rate limit:
	BaseGatherClickMilli       int64
	UpgradedGatherClickMilli   int64
	FlintProcEveryNClicks      int64
	FlintProcAmountMilli       int64
	MaxClicksPerRequest        int32
	MaxHumanClicksPerSecond    int64
	MinGatherIntervalMs        int64
}{
	EarlyPopThreshold: 40,
	EarlyBaseCost:     10.0,
	EarlyGrowthFactor: 1.12,
	LateBaseCost:      931.0,
	LateSlope:         55.0,
	LateExponent:      1.32,

	MinPopForHydrationDrain:  2,
	BaseWaterDrainPerPop:     180,
	DehydrationEfficiencyPct: 50,
	SiphonStoneDivisor:       10,
	SiphonFlintDivisor:       80,

	WoodToFlintDivisor:         30,
	StoneToFlintDivisor:        16,
	StoneToAncientShardDivisor: 45,

	BaseGatherClickMilli:     1 * ResourceScale,
	UpgradedGatherClickMilli: 2 * ResourceScale,
	FlintProcEveryNClicks:    4,
	FlintProcAmountMilli:     500,
	MaxClicksPerRequest:      10,
	MaxHumanClicksPerSecond:  12,
	MinGatherIntervalMs:      45,
}

// JobSpec defines the declarative input/output & unlock specification for a settlement worker job.
type JobSpec struct {
	Key                  string
	Name                 string
	OutputResourceKey    string
	BaseRateMilli        int64
	RequiredBlueprint    string
	RequiresProfession   bool
	UnlockHint           string
	InputSummary         string
	InputsPerWorkerMilli map[string]int64
}

var JobCatalog = []JobSpec{
	{
		Key:               JobWater,
		Name:              "打水",
		OutputResourceKey: ResWater,
		BaseRateMilli:     2000,
		UnlockHint:        "1 人口解锁",
		InputSummary:      "产出净水",
	},
	{
		Key:               JobWood,
		Name:              "伐木",
		OutputResourceKey: ResWood,
		BaseRateMilli:     450,
		RequiredBlueprint: BPAxeBlueprint,
		UnlockHint:        "解锁斧头蓝图",
		InputSummary:      "产出木材 · 伴生燧石",
	},
	{
		Key:                  JobCharcoal,
		Name:                 "烧炭",
		OutputResourceKey:    ResCharcoal,
		BaseRateMilli:        280,
		RequiredBlueprint:    BPCharcoalKiln,
		UnlockHint:           "解锁砖砌炭窑",
		InputSummary:         "消耗 0.30 木/s → 木炭",
		InputsPerWorkerMilli: map[string]int64{ResWood: 300},
	},
	{
		Key:               JobStone,
		Name:              "采石",
		OutputResourceKey: ResStone,
		BaseRateMilli:     220,
		RequiredBlueprint: BPQuarryTech,
		UnlockHint:        "解锁采石技术",
		InputSummary:      "产出石材 · 伴生残片",
	},
	{
		Key:                  JobSmeltIron,
		Name:                 "炼铁",
		OutputResourceKey:    ResIronIngot,
		BaseRateMilli:        110,
		RequiredBlueprint:    BPBasicWorkshop,
		RequiresProfession:   true,
		UnlockHint:           "选定职业解锁",
		InputSummary:         "消耗石+炭 → 铁锭",
		InputsPerWorkerMilli: map[string]int64{ResStone: 180, ResCharcoal: 100},
	},
	{
		Key:                  JobPrepRation,
		Name:                 "制粮",
		OutputResourceKey:    ResRation,
		BaseRateMilli:        150,
		RequiredBlueprint:    BPBasicWorkshop,
		RequiresProfession:   true,
		UnlockHint:           "选定职业解锁",
		InputSummary:         "消耗水+木 → 军粮",
		InputsPerWorkerMilli: map[string]int64{ResWater: 220, ResWood: 100},
	},
}

// BaseResourceCapacityUnits defines the default storage cap (in whole units) before any blueprint expansions.
var BaseResourceCapacityUnits = map[string]int64{
	ResWater:        250,
	ResWood:         450,
	ResCharcoal:     250,
	ResStone:        350,
	ResFlint:        500,
	ResAncientShard: 500,
	ResMeteorOre:    500,
	ResIronIngot:    2000,
	ResRation:       2000,
}

// BlueprintCatalog defines the 17 progression blueprints and their declarative stat modifiers.
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
		Code:                  BPWaterCistern,
		Name:                  "深井蓄水池",
		Stage:                 "phase1_early",
		RequiredPopulation:    4,
		PrerequisiteCode:      BPFirstResident,
		CostsMilli:            map[string]int64{ResWater: 85 * ResourceScale},
		EffectSummary:         "【基建扩容】净水仓储上限提升至 1,200",
		CapacityOverrideUnits: map[string]int64{ResWater: 1200},
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
		EffectSummary:      "【新系统】开放荒原裂隙搜打撤与流浪行商易物驿站",
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
		Code:                  BPLumberYard,
		Name:                  "巨木料场",
		Stage:                 "phase1_early",
		RequiredPopulation:    14,
		PrerequisiteCode:      BPAxeBlueprint,
		CostsMilli:            map[string]int64{ResWater: 280 * ResourceScale, ResWood: 120 * ResourceScale},
		EffectSummary:         "【基建扩容】木材上限提升至 1,500 · 烧炭效率 +20%",
		CapacityOverrideUnits: map[string]int64{ResWood: 1500, ResCharcoal: 800},
		JobEfficiencyBonusPct: map[string]int64{JobCharcoal: 20},
	},
	{
		Code:                  BPWaterWheel1,
		Name:                  "木制引水轮",
		Stage:                 "phase1_early",
		RequiredPopulation:    16,
		PrerequisiteCode:      BPAxeBlueprint,
		CostsMilli:            map[string]int64{ResWater: 350 * ResourceScale, ResWood: 80 * ResourceScale},
		EffectSummary:         "打水 +25% · 水上限提升至 2,400 · 解锁《水压锯木锤》机关",
		CapacityOverrideUnits: map[string]int64{ResWater: 2400},
		JobEfficiencyBonusPct: map[string]int64{JobWater: 25},
	},
	{
		Code:               BPSiphonSluice,
		Name:               "虹吸冲矿槽",
		Stage:              "phase1_early",
		RequiredPopulation: 20,
		PrerequisiteCode:   BPWaterWheel1,
		CostsMilli:         map[string]int64{ResWater: 500 * ResourceScale, ResWood: 180 * ResourceScale, ResFlint: 3 * ResourceScale},
		EffectSummary:      "【跨资源联动】开启后，净水满仓溢出量按 10:1 自动冲刷转化为石材与燧石",
		AutoEnableEdict:    EdictSiphonSluice,
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
		Code:                  BPStoneVault,
		Name:                  "石砌坚库",
		Stage:                 "phase1_early",
		RequiredPopulation:    28,
		PrerequisiteCode:      BPQuarryTech,
		CostsMilli:            map[string]int64{ResWater: 900 * ResourceScale, ResWood: 360 * ResourceScale, ResStone: 110 * ResourceScale},
		EffectSummary:         "【基建扩容】水上限 6,000 / 木上限 2,500 / 石上限 1,500",
		CapacityOverrideUnits: map[string]int64{ResWater: 6000, ResWood: 2500, ResStone: 1500},
	},
	{
		Code:                  BPStoneSaw1,
		Name:                  "石刃锯台",
		Stage:                 "phase1_early",
		RequiredPopulation:    32,
		PrerequisiteCode:      BPQuarryTech,
		CostsMilli:            map[string]int64{ResWater: 1600 * ResourceScale, ResWood: 650 * ResourceScale, ResStone: 180 * ResourceScale},
		EffectSummary:         "伐木、采石效率 +25% · 伴生矿掉落率翻倍",
		JobEfficiencyBonusPct: map[string]int64{JobWood: 25, JobStone: 25},
		DoublesByproductProc:  true,
	},
	{
		Code:                  BPBasicWorkshop,
		Name:                  "基础工坊",
		Stage:                 "phase1_workshop",
		RequiredPopulation:    40,
		PrerequisiteCode:      BPQuarryTech,
		CostsMilli:            map[string]int64{ResWater: 5000 * ResourceScale, ResWood: 1500 * ResourceScale, ResStone: 500 * ResourceScale},
		EffectSummary:         "全资源库容巨幅扩充 · 解锁工坊合成与宝藏三部件修复",
		CapacityOverrideUnits: map[string]int64{ResWater: 30000, ResWood: 15000, ResCharcoal: 4000, ResStone: 10000},
	},
	{
		Code:                  BPPartValve,
		Name:                  "导水阀芯 (1/3)",
		Stage:                 "phase1_treasure",
		RequiredPopulation:    40,
		PrerequisiteCode:      BPBasicWorkshop,
		CostsMilli:            map[string]int64{ResWater: 4200 * ResourceScale, ResWood: 1400 * ResourceScale, ResStone: 400 * ResourceScale},
		EffectSummary:         "宝藏部件 I · 打水效率 +20%",
		JobEfficiencyBonusPct: map[string]int64{JobWater: 20},
	},
	{
		Code:                  BPPartFrame,
		Name:                  "承压木框 (2/3)",
		Stage:                 "phase1_treasure",
		RequiredPopulation:    40,
		PrerequisiteCode:      BPPartValve,
		CostsMilli:            map[string]int64{ResWater: 4800 * ResourceScale, ResWood: 2200 * ResourceScale, ResStone: 550 * ResourceScale},
		EffectSummary:         "宝藏部件 II · 伐木效率 +25%",
		JobEfficiencyBonusPct: map[string]int64{JobWood: 25},
	},
	{
		Code:                  BPPartTablet,
		Name:                  "铭文石板 (3/3)",
		Stage:                 "phase1_treasure",
		RequiredPopulation:    40,
		PrerequisiteCode:      BPPartFrame,
		CostsMilli:            map[string]int64{ResWater: 5000 * ResourceScale, ResWood: 1600 * ResourceScale, ResStone: 800 * ResourceScale},
		EffectSummary:         "宝藏部件 III · 采石效率 +30%",
		JobEfficiencyBonusPct: map[string]int64{JobStone: 30},
	},
	{
		Code:               BPMysteryTreasure,
		Name:               "神秘的宝藏",
		Stage:              "phase1_treasure",
		RequiredPopulation: 40,
		PrerequisiteCode:   BPPartTablet,
		CostsMilli:         map[string]int64{ResWater: 4000 * ResourceScale, ResWood: 1800 * ResourceScale, ResStone: 450 * ResourceScale},
		EffectSummary:      "获得 500 金币 · 开启四大终身职业抉择",
		GrantsGoldBasis:    500 * GoldScale,
	},
}

// EdictCatalog defines the 4 Colony Edicts & Mechanisms with declarative stat modifiers.
var EdictCatalog = []EdictSpec{
	{
		Code:                  EdictNightShift,
		Name:                  "篝火夜班令",
		Category:              "edict",
		PrerequisiteCode:      BPColonyEdicts,
		EffectSummary:         "全岗位采集与工业产出 +45%",
		DrawbackSummary:       "居民耗水 +0.15/秒，且每秒燃烧 0.40 木材（缺木时自动失效）",
		MutuallyExclusiveWith: EdictWaterRation,
		JobEfficiencyBonusPct: map[string]int64{
			JobWater:      45,
			JobWood:       45,
			JobCharcoal:   45,
			JobStone:      45,
			JobSmeltIron:  45,
			JobPrepRation: 45,
		},
		PerResidentWaterDrainMod:  140,
		FlatResourceDrainMilliSec: map[string]int64{ResWood: 400},
	},
	{
		Code:                  EdictWaterRation,
		Name:                  "节水配给制",
		Category:              "edict",
		PrerequisiteCode:      BPColonyEdicts,
		EffectSummary:         "居民日常饮水维持消耗降低 -50%",
		DrawbackSummary:       "全岗位基础作业效率 -15%",
		MutuallyExclusiveWith: EdictNightShift,
		JobEfficiencyBonusPct: map[string]int64{
			JobWater:      -15,
			JobWood:       -15,
			JobCharcoal:   -15,
			JobStone:      -15,
			JobSmeltIron:  -15,
			JobPrepRation: -15,
		},
		PerResidentWaterDrainMod: -90,
	},
	{
		Code:                      EdictHydroSaw,
		Name:                      "水压联动水锤",
		Category:                  "mechanism",
		PrerequisiteCode:          BPWaterWheel1,
		EffectSummary:             "将水轮水压注入林场与炭窑，伐木与烧炭产出 +40%",
		DrawbackSummary:           "水渠引流每秒额外消耗 1.50 水/秒",
		JobEfficiencyBonusPct:     map[string]int64{JobWood: 40, JobCharcoal: 40},
		FlatResourceDrainMilliSec: map[string]int64{ResWater: 1500},
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

// ExpeditionCatalog defines the 3 timed expedition routes and their declarative rewards.
var ExpeditionCatalog = []ExpeditionRouteSpec{
	{
		RouteCode:            ExpRouteWoods,
		Name:                 "枯木林边缘巡弋",
		DurationSeconds:      20,
		CostsMilli:           map[string]int64{ResWater: 25 * ResourceScale},
		RewardSummary:        "带回 35~55 木材 + 2~4 燧石结晶，40% 概率寻获 +1 流民人口",
		RewardsMilli:         map[string]int64{ResWood: 45 * ResourceScale, ResFlint: 3 * ResourceScale},
		EvenSimSecBonusPop:   1,
		CompletionLogWithPop: "★ 斥候自【枯木林】归来：带回 +45 木材、+3 燧石结晶，并救回 +1 名荒原流民！",
		CompletionLogNormal:  "★ 斥候自【枯木林】归来：带回 +45 木材、+3 燧石结晶。",
	},
	{
		RouteCode:           ExpRouteQuarry,
		Name:                "断崖古矿道勘探",
		DurationSeconds:     35,
		CostsMilli:          map[string]int64{ResWater: 45 * ResourceScale, ResWood: 30 * ResourceScale},
		RewardSummary:       "带回 25~40 石材 + 3~5 燧石结晶 + 1 古文明残片",
		RewardsMilli:        map[string]int64{ResStone: 35 * ResourceScale, ResFlint: 4 * ResourceScale, ResAncientShard: 1 * ResourceScale},
		CompletionLogNormal: "★ 斥候自【断崖古矿道】归来：带回 +35 石材、+4 燧石结晶、+1 古文明残片！",
	},
	{
		RouteCode:           ExpRouteSanctum,
		Name:                "沉没圣殿深潜",
		DurationSeconds:     50,
		CostsMilli:          map[string]int64{ResWater: 90 * ResourceScale, ResCharcoal: 15 * ResourceScale, ResFlint: 3 * ResourceScale},
		RewardSummary:       "带回 2~3 古文明残片 + 80 石材 + 6 铁锭",
		RewardsMilli:        map[string]int64{ResAncientShard: 3 * ResourceScale, ResStone: 80 * ResourceScale, ResIronIngot: 6 * ResourceScale},
		CompletionLogNormal: "★ 斥候自【沉没圣殿】归来：带回 +3 古文明残片、+80 石材、+6 铁锭！",
	},
}

// CaravanOfferCatalog defines the 5 caravan trade contracts and their declarative rewards.
var CaravanOfferCatalog = []CaravanOfferSpec{
	{
		OfferCode:     "offer_flint_lumber",
		Title:         "燧石换急用木料",
		CostsMilli:    map[string]int64{ResFlint: 3 * ResourceScale},
		RewardSummary: "换取 +50 木材、+60 水",
		RewardsMilli:  map[string]int64{ResWood: 50 * ResourceScale, ResWater: 60 * ResourceScale},
	},
	{
		OfferCode:     "offer_wood_stone",
		Title:         "原木易石契约",
		CostsMilli:    map[string]int64{ResWood: 80 * ResourceScale},
		RewardSummary: "换取 +35 石材、+2 燧石结晶",
		RewardsMilli:  map[string]int64{ResStone: 35 * ResourceScale, ResFlint: 2 * ResourceScale},
	},
	{
		OfferCode:     "offer_charcoal_shard",
		Title:         "燃料换古物拓片",
		CostsMilli:    map[string]int64{ResCharcoal: 20 * ResourceScale},
		RewardSummary: "换取 +2 古文明残片、+120 水",
		RewardsMilli:  map[string]int64{ResAncientShard: 2 * ResourceScale, ResWater: 120 * ResourceScale},
	},
	{
		OfferCode:        "offer_refugee_escort",
		Title:            "荒原流民赎买契约",
		CostsMilli:       map[string]int64{ResFlint: 5 * ResourceScale, ResWood: 50 * ResourceScale},
		RewardSummary:    "直接安置 +2 名居民人口（免除高昂饮水招募费）",
		RewardPopulation: 2,
	},
	{
		OfferCode:     "offer_shard_supply",
		Title:         "古物折抵筑城物资",
		CostsMilli:    map[string]int64{ResAncientShard: 2 * ResourceScale},
		RewardSummary: "换取 +700 水、+280 木材、+110 石材",
		RewardsMilli:  map[string]int64{ResWater: 700 * ResourceScale, ResWood: 280 * ResourceScale, ResStone: 110 * ResourceScale},
	},
}
