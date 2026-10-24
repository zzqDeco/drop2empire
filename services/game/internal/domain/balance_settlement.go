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
	MinPopForHydrationDrain  int32
	BaseWaterDrainPerPop     int64 // milli-water/sec per resident
	DehydrationEfficiencyPct int64 // 50% efficiency when dehydrated
	SiphonStoneDivisor       int64 // 10:1 water overflow -> stone
	SiphonFlintDivisor       int64 // 80:1 water overflow -> flint

	// Byproduct proc divisors:
	WoodToFlintDivisor         int64
	StoneToFlintDivisor        int64
	StoneToAncientShardDivisor int64

	// Manual water gathering & anti-cheat rate limit:
	BaseGatherClickMilli     int64
	UpgradedGatherClickMilli int64
	FlintProcEveryNClicks    int64
	FlintProcAmountMilli     int64
	MaxClicksPerRequest      int32
	MaxHumanClicksPerSecond  int64
	MinGatherIntervalMs      int64
	GatherBurstAllowanceMs   int64
	MaxRecruitBatchCount     int32
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
	GatherBurstAllowanceMs:   500,
	MaxRecruitBatchCount:     50,
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
	{Key: JobForage, Name: "拾枝", OutputResourceKey: ResWood, BaseRateMilli: 150, UnlockHint: "第一位居民到来后开放", InputSummary: "无需设施 · 最多 1 人 · 应急取得木材"},
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
		UnlockHint:        "建造伐木棚",
		InputSummary:      "产出木材 · 伴生燧石",
	},
	{
		Key:                  JobCharcoal,
		Name:                 "烧炭",
		OutputResourceKey:    ResCharcoal,
		BaseRateMilli:        280,
		RequiredBlueprint:    BPCharcoalKiln,
		UnlockHint:           "建造炭窑",
		InputSummary:         "消耗 0.30 木/s → 木炭",
		InputsPerWorkerMilli: map[string]int64{ResWood: 300},
	},
	{
		Key:               JobStone,
		Name:              "采石",
		OutputResourceKey: ResStone,
		BaseRateMilli:     220,
		RequiredBlueprint: BPQuarryTech,
		UnlockHint:        "建造采石场",
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

// BlueprintCatalog contains completed-effect milestones, improvements and projects.
// Building milestones are earned only by construction, never by research.
var BlueprintCatalog = func() []BlueprintSpec {
	nodes := []BlueprintSpec{
		{Code: BPFirstResident, Name: "汲水改良", Kind: "upgrade", Stage: "early", RequiredPopulation: 1, CostsMilli: resourceCosts(15, 0, 0, 0), EffectSummary: "手动打水 +2/次；每 4 次伴生 0.5 燧石"},
		{Code: "charcoal_improvement", Name: "炭化改良", Kind: "upgrade", Stage: "industry", RequiredPopulation: 1, PrerequisiteCode: BPCharcoalKiln, CostsMilli: resourceCosts(80, 40, 20, 10), EffectSummary: "烧炭效率 +20%", JobEfficiencyBonusPct: map[string]int64{JobCharcoal: 20}},
		{Code: BPStoneVault, Name: "石砌仓储改良", Kind: "upgrade", Stage: "industry", RequiredPopulation: 1, PrerequisiteCode: BPQuarryTech, CostsMilli: resourceCosts(200, 100, 60, 0), EffectSummary: "每座蓄水池与物资堆场的仓容翻倍"},
		{Code: BPStoneSaw1, Name: "石刃锯台改良", Kind: "upgrade", Stage: "industry", RequiredPopulation: 1, PrerequisiteCode: BPCharcoalKiln, CostsMilli: resourceCosts(120, 80, 40, 20), EffectSummary: "伐木、采石效率 +25%；伴生物翻倍", JobEfficiencyBonusPct: map[string]int64{JobWood: 25, JobStone: 25}, DoublesByproductProc: true},
		{Code: BPPartValve, Name: "导水阀芯", Kind: "project", Stage: "assembly", RequiredPopulation: 1, PrerequisiteCode: BPBasicWorkshop, CostsMilli: resourceCosts(300, 60, 20, 10), EffectSummary: "工程部件 · 取水效率 +20%", JobEfficiencyBonusPct: map[string]int64{JobWater: 20}},
		{Code: BPPartFrame, Name: "承压木框", Kind: "project", Stage: "assembly", RequiredPopulation: 1, PrerequisiteCode: BPBasicWorkshop, CostsMilli: resourceCosts(100, 100, 30, 15), EffectSummary: "工程部件 · 伐木效率 +25%", JobEfficiencyBonusPct: map[string]int64{JobWood: 25}},
		{Code: BPPartTablet, Name: "铭文石板", Kind: "project", Stage: "assembly", RequiredPopulation: 1, PrerequisiteCode: BPBasicWorkshop, CostsMilli: resourceCosts(160, 40, 70, 20), EffectSummary: "工程部件 · 采石效率 +30%", JobEfficiencyBonusPct: map[string]int64{JobStone: 30}},
		{Code: BPMysteryTreasure, Name: "装配古代装置", Kind: "project", Stage: "assembly", RequiredPopulation: 1, PrerequisiteCode: BPBasicWorkshop, RequiredCodes: []string{BPPartValve, BPPartFrame, BPPartTablet}, CostsMilli: map[string]int64{}, EffectSummary: "完成三个部件后装配，领取一次性 500 金币并开放职业", GrantsGoldBasis: 500 * GoldScale},
	}
	for _, b := range BuildingCatalog {
		if b.EffectCode == "" {
			continue
		}
		node := BlueprintSpec{Code: b.EffectCode, Name: b.Name, Kind: "building", Stage: "construction", RequiredPopulation: 1, PrerequisiteCode: b.PrerequisiteCode, CostsMilli: map[string]int64{}, EffectSummary: b.EffectSummary}
		if b.Code == BPWaterWheel1 {
			node.JobEfficiencyBonusPct = map[string]int64{JobWater: 25}
		}
		nodes = append(nodes, node)
	}
	return nodes
}()

// EdictCatalog defines the 4 Colony Edicts & Mechanisms with declarative stat modifiers.
var EdictCatalog = []EdictSpec{
	{
		Code:                  EdictNightShift,
		Name:                  "篝火夜班令",
		Category:              "edict",
		PrerequisiteCode:      BPColonyEdicts,
		EffectSummary:         "全岗位采集与工业产出 +45%",
		DrawbackSummary:       "居民耗水 +0.14/秒，且每秒燃烧 0.40 木材（缺木时自动失效）",
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
		RewardSummary: "换取 +12 木材、+10 水",
		RewardsMilli:  map[string]int64{ResWood: 12 * ResourceScale, ResWater: 10 * ResourceScale},
	},
	{
		OfferCode:     "offer_wood_stone",
		Title:         "原木易石契约",
		CostsMilli:    map[string]int64{ResWood: 80 * ResourceScale},
		RewardSummary: "换取 +25 石材、+1 燧石结晶",
		RewardsMilli:  map[string]int64{ResStone: 25 * ResourceScale, ResFlint: 1 * ResourceScale},
	},
	{
		OfferCode:     "offer_charcoal_shard",
		Title:         "燃料换古物拓片",
		CostsMilli:    map[string]int64{ResCharcoal: 20 * ResourceScale},
		RewardSummary: "换取 +1 古文明残片、+80 水",
		RewardsMilli:  map[string]int64{ResAncientShard: ResourceScale, ResWater: 80 * ResourceScale},
	},
	{
		OfferCode:        "offer_refugee_escort",
		Title:            "荒原流民赎买契约",
		CostsMilli:       map[string]int64{ResFlint: 5 * ResourceScale, ResWood: 50 * ResourceScale},
		RewardSummary:    "安置 +2 名居民（需要 2 个空余住房名额）",
		RewardPopulation: 2,
	},
	{
		OfferCode:     "offer_shard_supply",
		Title:         "古物折抵筑城物资",
		CostsMilli:    map[string]int64{ResAncientShard: 2 * ResourceScale},
		RewardSummary: "换取 +20 水、+10 木材、+4 石材",
		RewardsMilli:  map[string]int64{ResWater: 20 * ResourceScale, ResWood: 10 * ResourceScale, ResStone: 4 * ResourceScale},
	},
}
