package domain

// MacroBalance centralizes numerical parameters for Profession starter grants, Workshop crafting fees,
// Spot Market bounds, Guild creation/donation rules, and Chamber War combat & reward formulas.
var MacroBalance = struct {
	MaxCraftBatchesPerReq     int32
	CraftingFeeBurnShareDiv   int64 // 2 -> 50% burned, 50% to treasury
	StarterUniversalGrants    map[string]int64
	StarterActivityPoints     int32

	// Spot Market order validation bounds:
	MinOrderPriceBasis int64
	MaxOrderPriceBasis int64
	MinOrderQtyMilli   int64
	MaxOrderQtyMilli   int64

	// Guild progression & donation parameters:
	GuildXPPerLevel            int64
	GuildMaxLevel              int32
	GuildRallyBaseBonusPct     int32
	GuildRallyBonusPerLvlPct   int32
	GuildWarPtsPerLvl          int32
	GuildCreateWaterCostMilli  int64
	GuildCreateWoodCostMilli   int64
	GuildCreateStoneCostMilli  int64
	GuildCreateInitXP          int64
	GuildCreateInitContrib     int64
	GuildDonateWaterCostMilli  int64
	GuildDonateWoodCostMilli   int64
	GuildDonateStoneCostMilli  int64
	GuildDonateSuppliesXP      int64
	GuildDonateSuppliesContrib int64
	GuildDonateSuppliesPts     int32
	GuildDonateGoldCostBasis   int64
	GuildDonateGoldXP          int64
	GuildDonateGoldContrib     int64
	GuildDonateGoldPts         int32

	// Chamber War deployment, counter matrix, attrition & daily settlement rewards:
	WarDeployContribPerUnit int64
	WarDeployGuildXPPerUnit int64
	WarDeployRallyBonusPts  int32
	WarCounterMatrixBps     [3][3]int64
	WarWinAttritionPct      int32
	WarLoseAttritionPct     int32
	WarLoserBasePts         int32
	WarWinnerBasePts        int32
	WarPtsPerUnitDeployed   int32
	WarBaseStipendGold      int64
	WarStipendGoldPerUnit   int64
	MaxWarHistoryEntries    int
}{
	MaxCraftBatchesPerReq:   20,
	CraftingFeeBurnShareDiv: 2,
	StarterUniversalGrants: map[string]int64{
		ResIronIngot:   10 * ResourceScale,
		ResRation:      12 * ResourceScale,
		ResInfantryKit: 6 * ResourceScale,
		ResArcherKit:   6 * ResourceScale,
		ResCavalryKit:  6 * ResourceScale,
	},
	StarterActivityPoints: 120,

	MinOrderPriceBasis: 100,
	MaxOrderPriceBasis: 100_000_000,
	MinOrderQtyMilli:   1000,
	MaxOrderQtyMilli:   1_000_000_000_000,

	GuildXPPerLevel:            500,
	GuildMaxLevel:              10,
	GuildRallyBaseBonusPct:     10,
	GuildRallyBonusPerLvlPct:   3,
	GuildWarPtsPerLvl:          5,
	GuildCreateWaterCostMilli:  100 * ResourceScale,
	GuildCreateWoodCostMilli:   60 * ResourceScale,
	GuildCreateStoneCostMilli:  30 * ResourceScale,
	GuildCreateInitXP:          120,
	GuildCreateInitContrib:     100,
	GuildDonateWaterCostMilli:  80 * ResourceScale,
	GuildDonateWoodCostMilli:   50 * ResourceScale,
	GuildDonateStoneCostMilli:  25 * ResourceScale,
	GuildDonateSuppliesXP:      120,
	GuildDonateSuppliesContrib: 100,
	GuildDonateSuppliesPts:     15,
	GuildDonateGoldCostBasis:   50 * GoldScale,
	GuildDonateGoldXP:          200,
	GuildDonateGoldContrib:     180,
	GuildDonateGoldPts:         25,

	WarDeployContribPerUnit: 15,
	WarDeployGuildXPPerUnit: 10,
	WarDeployRallyBonusPts:  5,
	WarCounterMatrixBps: [3][3]int64{
		{10000, 11500, 9000},
		{9000, 10000, 11500},
		{11500, 9000, 10000},
	},
	WarWinAttritionPct:    20,
	WarLoseAttritionPct:   40,
	WarLoserBasePts:       45,
	WarWinnerBasePts:      75,
	WarPtsPerUnitDeployed: 3,
	WarBaseStipendGold:    80,
	WarStipendGoldPerUnit: 4,
	MaxWarHistoryEntries:  14,
}

// ResourceCatalog defines all physical resources, intermediate goods, armaments, single-use raid blueprints,
// and season-limited cosmetics together with their reference initial market price.
var ResourceCatalog = []ResourceMeta{
	{Key: ResWater, Name: "水", Tier: "basic", Description: "居民维持与动力水源", Tradable: true, InitPriceBasis: 1000},
	{Key: ResWood, Name: "木材", Tier: "basic", Description: "建筑与烧炭原木", Tradable: true, InitPriceBasis: 4500},
	{Key: ResCharcoal, Name: "木炭", Tier: "basic", Description: "炭窑烧制 · 冶金与夜班燃料", Tradable: true, InitPriceBasis: 12000},
	{Key: ResStone, Name: "石材", Tier: "basic", Description: "工程与冶炼矿石", Tradable: true, InitPriceBasis: 9500},
	{Key: ResFlint, Name: "燧石结晶", Tier: "relic", Description: "采集伴生晶矿 · 用于机关与游商易物", Tradable: true, InitPriceBasis: 28000},
	{Key: ResAncientShard, Name: "古文明残片", Tier: "relic", Description: "远征与深层采掘所得 · 远古遗物核心", Tradable: true, InitPriceBasis: 65000},
	{Key: ResMeteorOre, Name: "星陨秘银", Tier: "relic", Description: "荒原秘境搜出 · 高阶军械与黑市硬通货", Tradable: true, InitPriceBasis: 145000},
	{Key: ResIronIngot, Name: "铁锭", Tier: "intermediate", Description: "高炉吞吐石材与木炭精炼", Tradable: true, InitPriceBasis: 32000},
	{Key: ResRation, Name: "军粮", Tier: "intermediate", Description: "消耗净水与木材封装", Tradable: true, InitPriceBasis: 24000},
	{Key: ResAutoPump, Name: "自动抽水机", Tier: "profession", Description: "科学家制品 · 打水/伐木 +15%", Tradable: true, InitPriceBasis: 185000},
	{Key: ResAlchCatalyst, Name: "赫尔墨斯催化剂", Tier: "profession", Description: "炼金制品 · 全岗位 +12%", Tradable: true, InitPriceBasis: 195000},
	{Key: ResEnchantScroll, Name: "星界附魔卷轴", Tier: "profession", Description: "魔法师制品 · 采石/军粮 +15%", Tradable: true, InitPriceBasis: 200000},
	{Key: ResHeavyToolset, Name: "泰坦精锻工具组", Tier: "profession", Description: "工匠制品 · 伐木/炼铁 +15%", Tradable: true, InitPriceBasis: 190000},
	{Key: ResInfantryKit, Name: "重步兵军备", Tier: "war", Description: "步兵编制 · 克弓兵", Tradable: true, InitPriceBasis: 98000},
	{Key: ResArcherKit, Name: "长弓兵军备", Tier: "war", Description: "弓兵编制 · 克骑兵", Tradable: true, InitPriceBasis: 102000},
	{Key: ResCavalryKit, Name: "铁骑兵军备", Tier: "war", Description: "骑兵编制 · 克步兵", Tradable: true, InitPriceBasis: 112000},
	{Key: ResSeasonChest, Name: "S1·墨械宝箱", Tier: "season", Description: "开启获得随机纹理藏品", Tradable: true, InitPriceBasis: 450000},

	// Tradable Single-Use Raid Blueprints (consumed on learn to unlock season crafting, or traded on Market)
	{Key: ResBPCrossbow, Name: "★图纸：墨械连发手弩", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 武器打造（可交易）", Tradable: true, InitPriceBasis: 220000},
	{Key: ResBPTitanHammer, Name: "★★图纸：泰坦裂地重锤", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 武器打造（可交易）", Tradable: true, InitPriceBasis: 580000},
	{Key: ResBPCarapaceArmor, Name: "★图纸：沙虫壳胸甲", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 护甲打造（可交易）", Tradable: true, InitPriceBasis: 210000},
	{Key: ResBPHydroArmor, Name: "★★图纸：水压动力重甲", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 护甲打造（可交易）", Tradable: true, InitPriceBasis: 620000},
	{Key: ResBPSpringBoots, Name: "★图纸：墨械弹簧战靴", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 战靴打造（可交易）", Tradable: true, InitPriceBasis: 240000},
	{Key: ResBPHermesBoots, Name: "★★图纸：赫尔墨斯风行靴", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 极速靴打造（可交易）", Tradable: true, InitPriceBasis: 680000},
	{Key: ResBPCipherSafe, Name: "★图纸：墨械密码保险箱", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 3 格安全箱打造（可交易）", Tradable: true, InitPriceBasis: 360000},
	{Key: ResBPAetherSafe, Name: "★★图纸：泰坦次元保险箱", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 5 格安全箱打造（可交易）", Tradable: true, InitPriceBasis: 950000},
	{Key: ResBPScavengeElixir, Name: "★图纸：速搜合剂配方", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季速搜药水调配（可交易）", Tradable: true, InitPriceBasis: 190000},
	{Key: ResBPBerserkElixir, Name: "★★图纸：狂暴圣水配方", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季免死圣水调配（可交易）", Tradable: true, InitPriceBasis: 520000},

	// Tradable Season-Limited Animated Avatar Cosmetics
	{Key: ResCosGoggles, Name: "荒原防风护目镜", Tier: "cosmetic", Description: "罕见头饰 · 领主与地图形象可穿戴（可交易）", Tradable: true, InitPriceBasis: 320000},
	{Key: ResCosSteamCrown, Name: "墨械蒸汽齿轮冠", Tier: "cosmetic", Description: "史诗头饰 · 动态旋转黄铜齿轮（可交易）", Tradable: true, InitPriceBasis: 880000},
	{Key: ResCosObsidianCrown, Name: "★S1·曜石星辉王冠", Tier: "cosmetic", Description: "S1传说限定头饰 · 悬浮黑曜星环特效（可交易）", Tradable: true, InitPriceBasis: 2800000},
	{Key: ResCosSandCloak, Name: "沙行旅人斗篷", Tier: "cosmetic", Description: "罕见背饰 · 荒原防风披风（可交易）", Tradable: true, InitPriceBasis: 310000},
	{Key: ResCosHydroWings, Name: "阿基米德水翼背甲", Tier: "cosmetic", Description: "史诗背饰 · 水压喷流羽翼（可交易）", Tradable: true, InitPriceBasis: 920000},
	{Key: ResCosAstralWings, Name: "★S1·星界流光羽翼", Tier: "cosmetic", Description: "S1传说限定背饰 · 双翼动态扇动与星轨（可交易）", Tradable: true, InitPriceBasis: 3200000},
	{Key: ResCosCompass, Name: "寻脉青铜罗盘", Tier: "cosmetic", Description: "罕见手持 · 磁针摆动罗盘（可交易）", Tradable: true, InitPriceBasis: 300000},
	{Key: ResCosAlchLantern, Name: "赫尔墨斯荧光提灯", Tier: "cosmetic", Description: "史诗手持 · 翠绿炼金火苗跳动（可交易）", Tradable: true, InitPriceBasis: 860000},
	{Key: ResCosThunderStaff, Name: "★S1·泰坦雷鸣权杖", Tier: "cosmetic", Description: "S1传说限定手持 · 脉冲电弧核心（可交易）", Tradable: true, InitPriceBasis: 2950000},
	{Key: ResCosWoodFrog, Name: "汲水发条木蛙", Tier: "cosmetic", Description: "罕见随从 · 蹦跳机巧木蛙（可交易）", Tradable: true, InitPriceBasis: 350000},
	{Key: ResCosMechOwl, Name: "炼金机械猫头鹰", Tier: "cosmetic", Description: "史诗随从 · 振翅盘旋夜视枭（可交易）", Tradable: true, InitPriceBasis: 960000},
	{Key: ResCosAetherDrake, Name: "★S1·星界以太幼龙", Tier: "cosmetic", Description: "S1传说限定随从 · 环绕飞行吐泡幼龙（可交易）", Tradable: true, InitPriceBasis: 3500000},
}

// NPCSeedOrderSpec defines an initial NPC market maker order.
type NPCSeedOrderSpec struct {
	ItemKey       string
	Side          string
	PriceBasis    int64
	QuantityMilli int64
	MakerHandle   string
}

var NPCMarketSeedOrders = []NPCSeedOrderSpec{
	{ResWater, "BID", 900, 5000 * ResourceScale, "炼金师·赫尔"},
	{ResWater, "ASK", 1100, 6000 * ResourceScale, "科学家·林格"},
	{ResWood, "BID", 4200, 2000 * ResourceScale, "铁匠·巴隆"},
	{ResWood, "ASK", 4800, 2500 * ResourceScale, "科学家·林格"},
	{ResStone, "BID", 9000, 1200 * ResourceScale, "铁匠·巴隆"},
	{ResStone, "ASK", 10200, 1400 * ResourceScale, "大法师·梅林"},
	{ResIronIngot, "BID", 30000, 40 * ResourceScale, "科学家·林格"},
	{ResIronIngot, "ASK", 34000, 45 * ResourceScale, "铁匠·巴隆"},
	{ResRation, "BID", 22000, 50 * ResourceScale, "军需官·霍克"},
	{ResRation, "ASK", 26000, 60 * ResourceScale, "炼金师·赫尔"},
	{ResAutoPump, "BID", 170000, 4 * ResourceScale, "炼金师·赫尔"},
	{ResAutoPump, "ASK", 192000, 5 * ResourceScale, "科学家·林格"},
	{ResAlchCatalyst, "BID", 180000, 4 * ResourceScale, "大法师·梅林"},
	{ResAlchCatalyst, "ASK", 205000, 5 * ResourceScale, "炼金师·赫尔"},
	{ResEnchantScroll, "BID", 185000, 4 * ResourceScale, "铁匠·巴隆"},
	{ResEnchantScroll, "ASK", 210000, 5 * ResourceScale, "大法师·梅林"},
	{ResHeavyToolset, "BID", 175000, 4 * ResourceScale, "科学家·林格"},
	{ResHeavyToolset, "ASK", 198000, 5 * ResourceScale, "铁匠·巴隆"},
	{ResInfantryKit, "BID", 94000, 15 * ResourceScale, "黑曜军需处"},
	{ResInfantryKit, "ASK", 104000, 15 * ResourceScale, "铁匠·巴隆"},
	{ResArcherKit, "BID", 97000, 15 * ResourceScale, "白银军需处"},
	{ResArcherKit, "ASK", 108000, 15 * ResourceScale, "大法师·梅林"},
	{ResCavalryKit, "BID", 106000, 15 * ResourceScale, "黑曜军需处"},
	{ResCavalryKit, "ASK", 118000, 15 * ResourceScale, "炼金师·赫尔"},
	{ResSeasonChest, "BID", 420000, 3 * ResourceScale, "收藏家·维克"},
	{ResSeasonChest, "ASK", 480000, 2 * ResourceScale, "白银军需处"},
	{ResBPCrossbow, "BID", 200000, 2 * ResourceScale, "斥候统领·雷恩"},
	{ResBPCrossbow, "ASK", 240000, 2 * ResourceScale, "荒原黑市商团"},
	{ResBPSpringBoots, "BID", 220000, 2 * ResourceScale, "斥候统领·雷恩"},
	{ResBPSpringBoots, "ASK", 260000, 2 * ResourceScale, "荒原黑市商团"},
	{ResBPCipherSafe, "BID", 330000, 2 * ResourceScale, "收藏家·维克"},
	{ResBPCipherSafe, "ASK", 390000, 1 * ResourceScale, "荒原黑市商团"},
	{ResCosGoggles, "BID", 290000, 2 * ResourceScale, "收藏家·维克"},
	{ResCosGoggles, "ASK", 350000, 1 * ResourceScale, "荒原黑市商团"},
	{ResCosObsidianCrown, "BID", 2600000, 1 * ResourceScale, "收藏家·维克"},
	{ResCosAstralWings, "BID", 3000000, 1 * ResourceScale, "收藏家·维克"},
}

type NPCSeedTradeSpec struct {
	ItemKey       string
	PriceBasis    int64
	QuantityMilli int64
	BuyerHandle   string
	SellerHandle  string
}

var NPCMarketSeedTrades = []NPCSeedTradeSpec{
	{ResAutoPump, 185000, 2 * ResourceScale, "炼金师·赫尔", "科学家·林格"},
	{ResAlchCatalyst, 195000, 2 * ResourceScale, "铁匠·巴隆", "炼金师·赫尔"},
	{ResEnchantScroll, 200000, 1 * ResourceScale, "科学家·林格", "大法师·梅林"},
	{ResInfantryKit, 98000, 6 * ResourceScale, "黑曜军需处", "铁匠·巴隆"},
}

// ProfessionCatalog defines the 4 lifelong professions and their declarative stat modifiers.
var ProfessionCatalog = []ProfessionSpec{
	{
		Code:             ProfScientist,
		Name:             "科学家",
		Title:            "工业自动化",
		ArtifactName:     "阿基米德水力核",
		ExclusiveOutputs: []string{"自动抽水机"},
		StrengthText:     "基础资源高产",
		WeaknessText:     "耗铁量高",
		MarketRoleText:   "自动化设备供应",
		PassiveBonusText: "水/木/石效率 +15%",
		JobEfficiencyBonusPct: map[string]int64{
			JobWater: 15,
			JobWood:  15,
			JobStone: 15,
		},
		StarterGrantUnits:     map[string]int64{ResAutoPump: 2},
		ArmamentOutputMultPct: 100,
	},
	{
		Code:             ProfAlchemist,
		Name:             "炼金术士",
		Title:            "高能催化",
		ArtifactName:     "赫尔墨斯蒸馏釜",
		ExclusiveOutputs: []string{"赫尔墨斯催化剂"},
		StrengthText:     "全工坊通用增产",
		WeaknessText:     "基础采集较慢",
		MarketRoleText:   "催化剂供应",
		PassiveBonusText: "军粮 +20% / 水 +10%",
		JobEfficiencyBonusPct: map[string]int64{
			JobPrepRation: 20,
			JobWater:      10,
			JobCharcoal:   15,
		},
		StarterGrantUnits:     map[string]int64{ResAlchCatalyst: 2},
		ArmamentOutputMultPct: 100,
	},
	{
		Code:             ProfMage,
		Name:             "魔法师",
		Title:            "以太铭文",
		ArtifactName:     "星界刻印棱镜",
		ExclusiveOutputs: []string{"星界附魔卷轴"},
		StrengthText:     "矿石与远程强化",
		WeaknessText:     "耗木量高",
		MarketRoleText:   "附魔卷轴供应",
		PassiveBonusText: "采石 +20% / 军粮 +15%",
		JobEfficiencyBonusPct: map[string]int64{
			JobStone:      20,
			JobPrepRation: 15,
		},
		StarterGrantUnits:     map[string]int64{ResEnchantScroll: 2},
		ArmamentOutputMultPct: 100,
	},
	{
		Code:             ProfArtisan,
		Name:             "工匠",
		Title:            "重装锻造",
		ArtifactName:     "泰坦锻造矩尺",
		ExclusiveOutputs: []string{"泰坦精锻工具组"},
		StrengthText:     "冶金与军械制造",
		WeaknessText:     "依赖外部矿源",
		MarketRoleText:   "工具与军备供应",
		PassiveBonusText: "炼铁 +25% / 伐木 +15%",
		JobEfficiencyBonusPct: map[string]int64{
			JobSmeltIron: 25,
			JobWood:      15,
			JobCharcoal:  20,
		},
		StarterGrantUnits:     map[string]int64{ResHeavyToolset: 2},
		ArmamentOutputMultPct: 125,
	},
}

// CraftRecipeCatalog defines all Workshop crafting recipes.
var CraftRecipeCatalog = []CraftRecipeSpec{
	{
		RecipeCode:        "craft_iron_batch",
		Name:              "急炼铁锭",
		Category:          "intermediate",
		ProfessionReq:     "all",
		ProfessionReqName: "通用",
		OutputKey:         ResIronIngot,
		OutputName:        "铁锭",
		OutputAmountMilli: 5 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 180 * ResourceScale, ResWood: 120 * ResourceScale, ResStone: 90 * ResourceScale},
		GoldCostBasis:     0,
		EffectSummary:     "产出 5 铁锭",
	},
	{
		RecipeCode:        "craft_ration_batch",
		Name:              "干粮封装",
		Category:          "intermediate",
		ProfessionReq:     "all",
		ProfessionReqName: "通用",
		OutputKey:         ResRation,
		OutputName:        "军粮",
		OutputAmountMilli: 8 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 240 * ResourceScale, ResWood: 100 * ResourceScale},
		GoldCostBasis:     0,
		EffectSummary:     "产出 8 军粮",
	},
	{
		RecipeCode:        "craft_auto_pump",
		Name:              "自动抽水机",
		Category:          "profession",
		ProfessionReq:     ProfScientist,
		ProfessionReqName: "科学家",
		OutputKey:         ResAutoPump,
		OutputName:        "自动抽水机",
		OutputAmountMilli: 1 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 600 * ResourceScale, ResWood: 300 * ResourceScale, ResIronIngot: 4 * ResourceScale},
		GoldCostBasis:     5 * GoldScale,
		EffectSummary:     "装槽：打水/伐木 +15%",
	},
	{
		RecipeCode:        "craft_alch_catalyst",
		Name:              "赫尔墨斯催化剂",
		Category:          "profession",
		ProfessionReq:     ProfAlchemist,
		ProfessionReqName: "炼金术士",
		OutputKey:         ResAlchCatalyst,
		OutputName:        "赫尔墨斯催化剂",
		OutputAmountMilli: 1 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 800 * ResourceScale, ResStone: 220 * ResourceScale, ResRation: 4 * ResourceScale},
		GoldCostBasis:     5 * GoldScale,
		EffectSummary:     "装槽：全岗位 +12%",
	},
	{
		RecipeCode:        "craft_enchant_scroll",
		Name:              "星界附魔卷轴",
		Category:          "profession",
		ProfessionReq:     ProfMage,
		ProfessionReqName: "魔法师",
		OutputKey:         ResEnchantScroll,
		OutputName:        "星界附魔卷轴",
		OutputAmountMilli: 1 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 500 * ResourceScale, ResWood: 380 * ResourceScale, ResStone: 200 * ResourceScale},
		GoldCostBasis:     5 * GoldScale,
		EffectSummary:     "装槽：采石/军粮 +15%",
	},
	{
		RecipeCode:        "craft_heavy_toolset",
		Name:              "泰坦精锻工具组",
		Category:          "profession",
		ProfessionReq:     ProfArtisan,
		ProfessionReqName: "工匠",
		OutputKey:         ResHeavyToolset,
		OutputName:        "泰坦精锻工具组",
		OutputAmountMilli: 1 * ResourceScale,
		CostsMilli:        map[string]int64{ResWood: 280 * ResourceScale, ResStone: 240 * ResourceScale, ResIronIngot: 4 * ResourceScale},
		GoldCostBasis:     5 * GoldScale,
		EffectSummary:     "装槽：伐木/炼铁 +15%",
	},
	{
		RecipeCode:        "craft_infantry_kit",
		Name:              "重步兵军备",
		Category:          "armament",
		ProfessionReq:     "all",
		ProfessionReqName: "通用",
		OutputKey:         ResInfantryKit,
		OutputName:        "重步兵军备",
		OutputAmountMilli: 2 * ResourceScale,
		CostsMilli:        map[string]int64{ResWood: 220 * ResourceScale, ResIronIngot: 3 * ResourceScale, ResRation: 4 * ResourceScale},
		GoldCostBasis:     2 * GoldScale,
		EffectSummary:     "克弓兵 1.15x",
	},
	{
		RecipeCode:        "craft_archer_kit",
		Name:              "长弓兵军备",
		Category:          "armament",
		ProfessionReq:     "all",
		ProfessionReqName: "通用",
		OutputKey:         ResArcherKit,
		OutputName:        "长弓兵军备",
		OutputAmountMilli: 2 * ResourceScale,
		CostsMilli:        map[string]int64{ResWood: 360 * ResourceScale, ResStone: 140 * ResourceScale, ResRation: 4 * ResourceScale},
		GoldCostBasis:     2 * GoldScale,
		EffectSummary:     "克骑兵 1.15x",
	},
	{
		RecipeCode:        "craft_cavalry_kit",
		Name:              "铁骑兵军备",
		Category:          "armament",
		ProfessionReq:     "all",
		ProfessionReqName: "通用",
		OutputKey:         ResCavalryKit,
		OutputName:        "铁骑兵军备",
		OutputAmountMilli: 2 * ResourceScale,
		CostsMilli:        map[string]int64{ResWater: 300 * ResourceScale, ResIronIngot: 4 * ResourceScale, ResRation: 6 * ResourceScale},
		GoldCostBasis:     3 * GoldScale,
		EffectSummary:     "克步兵 1.15x",
	},
}

// EquipmentCatalog defines cross-profession workshop equipments and their declarative per-stack modifiers.
var EquipmentCatalog = []EquipmentSpec{
	{
		ItemKey:      ResAutoPump,
		Name:         "自动抽水机",
		MaxStack:     5,
		BonusSummary: "打水/伐木 +15%/台",
		JobEfficiencyPerStack: map[string]int64{
			JobWater: 15,
			JobWood:  15,
		},
	},
	{
		ItemKey:      ResAlchCatalyst,
		Name:         "赫尔墨斯催化剂",
		MaxStack:     5,
		BonusSummary: "全岗位 +12%/瓶",
		JobEfficiencyPerStack: map[string]int64{
			JobWater:      12,
			JobWood:       12,
			JobCharcoal:   12,
			JobStone:      12,
			JobSmeltIron:  12,
			JobPrepRation: 12,
		},
	},
	{
		ItemKey:      ResEnchantScroll,
		Name:         "星界附魔卷轴",
		MaxStack:     5,
		BonusSummary: "采石/军粮 +15%/卷",
		JobEfficiencyPerStack: map[string]int64{
			JobStone:      15,
			JobPrepRation: 15,
		},
	},
	{
		ItemKey:      ResHeavyToolset,
		Name:         "泰坦精锻工具组",
		MaxStack:     5,
		BonusSummary: "伐木/炼铁 +15%/套",
		JobEfficiencyPerStack: map[string]int64{
			JobWood:      15,
			JobCharcoal:  15,
			JobSmeltIron: 15,
		},
	},
}

// DefaultGuilds returns the initial NPC/Demo guild roster for the Chamber War.
func DefaultGuilds() []GuildState {
	return []GuildState{
		{
			GuildID:           "guild_obsidian_vanguard",
			Name:              "墨械先驱团",
			Tag:               "INK",
			Faction:           GuildObsidian,
			LeaderHandle:      "archon_demo",
			Level:             3,
			XP:                420,
			TreasuryGoldBasis: 650 * GoldScale,
			RallyNodeID:       "node_north_fort",
			Announcement:      "以水力与黑曜齿轮构筑西线铁壁，优先集结北侧据点！",
			Members: []GuildMember{
				{Handle: "archon_demo", Role: "会长", Contribution: 680, WarDeployed: 28},
				{Handle: "墨匠·玄枢", Role: "副会长", Contribution: 420, WarDeployed: 18},
				{Handle: "铁砧·墨衡", Role: "精锐", Contribution: 260, WarDeployed: 12},
			},
		},
		{
			GuildID:           "guild_obsidian_iron",
			Name:              "黑曜铁卫公会",
			Tag:               "IRON",
			Faction:           GuildObsidian,
			LeaderHandle:      "重甲督军·岩罡",
			Level:             2,
			XP:                260,
			TreasuryGoldBasis: 320 * GoldScale,
			RallyNodeID:       "node_south_ferry",
			Announcement:      "专司南线渡口重步兵攻坚，欢迎巨匠与炼金师加盟。",
			Members: []GuildMember{
				{Handle: "重甲督军·岩罡", Role: "会长", Contribution: 450, WarDeployed: 22},
				{Handle: "燧火·赤锤", Role: "精锐", Contribution: 190, WarDeployed: 10},
			},
		},
		{
			GuildID:           "guild_argent_astral",
			Name:              "白银星界议会",
			Tag:               "ASTR",
			Faction:           GuildArgent,
			LeaderHandle:      "星轨大导师·凛月",
			Level:             3,
			XP:                410,
			TreasuryGoldBasis: 600 * GoldScale,
			RallyNodeID:       "node_east_fort",
			Announcement:      "星盘所指即为白银疆域，协同夺取东侧据点与中央宝藏城。",
			Members: []GuildMember{
				{Handle: "星轨大导师·凛月", Role: "会长", Contribution: 640, WarDeployed: 26},
				{Handle: "银羽·星河", Role: "精锐", Contribution: 290, WarDeployed: 14},
			},
		},
		{
			GuildID:           "guild_argent_hermes",
			Name:              "赫尔墨斯炼金会",
			Tag:               "ALCH",
			Faction:           GuildArgent,
			LeaderHandle:      "翠玉炼金师·维克",
			Level:             2,
			XP:                240,
			TreasuryGoldBasis: 280 * GoldScale,
			RallyNodeID:       "node_center_vault",
			Announcement:      "海量催化剂与附魔卷轴后勤支援，直插中央宝藏城。",
			Members: []GuildMember{
				{Handle: "翠玉炼金师·维克", Role: "会长", Contribution: 410, WarDeployed: 18},
				{Handle: "白银之翼", Role: "成员", Contribution: 150, WarDeployed: 8},
			},
		},
	}
}

// DefaultWarNodes returns the 8-node graph topology and initial garrisons for the Chamber War.
func DefaultWarNodes() []WarNodeState {
	return []WarNodeState{
		{
			NodeID:          "node_west_base",
			Name:            "曜石大本营",
			Region:          "west",
			X:               90,
			Y:               210,
			OwnerGuild:      GuildObsidian,
			DefenseBonusPct: 25,
			DailyScore:      15,
			IsTreasureVault: false,
			ObsidianTroops:  Troops{Infantry: 18, Archer: 14, Cavalry: 12},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "黑曜大本营",
		},
		{
			NodeID:          "node_west_outpost",
			Name:            "西境前哨",
			Region:          "west",
			X:               260,
			Y:               210,
			OwnerGuild:      GuildObsidian,
			DefenseBonusPct: 25,
			DailyScore:      20,
			IsTreasureVault: false,
			ObsidianTroops:  Troops{Infantry: 12, Archer: 10, Cavalry: 8},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "西线咽喉",
		},
		{
			NodeID:          "node_north_fort",
			Name:            "北侧据点",
			Region:          "north",
			X:               430,
			Y:               95,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 8, Archer: 6, Cavalry: 4},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "北线高地",
		},
		{
			NodeID:          "node_south_ferry",
			Name:            "南侧渡口",
			Region:          "south",
			X:               500,
			Y:               325,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 5, Archer: 10, Cavalry: 4},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "南线水路",
		},
		{
			NodeID:          "node_center_vault",
			Name:            "中央宝藏城 ★",
			Region:          "center",
			X:               530,
			Y:               200,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      60,
			IsTreasureVault: true,
			NeutralGarrison: Troops{Infantry: 14, Archer: 14, Cavalry: 14},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "核心要塞",
		},
		{
			NodeID:          "node_east_fort",
			Name:            "东侧据点",
			Region:          "east",
			X:               660,
			Y:               95,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 6, Archer: 6, Cavalry: 9},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "东境要塞",
		},
		{
			NodeID:          "node_east_outpost",
			Name:            "东境前哨",
			Region:          "east",
			X:               760,
			Y:               210,
			OwnerGuild:      GuildArgent,
			DefenseBonusPct: 25,
			DailyScore:      20,
			IsTreasureVault: false,
			ArgentTroops:    Troops{Infantry: 12, Archer: 10, Cavalry: 8},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "东线枢纽",
		},
		{
			NodeID:          "node_east_base",
			Name:            "白银大本营",
			Region:          "east",
			X:               910,
			Y:               210,
			OwnerGuild:      GuildArgent,
			DefenseBonusPct: 25,
			DailyScore:      15,
			IsTreasureVault: false,
			ArgentTroops:    Troops{Infantry: 18, Archer: 14, Cavalry: 12},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "白银大本营",
		},
	}
}

// DefaultWarEdges returns the supply-line edges connecting the 8 Chamber War nodes.
func DefaultWarEdges() []WarEdge {
	return []WarEdge{
		{FromNode: "node_west_base", ToNode: "node_west_outpost"},
		{FromNode: "node_west_outpost", ToNode: "node_north_fort"},
		{FromNode: "node_west_outpost", ToNode: "node_south_ferry"},
		{FromNode: "node_north_fort", ToNode: "node_south_ferry"},
		{FromNode: "node_north_fort", ToNode: "node_center_vault"},
		{FromNode: "node_south_ferry", ToNode: "node_center_vault"},
		{FromNode: "node_center_vault", ToNode: "node_east_fort"},
		{FromNode: "node_south_ferry", ToNode: "node_east_outpost"},
		{FromNode: "node_east_fort", ToNode: "node_east_outpost"},
		{FromNode: "node_east_outpost", ToNode: "node_east_base"},
	}
}

// WarDailyNPCReinforcements defines daily NPC vanguard reinforcements per node before 20:00 settlement.
var WarDailyNPCReinforcements = map[string]struct {
	Obsidian Troops
	Argent   Troops
}{
	"node_north_fort": {
		Obsidian: Troops{Cavalry: 4},
		Argent:   Troops{Archer: 3},
	},
	"node_south_ferry": {
		Obsidian: Troops{Infantry: 4},
		Argent:   Troops{Cavalry: 4},
	},
	"node_center_vault": {
		Obsidian: Troops{Infantry: 5, Archer: 4},
		Argent:   Troops{Infantry: 4, Cavalry: 5},
	},
	"node_east_fort": {
		Argent: Troops{Archer: 5},
	},
}
