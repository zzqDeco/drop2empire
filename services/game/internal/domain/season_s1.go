package domain

import (
	"fmt"
	"time"
)

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
// Tier 1 items can be crafted directly with settlement resources; Tier 2 & 3 require consuming a single-use Raid Blueprint first!
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
		CostsMilli:    map[string]int64{ResWater: 2200 * ResourceScale, ResStone: 1800 * ResourceScale, ResCharcoal: 520 * ResourceScale, ResFlint: 16 * ResourceScale, ResMeteorOre: 2 * ResourceScale},
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

func RedeemSeasonChest(p *PlayerState, count int32, now time.Time) error {
	if count <= 0 {
		count = 1
	}
	if count > 10 {
		count = 10
	}
	costPts := count * ChestRedeemCostPoints
	if p.ActivityPoints < costPts {
		return ErrPrecondition("insufficient_points", fmt.Sprintf("活动点数不足：兑换 %d 个赛季宝箱需要 %d 点（当前 %d 点）", count, costPts, p.ActivityPoints))
	}
	p.ActivityPoints -= costPts
	p.ResourcesMilli[ResSeasonChest] += int64(count) * ResourceScale
	AppendLog(p, now, "COLLECTIBLE", fmt.Sprintf("消耗 %d 活动点数，成功兑换 %d 个【S1·墨械典藏宝箱】（可开启或挂牌交易）。", costPts, count))
	return nil
}

func OpenSeasonChest(w *WorldState, p *PlayerState, clientSeedHint int64, now time.Time) error {
	EnsureSeasonState(w, now)
	if p.ResourcesMilli[ResSeasonChest] < ResourceScale {
		return ErrPrecondition("no_chest", "仓库中没有【S1·墨械典藏宝箱】，请先用活动点数兑换或在市场购买")
	}
	p.ResourcesMilli[ResSeasonChest] -= ResourceScale

	serial := w.NextCollectibleSeq
	w.NextCollectibleSeq++

	rawSeed := uint64(now.UnixNano()) ^ (uint64(serial) * 0x9e3779b97f4a7c15) ^ uint64(clientSeedHint)
	rawSeed ^= rawSeed >> 30
	rawSeed *= 0xbf58476d1ce4e5b9
	rawSeed ^= rawSeed >> 27
	rawSeed *= 0x94d049bb133111eb
	rawSeed ^= rawSeed >> 31
	patternSeed := int64(rawSeed & 0x7fffffffffffff)
	if patternSeed < 100000 {
		patternSeed += 100000
	}

	models := []struct{ id, name string }{
		{"relic_chalice", "滴水圣杯 · 原初容器"},
		{"astrolabe_gear", "阿基米德星盘 · 差分轮"},
		{"alch_retort", "赫尔墨斯曲颈瓶 · 永动釜"},
		{"arcane_obelisk", "黑曜方尖碑 · 纪元碑"},
	}
	textures := []struct{ id, name string }{
		{"topo_contour", "等高线水文拓扑"},
		{"bauhaus_grid", "包豪斯黄金正交网格"},
		{"moire_wave", "双心莫尔干涉波纹"},
		{"fractal_lattice", "泰坦晶格蚀刻线"},
	}
	palettes := []struct{ id, name string }{
		{"ink_monolith", "纯墨原稿 · 炭黑象牙"},
		{"cinnabar_seal", "朱砂官印 · 矿物红点缀"},
		{"oxidized_verdigris", "青铜绿锈 · 古典蚀刻"},
		{"gilded_obsidian", "黑曜描金 · 暗金墨线"},
	}

	m := models[int(rawSeed%uint64(len(models)))]
	tex := textures[int((rawSeed>>8)%uint64(len(textures)))]
	pal := palettes[int((rawSeed>>16)%uint64(len(palettes)))]

	uvOffsetX := int32((rawSeed >> 20) % 1000)
	uvOffsetY := int32((rawSeed >> 30) % 1000)
	uvScale := int32(650 + ((rawSeed >> 40) % 1150))
	uvRotation := int32((rawSeed >> 50) % 360)

	roll := int((rawSeed >> 12) % 100)
	rarity := "COMMON"
	if roll >= 98 {
		rarity = "LEGENDARY"
	} else if roll >= 88 {
		rarity = "EPIC"
	} else if roll >= 60 {
		rarity = "RARE"
	}

	specialTag := "标准采样花纹"
	if uvOffsetX >= 460 && uvOffsetX <= 540 && uvOffsetY >= 460 && uvOffsetY <= 540 {
		specialTag = "★ 居中同心核 (Center-Axis Lock)"
	} else if uvRotation == 0 || uvRotation == 45 || uvRotation == 90 || uvRotation == 135 || uvRotation == 180 {
		specialTag = "★ 正交工程角 (Orthogonal Angle)"
	} else if uvScale >= 1550 {
		specialTag = "★ 高密微雕纹 (Micro-Etch High Density)"
	} else if uvScale <= 750 {
		specialTag = "★ 极简巨构纹 (Macro-Minimalist)"
	}

	item := CollectibleItem{
		ItemID:        fmt.Sprintf("d2e-s%d-%04d-%06x", w.SeasonNumber, serial, rawSeed&0xffffff),
		SerialNumber:  serial,
		SeasonID:      w.SeasonCode,
		CollectionID:  fmt.Sprintf("COL-S%d-GENESIS", w.SeasonNumber),
		Name:          fmt.Sprintf("%s | %s #%03d", m.name, tex.name, serial),
		BaseModelID:   m.id,
		BaseModelName: m.name,
		TextureID:     tex.id,
		TextureName:   tex.name,
		PatternSeed:   patternSeed,
		UVOffsetX:     uvOffsetX,
		UVOffsetY:     uvOffsetY,
		UVScale:       uvScale,
		UVRotation:    uvRotation,
		PaletteID:     pal.id,
		PaletteName:   pal.name,
		RarityTier:    rarity,
		SpecialTag:    specialTag,
		MintedAt:      now.UTC().Format("2006-01-02 15:04:05"),
		OwnerHandle:   p.Handle,
	}

	w.Collectibles = append([]CollectibleItem{item}, w.Collectibles...)
	AppendLog(p, now, "COLLECTIBLE", fmt.Sprintf("★ 开启宝箱铸造唯一藏品【%s】（品质：%s，种子：%d，特征：%s）！",
		item.Name, item.RarityTier, item.PatternSeed, item.SpecialTag))
	return nil
}
