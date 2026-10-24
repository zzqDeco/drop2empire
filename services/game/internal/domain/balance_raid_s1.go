package domain

// RaidBalance centralizes all numerical parameters for the 2D Wasteland Extraction Roguelite.
var RaidBalance = struct {
	BaseMaxHP              int32
	BaseAtk                int32
	BaseDef                int32
	BaseMoveCooldownMs     int32
	MinMoveCooldownMs      int32
	GalePotionCooldownMs   int32
	MaxBuffSpeedPct        int32
	BaseDurationSec        int32
	BaseBackpackCap        int32
	BaseSafeSlots          int32
	VisionRadius           int32
	MaxEquippedBuffCards   int
	MaxEquippedPotions     int
	MoveCooldownJitterPct  int32 // 65% server tolerance for network jitter on step intervals

	// Oasis & Caravan parameters:
	OasisHealHP            int32
	OasisBonusSec          int32
	CaravanHealHP          int32
	CaravanBonusSec        int32

	// Potion numerical effects:
	PotionHealSalveHP      int32
	PotionGaleDurationSec  int32
	PotionScavDurationSec  int32
	PotionScavBonusSec     int32
	PotionBerserkAtkBonus  int32
	PotionBerserkDefBonus  int32
}{
	BaseMaxHP:             100,
	BaseAtk:               12,
	BaseDef:               2,
	BaseMoveCooldownMs:    360,
	MinMoveCooldownMs:     110,
	GalePotionCooldownMs:  105,
	MaxBuffSpeedPct:       45,
	BaseDurationSec:       180,
	BaseBackpackCap:       6,
	BaseSafeSlots:         1,
	VisionRadius:          2,
	MaxEquippedBuffCards:  4,
	MaxEquippedPotions:    3,
	MoveCooldownJitterPct: 50,

	OasisHealHP:     45,
	OasisBonusSec:   25,
	CaravanHealHP:   65,
	CaravanBonusSec: 30,

	PotionHealSalveHP:     65,
	PotionGaleDurationSec: 35,
	PotionScavDurationSec: 45,
	PotionScavBonusSec:    15,
	PotionBerserkAtkBonus: 25,
	PotionBerserkDefBonus: 12,
}

// RaidChannelDurationMs maps tile kinds to their base channeling duration in milliseconds.
var RaidChannelDurationMs = map[string]int32{
	"chest_wood":    1100,
	"chest_iron":    2200,
	"chest_coffin":  3600,
	"chest_abyss":   5400,
	"extract_early": 2800,
	"extract_deep":  2800,
}

// RaidEnemySpec defines a monster archetype in the 2D Wasteland Raid.
type RaidEnemySpec struct {
	Kind  string
	Name  string
	MaxHP int32
	Atk   int32
}

var RaidEnemyCatalog = map[string]RaidEnemySpec{
	"raider": {Kind: "enemy_raider", Name: "荒原劫掠者", MaxHP: 38, Atk: 9},
	"hunter": {Kind: "enemy_raider", Name: "迷林猎手", MaxHP: 52, Atk: 12},
	"worm":   {Kind: "enemy_worm", Name: "岩甲沙虫", MaxHP: 65, Atk: 14},
	"golem":  {Kind: "enemy_worm", Name: "黑曜巡逻傀儡", MaxHP: 78, Atk: 16},
	"boss":   {Kind: "enemy_boss", Name: "★墨械圣殿重装巨像", MaxHP: 135, Atk: 22},
}

// RaidLootCatalogMeta defines metadata for every item that can drop inside a 2D Raid.
var RaidLootCatalogMeta = map[string]RaidLootItem{
	ResFlint:            {Key: ResFlint, Name: "燧石结晶", Rarity: "COMMON", Category: "material"},
	ResAncientShard:     {Key: ResAncientShard, Name: "古文明残片", Rarity: "RARE", Category: "material"},
	ResMeteorOre:        {Key: ResMeteorOre, Name: "天外陨铁", Rarity: "EPIC", Category: "material"},
	ResBPCrossbow:       {Key: ResBPCrossbow, Name: "★图纸：墨械连发手弩", Rarity: "RARE", Category: "blueprint"},
	ResBPCarapaceArmor:  {Key: ResBPCarapaceArmor, Name: "★图纸：荒原沙虫甲", Rarity: "RARE", Category: "blueprint"},
	ResBPSpringBoots:    {Key: ResBPSpringBoots, Name: "★图纸：墨械弹簧战靴", Rarity: "RARE", Category: "blueprint"},
	ResBPCipherSafe:     {Key: ResBPCipherSafe, Name: "★图纸：墨械密码保险箱(3格)", Rarity: "RARE", Category: "blueprint"},
	ResBPScavengeElixir: {Key: ResBPScavengeElixir, Name: "★图纸：巧手速搜合剂", Rarity: "RARE", Category: "blueprint"},
	ResBPTitanHammer:    {Key: ResBPTitanHammer, Name: "★★图纸：泰坦裂地重锤", Rarity: "EPIC", Category: "blueprint"},
	ResBPHydroArmor:     {Key: ResBPHydroArmor, Name: "★★图纸：阿基米德重装", Rarity: "EPIC", Category: "blueprint"},
	ResBPHermesBoots:    {Key: ResBPHermesBoots, Name: "★★图纸：赫尔墨斯风行羽靴", Rarity: "EPIC", Category: "blueprint"},
	ResBPAetherSafe:     {Key: ResBPAetherSafe, Name: "★★图纸：星界相位保险箱(5格)", Rarity: "EPIC", Category: "blueprint"},
	ResBPBerserkElixir:  {Key: ResBPBerserkElixir, Name: "★★图纸：泰坦狂暴圣水", Rarity: "EPIC", Category: "blueprint"},
	ResCosGoggles:       {Key: ResCosGoggles, Name: "外观：荒原防风护目镜", Rarity: "RARE", Category: "cosmetic"},
	ResCosSandCloak:     {Key: ResCosSandCloak, Name: "外观：沙行旅人斗篷", Rarity: "RARE", Category: "cosmetic"},
	ResCosCompass:       {Key: ResCosCompass, Name: "外观：寻脉青铜罗盘", Rarity: "RARE", Category: "cosmetic"},
	ResCosWoodFrog:      {Key: ResCosWoodFrog, Name: "外观：汲水发条木蛙", Rarity: "RARE", Category: "cosmetic"},
	ResCosSteamCrown:    {Key: ResCosSteamCrown, Name: "外观：墨械蒸汽齿轮冠", Rarity: "EPIC", Category: "cosmetic"},
	ResCosHydroWings:    {Key: ResCosHydroWings, Name: "外观：阿基米德水翼背甲", Rarity: "EPIC", Category: "cosmetic"},
	ResCosAlchLantern:   {Key: ResCosAlchLantern, Name: "外观：赫尔墨斯荧光提灯", Rarity: "EPIC", Category: "cosmetic"},
	ResCosMechOwl:       {Key: ResCosMechOwl, Name: "外观：炼金机械猫头鹰", Rarity: "EPIC", Category: "cosmetic"},
	ResCosObsidianCrown: {Key: ResCosObsidianCrown, Name: "★S1传世：曜石星辉王冠", Rarity: "LEGENDARY", Category: "cosmetic"},
	ResCosAstralWings:   {Key: ResCosAstralWings, Name: "★S1传世：星界流光羽翼", Rarity: "LEGENDARY", Category: "cosmetic"},
	ResCosThunderStaff:  {Key: ResCosThunderStaff, Name: "★S1传世：泰坦雷鸣权杖", Rarity: "LEGENDARY", Category: "cosmetic"},
	ResCosAetherDrake:   {Key: ResCosAetherDrake, Name: "★S1传世：星界以太幼龙", Rarity: "LEGENDARY", Category: "cosmetic"},
}

var (
	RaidTier2Blueprints = []string{
		ResBPCrossbow,
		ResBPCarapaceArmor,
		ResBPSpringBoots,
		ResBPCipherSafe,
		ResBPScavengeElixir,
	}
	RaidTier3Blueprints = []string{
		ResBPTitanHammer,
		ResBPHydroArmor,
		ResBPHermesBoots,
		ResBPAetherSafe,
		ResBPBerserkElixir,
	}
	RaidRareCosmetics = []string{
		ResCosGoggles,
		ResCosSandCloak,
		ResCosCompass,
		ResCosWoodFrog,
	}
	RaidEpicCosmetics = []string{
		ResCosSteamCrown,
		ResCosHydroWings,
		ResCosAlchLantern,
		ResCosMechOwl,
	}
	RaidLegendaryCosmetics = []string{
		ResCosObsidianCrown,
		ResCosAstralWings,
		ResCosThunderStaff,
		ResCosAetherDrake,
	}
)

var RaidRerollCostsMilli = map[string]int64{
	ResWater: 240 * ResourceScale,
	ResWood:  150 * ResourceScale,
}

// RaidBuffCardCatalog defines 54 distinct Pre-Departure Roguelite Buff Cards across 6 tactical categories.
var RaidBuffCardCatalog = []RaidBuffCardSpec{
	// ==================== Category 1: Time & Endurance (时限与续航系 · 9 cards) ====================
	{CardCode: "buff_time_01", Name: "牛皮大水囊", Category: "time", Rarity: "COMMON", EffectSummary: "本局沙暴降临倒计时 +20 秒", CostsMilli: map[string]int64{ResWater: 260 * ResourceScale}, DurationBonus: 20},
	{CardCode: "buff_time_02", Name: "风干行军粮", Category: "time", Rarity: "COMMON", EffectSummary: "本局沙暴降临倒计时 +25 秒", CostsMilli: map[string]int64{ResWater: 210 * ResourceScale, ResWood: 180 * ResourceScale}, DurationBonus: 25},
	{CardCode: "buff_time_03", Name: "双层隔热壶", Category: "time", Rarity: "COMMON", EffectSummary: "本局倒计时 +30 秒，初始生命 +10", CostsMilli: map[string]int64{ResWater: 320 * ResourceScale, ResStone: 140 * ResourceScale}, DurationBonus: 30, HpBonus: 10},
	{CardCode: "buff_time_04", Name: "荒原绿洲图", Category: "time", Rarity: "RARE", EffectSummary: "本局倒计时 +40 秒", CostsMilli: map[string]int64{ResWater: 480 * ResourceScale, ResWood: 280 * ResourceScale}, DurationBonus: 40},
	{CardCode: "buff_time_05", Name: "骆驼队补给箱", Category: "time", Rarity: "RARE", EffectSummary: "本局倒计时 +45 秒，背囊 +1 格", CostsMilli: map[string]int64{ResWater: 540 * ResourceScale, ResWood: 340 * ResourceScale}, DurationBonus: 45, BagBonus: 1},
	{CardCode: "buff_time_06", Name: "冷凝集水罩", Category: "time", Rarity: "RARE", EffectSummary: "本局倒计时 +35 秒，移速加快 8%", CostsMilli: map[string]int64{ResWater: 460 * ResourceScale, ResCharcoal: 120 * ResourceScale}, DurationBonus: 35, MoveSpeedPct: 8},
	{CardCode: "buff_time_07", Name: "定风石锚", Category: "time", Rarity: "EPIC", EffectSummary: "强行延缓沙暴：本局倒计时 +65 秒", CostsMilli: map[string]int64{ResWater: 920 * ResourceScale, ResStone: 560 * ResourceScale, ResFlint: 5 * ResourceScale}, DurationBonus: 65},
	{CardCode: "buff_time_08", Name: "时计发条匣", Category: "time", Rarity: "EPIC", EffectSummary: "本局倒计时 +55 秒，移动间隔缩短 12%", CostsMilli: map[string]int64{ResWater: 820 * ResourceScale, ResCharcoal: 240 * ResourceScale, ResFlint: 5 * ResourceScale}, DurationBonus: 55, MoveSpeedPct: 12},
	{CardCode: "buff_time_09", Name: "永昼火种灯", Category: "time", Rarity: "EPIC", EffectSummary: "本局倒计时 +75 秒，生命上限 +25", CostsMilli: map[string]int64{ResWater: 1080 * ResourceScale, ResCharcoal: 310 * ResourceScale, ResFlint: 7 * ResourceScale}, DurationBonus: 75, HpBonus: 25},

	// ==================== Category 2: Vision & Recon (视野与侦察系 · 9 cards) ====================
	{CardCode: "buff_vis_01", Name: "松脂高明火把", Category: "vision", Rarity: "COMMON", EffectSummary: "战争迷雾视野 +1 格，攻击 +3", CostsMilli: map[string]int64{ResWood: 250 * ResourceScale, ResCharcoal: 65 * ResourceScale}, AtkBonus: 3},
	{CardCode: "buff_vis_02", Name: "单筒铜望远镜", Category: "vision", Rarity: "COMMON", EffectSummary: "迷雾视野 +1 格，倒计时 +15 秒", CostsMilli: map[string]int64{ResWood: 230 * ResourceScale, ResStone: 150 * ResourceScale}, DurationBonus: 15},
	{CardCode: "buff_vis_03", Name: "斥候风向标", Category: "vision", Rarity: "COMMON", EffectSummary: "移速加快 10%，更容易定位区块传送门", CostsMilli: map[string]int64{ResWood: 290 * ResourceScale}, MoveSpeedPct: 10},
	{CardCode: "buff_vis_04", Name: "信标谐振器", Category: "vision", Rarity: "RARE", EffectSummary: "开局自动破译撤离点方位，倒计时 +25 秒", CostsMilli: map[string]int64{ResStone: 360 * ResourceScale, ResCharcoal: 140 * ResourceScale}, DurationBonus: 25},
	{CardCode: "buff_vis_05", Name: "商队铜驼铃", Category: "vision", Rarity: "RARE", EffectSummary: "感知游商营帐气息，背囊容量 +2 格", CostsMilli: map[string]int64{ResWood: 450 * ResourceScale, ResFlint: 3 * ResourceScale}, BagBonus: 2},
	{CardCode: "buff_vis_06", Name: "夜视石英镜", Category: "vision", Rarity: "RARE", EffectSummary: "迷雾视野扩大，移速加快 12%，攻击 +5", CostsMilli: map[string]int64{ResStone: 410 * ResourceScale, ResFlint: 3 * ResourceScale}, MoveSpeedPct: 12, AtkBonus: 5},
	{CardCode: "buff_vis_07", Name: "星象测绘仪", Category: "vision", Rarity: "EPIC", EffectSummary: "全图传送门感应，倒计时 +45 秒，移速 +15%", CostsMilli: map[string]int64{ResWood: 780 * ResourceScale, ResStone: 620 * ResourceScale, ResFlint: 6 * ResourceScale}, DurationBonus: 45, MoveSpeedPct: 15},
	{CardCode: "buff_vis_08", Name: "地脉听音筒", Category: "vision", Rarity: "EPIC", EffectSummary: "精确定位深渊石棺，背囊 +3 格，护甲 +5", CostsMilli: map[string]int64{ResStone: 740 * ResourceScale, ResCharcoal: 260 * ResourceScale, ResFlint: 5 * ResourceScale}, BagBonus: 3, DefBonus: 5},
	{CardCode: "buff_vis_09", Name: "全息墨械目镜", Category: "vision", Rarity: "EPIC", EffectSummary: "视野最大化，攻击 +10，移速 +15%", CostsMilli: map[string]int64{ResCharcoal: 320 * ResourceScale, ResStone: 680 * ResourceScale, ResFlint: 7 * ResourceScale}, AtkBonus: 10, MoveSpeedPct: 15},

	// ==================== Category 3: Scavenge & Backpack (极速摸金与背囊系 · 9 cards) ====================
	{CardCode: "buff_scav_01", Name: "亚麻副背袋", Category: "scavenge", Rarity: "COMMON", EffectSummary: "本局背囊容量 +2 格", CostsMilli: map[string]int64{ResWater: 240 * ResourceScale, ResWood: 240 * ResourceScale}, BagBonus: 2},
	{CardCode: "buff_scav_02", Name: "铁齿撬棍", Category: "scavenge", Rarity: "COMMON", EffectSummary: "开箱读条加快，背囊 +1 格，攻击 +4", CostsMilli: map[string]int64{ResWood: 210 * ResourceScale, ResStone: 210 * ResourceScale}, BagBonus: 1, AtkBonus: 4},
	{CardCode: "buff_scav_03", Name: "考古毛刷组", Category: "scavenge", Rarity: "COMMON", EffectSummary: "背囊 +2 格，探索倒计时 +15 秒", CostsMilli: map[string]int64{ResWood: 280 * ResourceScale, ResWater: 210 * ResourceScale}, BagBonus: 2, DurationBonus: 15},
	{CardCode: "buff_scav_04", Name: "精钢万能锁针", Category: "scavenge", Rarity: "RARE", EffectSummary: "背囊 +3 格，开启机关石棺速度提升", CostsMilli: map[string]int64{ResStone: 420 * ResourceScale, ResCharcoal: 150 * ResourceScale}, BagBonus: 3},
	{CardCode: "buff_scav_05", Name: "双峰驼马鞍袋", Category: "scavenge", Rarity: "RARE", EffectSummary: "本局背囊容量大幅扩充 +4 格", CostsMilli: map[string]int64{ResWater: 520 * ResourceScale, ResWood: 520 * ResourceScale}, BagBonus: 4},
	{CardCode: "buff_scav_06", Name: "润滑齿轮油", Category: "scavenge", Rarity: "RARE", EffectSummary: "背囊 +2 格，移速加快 12%，倒计时 +20 秒", CostsMilli: map[string]int64{ResWater: 420 * ResourceScale, ResCharcoal: 170 * ResourceScale}, BagBonus: 2, MoveSpeedPct: 12, DurationBonus: 20},
	{CardCode: "buff_scav_07", Name: "墨械外骨骼背架", Category: "scavenge", Rarity: "EPIC", EffectSummary: "背囊容量 +5 格，移动间隔缩短 10%", CostsMilli: map[string]int64{ResWood: 860 * ResourceScale, ResStone: 680 * ResourceScale, ResFlint: 6 * ResourceScale}, BagBonus: 5, MoveSpeedPct: 10},
	{CardCode: "buff_scav_08", Name: "探宝液压钳", Category: "scavenge", Rarity: "EPIC", EffectSummary: "背囊 +4 格，攻击 +8，护甲 +4", CostsMilli: map[string]int64{ResStone: 820 * ResourceScale, ResCharcoal: 280 * ResourceScale, ResFlint: 6 * ResourceScale}, BagBonus: 4, AtkBonus: 8, DefBonus: 4},
	{CardCode: "buff_scav_09", Name: "次元折叠行囊", Category: "scavenge", Rarity: "EPIC", EffectSummary: "本局背囊容量 +6 格，倒计时 +30 秒", CostsMilli: map[string]int64{ResWater: 960 * ResourceScale, ResWood: 820 * ResourceScale, ResFlint: 8 * ResourceScale}, BagBonus: 6, DurationBonus: 30},

	// ==================== Category 4: Offense & Firepower (近战与火力系 · 9 cards) ====================
	{CardCode: "buff_atk_01", Name: "磨刃粗砺石", Category: "offense", Rarity: "COMMON", EffectSummary: "本局斥候攻击力 +6", CostsMilli: map[string]int64{ResStone: 250 * ResourceScale}, AtkBonus: 6},
	{CardCode: "buff_atk_02", Name: "黑曜石箭簇", Category: "offense", Rarity: "COMMON", EffectSummary: "本局攻击力 +8", CostsMilli: map[string]int64{ResWood: 210 * ResourceScale, ResStone: 220 * ResourceScale}, AtkBonus: 8},
	{CardCode: "buff_atk_03", Name: "淬火木炭粉", Category: "offense", Rarity: "COMMON", EffectSummary: "本局攻击力 +7，生命 +15", CostsMilli: map[string]int64{ResCharcoal: 95 * ResourceScale, ResWater: 210 * ResourceScale}, AtkBonus: 7, HpBonus: 15},
	{CardCode: "buff_atk_04", Name: "倒刺猎人网", Category: "offense", Rarity: "RARE", EffectSummary: "本局攻击力 +12，护甲 +3", CostsMilli: map[string]int64{ResWood: 440 * ResourceScale, ResStone: 330 * ResourceScale}, AtkBonus: 12, DefBonus: 3},
	{CardCode: "buff_atk_05", Name: "赤铁破甲锥", Category: "offense", Rarity: "RARE", EffectSummary: "本局攻击力 +15", CostsMilli: map[string]int64{ResStone: 490 * ResourceScale, ResCharcoal: 160 * ResourceScale}, AtkBonus: 15},
	{CardCode: "buff_atk_06", Name: "狂沙战鼓", Category: "offense", Rarity: "RARE", EffectSummary: "本局攻击力 +11，移速加快 10%", CostsMilli: map[string]int64{ResWood: 460 * ResourceScale, ResCharcoal: 140 * ResourceScale}, AtkBonus: 11, MoveSpeedPct: 10},
	{CardCode: "buff_atk_07", Name: "黑火药爆破筒", Category: "offense", Rarity: "EPIC", EffectSummary: "对精英首领重创：本局攻击力 +22", CostsMilli: map[string]int64{ResCharcoal: 320 * ResourceScale, ResStone: 640 * ResourceScale, ResFlint: 6 * ResourceScale}, AtkBonus: 22},
	{CardCode: "buff_atk_08", Name: "泰坦高压刃膏", Category: "offense", Rarity: "EPIC", EffectSummary: "本局攻击力 +19，生命 +35", CostsMilli: map[string]int64{ResWater: 760 * ResourceScale, ResCharcoal: 270 * ResourceScale, ResFlint: 6 * ResourceScale}, AtkBonus: 19, HpBonus: 35},
	{CardCode: "buff_atk_09", Name: "赫尔墨斯雷火剂", Category: "offense", Rarity: "EPIC", EffectSummary: "本局攻击力 +26，移速加快 8%", CostsMilli: map[string]int64{ResCharcoal: 360 * ResourceScale, ResStone: 720 * ResourceScale, ResFlint: 8 * ResourceScale}, AtkBonus: 26, MoveSpeedPct: 8},

	// ==================== Category 5: Defense & Survival (护甲与生存系 · 9 cards) ====================
	{CardCode: "buff_def_01", Name: "榆木护腕", Category: "defense", Rarity: "COMMON", EffectSummary: "本局护甲 +4，生命 +20", CostsMilli: map[string]int64{ResWood: 270 * ResourceScale}, DefBonus: 4, HpBonus: 20},
	{CardCode: "buff_def_02", Name: "止血草药膏", Category: "defense", Rarity: "COMMON", EffectSummary: "本局生命上限 +40", CostsMilli: map[string]int64{ResWater: 310 * ResourceScale, ResWood: 160 * ResourceScale}, HpBonus: 40},
	{CardCode: "buff_def_03", Name: "石片护心镜", Category: "defense", Rarity: "COMMON", EffectSummary: "本局护甲 +6，生命 +15", CostsMilli: map[string]int64{ResStone: 260 * ResourceScale}, DefBonus: 6, HpBonus: 15},
	{CardCode: "buff_def_04", Name: "防沙呼吸面罩", Category: "defense", Rarity: "RARE", EffectSummary: "本局生命 +55，倒计时 +20 秒", CostsMilli: map[string]int64{ResWater: 490 * ResourceScale, ResWood: 340 * ResourceScale}, HpBonus: 55, DurationBonus: 20},
	{CardCode: "buff_def_05", Name: "重型铆钉肩甲", Category: "defense", Rarity: "RARE", EffectSummary: "本局护甲 +10，生命 +35", CostsMilli: map[string]int64{ResStone: 520 * ResourceScale, ResWood: 290 * ResourceScale}, DefBonus: 10, HpBonus: 35},
	{CardCode: "buff_def_06", Name: "甘露急救囊", Category: "defense", Rarity: "RARE", EffectSummary: "本局生命 +75，护甲 +4", CostsMilli: map[string]int64{ResWater: 680 * ResourceScale, ResCharcoal: 120 * ResourceScale}, HpBonus: 75, DefBonus: 4},
	{CardCode: "buff_def_07", Name: "黑曜石圣盾符", Category: "defense", Rarity: "EPIC", EffectSummary: "本局护甲 +16，生命 +60", CostsMilli: map[string]int64{ResStone: 880 * ResourceScale, ResCharcoal: 250 * ResourceScale, ResFlint: 6 * ResourceScale}, DefBonus: 16, HpBonus: 60},
	{CardCode: "buff_def_08", Name: "不屈生命图腾", Category: "defense", Rarity: "EPIC", EffectSummary: "本局生命上限 +120，护甲 +8", CostsMilli: map[string]int64{ResWater: 1120 * ResourceScale, ResWood: 660 * ResourceScale, ResFlint: 6 * ResourceScale}, HpBonus: 120, DefBonus: 8},
	{CardCode: "buff_def_09", Name: "泰坦壁垒核心", Category: "defense", Rarity: "EPIC", EffectSummary: "本局护甲 +20，生命 +80，攻击 +6", CostsMilli: map[string]int64{ResStone: 980 * ResourceScale, ResCharcoal: 310 * ResourceScale, ResFlint: 8 * ResourceScale}, DefBonus: 20, HpBonus: 80, AtkBonus: 6},

	// ==================== Category 6: Tactical & Mobility (特种战术与机动系 · 9 cards) ====================
	{CardCode: "buff_tac_01", Name: "沙地轻便绑腿", Category: "tactical", Rarity: "COMMON", EffectSummary: "本局移动冷却缩短 12%", CostsMilli: map[string]int64{ResWood: 240 * ResourceScale, ResWater: 180 * ResourceScale}, MoveSpeedPct: 12},
	{CardCode: "buff_tac_02", Name: "精钢抓钩索", Category: "tactical", Rarity: "COMMON", EffectSummary: "移动冷却缩短 10%，背囊 +1 格", CostsMilli: map[string]int64{ResWood: 220 * ResourceScale, ResStone: 180 * ResourceScale}, MoveSpeedPct: 10, BagBonus: 1},
	{CardCode: "buff_tac_03", Name: "迷雾烟幕丸", Category: "tactical", Rarity: "COMMON", EffectSummary: "护甲 +4，移动冷却缩短 8%，倒计时 +15 秒", CostsMilli: map[string]int64{ResCharcoal: 90 * ResourceScale, ResWater: 220 * ResourceScale}, DefBonus: 4, MoveSpeedPct: 8, DurationBonus: 15},
	{CardCode: "buff_tac_04", Name: "游商黑市金印", Category: "tactical", Rarity: "RARE", EffectSummary: "背囊 +2 格，生命 +30，攻击 +6", CostsMilli: map[string]int64{ResStone: 420 * ResourceScale, ResFlint: 3 * ResourceScale}, BagBonus: 2, HpBonus: 30, AtkBonus: 6},
	{CardCode: "buff_tac_05", Name: "风行滑翔翼", Category: "tactical", Rarity: "RARE", EffectSummary: "本局移动冷却大幅缩短 18%", CostsMilli: map[string]int64{ResWood: 550 * ResourceScale, ResCharcoal: 140 * ResourceScale}, MoveSpeedPct: 18},
	{CardCode: "buff_tac_06", Name: "撤离信标增幅器", Category: "tactical", Rarity: "RARE", EffectSummary: "倒计时 +30 秒，移动冷却缩短 12%，护甲 +5", CostsMilli: map[string]int64{ResWater: 520 * ResourceScale, ResStone: 350 * ResourceScale}, DurationBonus: 30, MoveSpeedPct: 12, DefBonus: 5},
	{CardCode: "buff_tac_07", Name: "墨械喷气推进包", Category: "tactical", Rarity: "EPIC", EffectSummary: "本局移动冷却缩短 24%，倒计时 +25 秒", CostsMilli: map[string]int64{ResCharcoal: 340 * ResourceScale, ResStone: 580 * ResourceScale, ResFlint: 6 * ResourceScale}, MoveSpeedPct: 24, DurationBonus: 25},
	{CardCode: "buff_tac_08", Name: "全能执政官行囊", Category: "tactical", Rarity: "EPIC", EffectSummary: "全属性强化：生命 +45、攻 +10、甲 +6、背囊 +2格", CostsMilli: map[string]int64{ResWater: 820 * ResourceScale, ResWood: 680 * ResourceScale, ResStone: 560 * ResourceScale, ResFlint: 6 * ResourceScale}, HpBonus: 45, AtkBonus: 10, DefBonus: 6, BagBonus: 2},
	{CardCode: "buff_tac_09", Name: "星界裂隙折跃仪", Category: "tactical", Rarity: "EPIC", EffectSummary: "移动冷却缩短 20%，倒计时 +40 秒，背囊 +3 格", CostsMilli: map[string]int64{ResWater: 920 * ResourceScale, ResCharcoal: 320 * ResourceScale, ResFlint: 8 * ResourceScale}, MoveSpeedPct: 20, DurationBonus: 40, BagBonus: 3},
}

// CosmeticCatalog defines Season 1 ("S1 · 黑曜复苏与墨械纪元") tradable animated Lord Avatar cosmetics.
var CosmeticCatalog = []CosmeticSpec{
	// Headgear (头饰)
	{
		ItemKey:      ResCosGoggles,
		Name:         "荒原防风护目镜",
		Slot:         "headgear",
		Rarity:       "RARE",
		SeasonTag:    "S1 · 荒原勘探",
		VisualEffect: "额前佩戴黄铜铆钉防沙风镜",
	},
	{
		ItemKey:      ResCosSteamCrown,
		Name:         "墨械蒸汽齿轮冠",
		Slot:         "headgear",
		Rarity:       "EPIC",
		SeasonTag:    "S1 · 墨械纪元",
		VisualEffect: "头顶双层精密齿轮持续啮合旋转",
	},
	{
		ItemKey:      ResCosObsidianCrown,
		Name:         "★S1·曜石星辉王冠",
		Slot:         "headgear",
		Rarity:       "LEGENDARY",
		SeasonTag:    "S1 · 赛季典藏限定",
		VisualEffect: "悬浮黑曜棱晶王冠 + 金色星芒粒子光环",
	},

	// Mantle (背饰)
	{
		ItemKey:      ResCosSandCloak,
		Name:         "沙行旅人斗篷",
		Slot:         "mantle",
		Rarity:       "RARE",
		SeasonTag:    "S1 · 荒原勘探",
		VisualEffect: "随步伐微摆的防沙斗篷",
	},
	{
		ItemKey:      ResCosHydroWings,
		Name:         "阿基米德水翼背甲",
		Slot:         "mantle",
		Rarity:       "EPIC",
		SeasonTag:    "S1 · 墨械纪元",
		VisualEffect: "背部高压水翼脉冲喷射蔚蓝水雾",
	},
	{
		ItemKey:      ResCosAstralWings,
		Name:         "★S1·星界流光羽翼",
		Slot:         "mantle",
		Rarity:       "LEGENDARY",
		SeasonTag:    "S1 · 赛季典藏限定",
		VisualEffect: "以太双翼动态呼吸扇动 + 星轨拖尾",
	},

	// HeldRelic (手持圣物)
	{
		ItemKey:      ResCosCompass,
		Name:         "寻脉青铜罗盘",
		Slot:         "held_relic",
		Rarity:       "RARE",
		SeasonTag:    "S1 · 荒原勘探",
		VisualEffect: "掌心托举指针微颤的古铜罗盘",
	},
	{
		ItemKey:      ResCosAlchLantern,
		Name:         "赫尔墨斯荧光提灯",
		Slot:         "held_relic",
		Rarity:       "EPIC",
		SeasonTag:    "S1 · 墨械纪元",
		VisualEffect: "琉璃提灯内翠绿炼金火苗持续跃动",
	},
	{
		ItemKey:      ResCosThunderStaff,
		Name:         "★S1·泰坦雷鸣权杖",
		Slot:         "held_relic",
		Rarity:       "LEGENDARY",
		SeasonTag:    "S1 · 赛季典藏限定",
		VisualEffect: "权杖顶端悬浮雷核 + 环绕跳跃电弧",
	},

	// Companion (随从萌宠)
	{
		ItemKey:      ResCosWoodFrog,
		Name:         "汲水发条木蛙",
		Slot:         "companion",
		Rarity:       "RARE",
		SeasonTag:    "S1 · 荒原勘探",
		VisualEffect: "脚边跟随上下蹦跳的发条木偶蛙",
	},
	{
		ItemKey:      ResCosMechOwl,
		Name:         "炼金机械猫头鹰",
		Slot:         "companion",
		Rarity:       "EPIC",
		SeasonTag:    "S1 · 墨械纪元",
		VisualEffect: "肩侧盘旋振翅并定时眨眼的黄铜夜枭",
	},
	{
		ItemKey:      ResCosAetherDrake,
		Name:         "★S1·星界以太幼龙",
		Slot:         "companion",
		Rarity:       "LEGENDARY",
		SeasonTag:    "S1 · 赛季典藏限定",
		VisualEffect: "环绕领主悬浮飞行并吐出星芒水泡的以太幼龙",
	},
}

// RaidGearCatalog defines Season 1 out-of-raid weapons, armors, boots, seasonal safe containers, and potions.
var RaidGearCatalog = []RaidGearSpec{
	// Weapons (武器)
	{
		ItemKey:       "gear_wood_spear",
		Name:          "削尖硬木矛",
		Category:      "weapon",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "攻击 +6 · 局内阵亡会损毁掉落",
		AtkBonus:      6,
		CostsMilli:    map[string]int64{ResWood: 320 * ResourceScale, ResWater: 260 * ResourceScale},
	},
	{
		ItemKey:       "gear_flint_bow",
		Name:          "燧石短猎弓",
		Category:      "weapon",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "攻击 +11 · 远距离先手 · 阵亡掉落",
		AtkBonus:      11,
		CostsMilli:    map[string]int64{ResWood: 520 * ResourceScale, ResStone: 280 * ResourceScale, ResFlint: 4 * ResourceScale},
	},
	{
		ItemKey:       "gear_repeat_crossbow",
		Name:          "墨械连发手弩",
		Category:      "weapon",
		Tier:          2,
		BlueprintKey:  ResBPCrossbow,
		BlueprintName: "★图纸：墨械连发手弩",
		StatSummary:   "攻击 +20 · 暴击率 +15% · 阵亡掉落",
		AtkBonus:      20,
		CostsMilli:    map[string]int64{ResWood: 1100 * ResourceScale, ResStone: 650 * ResourceScale, ResCharcoal: 240 * ResourceScale, ResFlint: 8 * ResourceScale},
	},
	{
		ItemKey:       "gear_titan_hammer",
		Name:          "泰坦裂地重锤",
		Category:      "weapon",
		Tier:          3,
		BlueprintKey:  ResBPTitanHammer,
		BlueprintName: "★★图纸：泰坦裂地重锤",
		StatSummary:   "攻击 +36 · 破甲重击首领 · 阵亡掉落",
		AtkBonus:      36,
		CostsMilli:    map[string]int64{ResStone: 1850 * ResourceScale, ResCharcoal: 580 * ResourceScale, ResFlint: 16 * ResourceScale, ResAncientShard: 3 * ResourceScale},
	},

	// Armors (护甲)
	{
		ItemKey:       "gear_linen_vest",
		Name:          "粗麻防沙衣",
		Category:      "armor",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "生命 +30 · 护甲 +3 · 阵亡掉落",
		HpBonus:       30,
		DefBonus:      3,
		CostsMilli:    map[string]int64{ResWater: 380 * ResourceScale, ResWood: 280 * ResourceScale},
	},
	{
		ItemKey:       "gear_splint_mail",
		Name:          "硬化木片甲",
		Category:      "armor",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "生命 +55 · 护甲 +6 · 阵亡掉落",
		HpBonus:       55,
		DefBonus:      6,
		CostsMilli:    map[string]int64{ResWood: 640 * ResourceScale, ResStone: 360 * ResourceScale, ResCharcoal: 90 * ResourceScale},
	},
	{
		ItemKey:       "gear_carapace_armor",
		Name:          "岩甲沙虫壳胸甲",
		Category:      "armor",
		Tier:          2,
		BlueprintKey:  ResBPCarapaceArmor,
		BlueprintName: "★图纸：沙虫壳胸甲",
		StatSummary:   "生命 +100 · 护甲 +13 · 阵亡掉落",
		HpBonus:       100,
		DefBonus:      13,
		CostsMilli:    map[string]int64{ResStone: 1200 * ResourceScale, ResWood: 750 * ResourceScale, ResCharcoal: 260 * ResourceScale, ResFlint: 8 * ResourceScale},
	},
	{
		ItemKey:       "gear_hydro_armor",
		Name:          "阿基米德水压动力甲",
		Category:      "armor",
		Tier:          3,
		BlueprintKey:  ResBPHydroArmor,
		BlueprintName: "★★图纸：水压动力重甲",
		StatSummary:   "生命 +180 · 护甲 +24 · 背囊 +3格 · 阵亡掉落",
		HpBonus:       180,
		DefBonus:      24,
		BagBonus:      3,
		CostsMilli:    map[string]int64{ResWater: 2800 * ResourceScale, ResStone: 1950 * ResourceScale, ResCharcoal: 580 * ResourceScale, ResFlint: 18 * ResourceScale, ResMeteorOre: 2 * ResourceScale},
	},

	// Boots (战靴 — 控制 2D 地图移动冷却间隔)
	{
		ItemKey:        "gear_straw_sandals",
		Name:           "草编轻便履",
		Category:       "boots",
		Tier:           1,
		BlueprintKey:   "",
		BlueprintName:  "基础免图纸",
		StatSummary:    "移速间隔缩短至 310ms/格 · 阵亡掉落",
		MoveCooldownMs: 310,
		CostsMilli:     map[string]int64{ResWater: 300 * ResourceScale, ResWood: 240 * ResourceScale},
	},
	{
		ItemKey:        "gear_hide_boots",
		Name:           "厚底鹿皮行军靴",
		Category:       "boots",
		Tier:           1,
		BlueprintKey:   "",
		BlueprintName:  "基础免图纸",
		StatSummary:    "移速间隔缩短至 265ms/格 · 护甲 +2 · 阵亡掉落",
		DefBonus:       2,
		MoveCooldownMs: 265,
		CostsMilli:     map[string]int64{ResWood: 480 * ResourceScale, ResStone: 260 * ResourceScale, ResFlint: 3 * ResourceScale},
	},
	{
		ItemKey:        "gear_spring_boots",
		Name:           "墨械弹簧战靴",
		Category:       "boots",
		Tier:           2,
		BlueprintKey:   ResBPSpringBoots,
		BlueprintName:  "★图纸：墨械弹簧战靴",
		StatSummary:    "移速间隔缩短至 210ms/格 · 护甲 +4 · 阵亡掉落",
		DefBonus:       4,
		MoveCooldownMs: 210,
		CostsMilli:     map[string]int64{ResWood: 980 * ResourceScale, ResStone: 580 * ResourceScale, ResCharcoal: 220 * ResourceScale, ResFlint: 6 * ResourceScale},
	},
	{
		ItemKey:        "gear_hermes_boots",
		Name:           "赫尔墨斯风行羽靴",
		Category:       "boots",
		Tier:           3,
		BlueprintKey:   ResBPHermesBoots,
		BlueprintName:  "★★图纸：赫尔墨斯风行靴",
		StatSummary:    "极速移动 155ms/格 · 闪避 +20% · 阵亡掉落",
		DefBonus:       7,
		MoveCooldownMs: 155,
		CostsMilli:     map[string]int64{ResWater: 2400 * ResourceScale, ResWood: 1500 * ResourceScale, ResCharcoal: 460 * ResourceScale, ResAncientShard: 3 * ResourceScale, ResMeteorOre: 2 * ResourceScale},
	},

	// Safe Containers (本赛季安全保险箱 — 阵亡绝不掉落，本赛季永久生效)
	{
		ItemKey:       "safe_copper_2",
		Name:          "加固铜扣保险箱 (2格)",
		Category:      "safe_box",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "本赛季安全保险箱扩至 2 格（阵亡绝不遗失）",
		SafeSlots:     2,
		CostsMilli:    map[string]int64{ResWater: 950 * ResourceScale, ResWood: 680 * ResourceScale, ResStone: 420 * ResourceScale, ResFlint: 6 * ResourceScale},
	},
	{
		ItemKey:       "safe_cipher_3",
		Name:          "墨械密码保险箱 (3格)",
		Category:      "safe_box",
		Tier:          2,
		BlueprintKey:  ResBPCipherSafe,
		BlueprintName: "★图纸：墨械密码保险箱",
		StatSummary:   "本赛季安全保险箱扩至 3 格（阵亡绝不遗失）",
		SafeSlots:     3,
		CostsMilli:    map[string]int64{ResWater: 1800 * ResourceScale, ResStone: 1350 * ResourceScale, ResCharcoal: 380 * ResourceScale, ResFlint: 14 * ResourceScale, ResAncientShard: 2 * ResourceScale},
	},
	{
		ItemKey:       "safe_aether_5",
		Name:          "泰坦次元保险箱 (5格)",
		Category:      "safe_box",
		Tier:          3,
		BlueprintKey:  ResBPAetherSafe,
		BlueprintName: "★★图纸：泰坦次元保险箱",
		StatSummary:   "本赛季终极安全保险箱扩至 5 格（阵亡绝不遗失）",
		SafeSlots:     5,
		CostsMilli:    map[string]int64{ResWater: 3600 * ResourceScale, ResStone: 2600 * ResourceScale, ResCharcoal: 800 * ResourceScale, ResAncientShard: 5 * ResourceScale, ResMeteorOre: 4 * ResourceScale},
	},

	// Tactical Potions (战术药水 — 局内随时饮用生效)
	{
		ItemKey:       "pot_heal_spring",
		Name:          "清泉止血露",
		Category:      "potion",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "局内饮用：瞬间恢复 +55 生命值与 +15秒 探索时间",
		CostsMilli:    map[string]int64{ResWater: 360 * ResourceScale, ResWood: 160 * ResourceScale},
	},
	{
		ItemKey:       "pot_gale_stride",
		Name:          "轻身疾行散",
		Category:      "potion",
		Tier:          1,
		BlueprintKey:  "",
		BlueprintName: "基础免图纸",
		StatSummary:   "局内饮用：25秒内移动冷却缩短 35%（风驰电掣）",
		CostsMilli:    map[string]int64{ResWater: 420 * ResourceScale, ResCharcoal: 85 * ResourceScale},
	},
	{
		ItemKey:       "pot_scavenge_elixir",
		Name:          "巧手速搜合剂",
		Category:      "potion",
		Tier:          2,
		BlueprintKey:  ResBPScavengeElixir,
		BlueprintName: "★图纸：速搜合剂配方",
		StatSummary:   "局内饮用：35秒内搜索所有宝箱读条时间缩短 50%",
		CostsMilli:    map[string]int64{ResWater: 680 * ResourceScale, ResCharcoal: 160 * ResourceScale, ResFlint: 4 * ResourceScale},
	},
	{
		ItemKey:       "pot_berserk_elixir",
		Name:          "泰坦狂暴免死圣水",
		Category:      "potion",
		Tier:          3,
		BlueprintKey:  ResBPBerserkElixir,
		BlueprintName: "★★图纸：狂暴圣水配方",
		StatSummary:   "局内饮用：攻击 +25、护甲 +12，并获得 1 次致命免死护盾",
		CostsMilli:    map[string]int64{ResWater: 1100 * ResourceScale, ResCharcoal: 280 * ResourceScale, ResFlint: 6 * ResourceScale, ResAncientShard: 1 * ResourceScale},
	},
}
