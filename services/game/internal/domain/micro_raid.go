package domain

import (
	"fmt"
	"time"
)

// RaidBuffCardCatalog defines 54 distinct Pre-Departure Roguelite Buff Cards across 6 tactical categories.
// Players roll 3 random cards at a time, spend varied settlement resources to buy or reroll, and can equip up to 4 slots per raid.
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

var RaidRerollCostsMilli = map[string]int64{
	ResWater: 240 * ResourceScale,
	ResWood:  150 * ResourceScale,
}

func FindCosmeticSpec(itemKey string) (CosmeticSpec, bool) {
	for _, c := range CosmeticCatalog {
		if c.ItemKey == itemKey {
			return c, true
		}
	}
	return CosmeticSpec{}, false
}

func FindRaidGearSpec(itemKey string) (RaidGearSpec, bool) {
	for _, g := range RaidGearCatalog {
		if g.ItemKey == itemKey {
			return g, true
		}
	}
	return RaidGearSpec{}, false
}

func FindRaidBuffCardSpec(code string) (RaidBuffCardSpec, bool) {
	for _, b := range RaidBuffCardCatalog {
		if b.CardCode == code {
			return b, true
		}
	}
	return RaidBuffCardSpec{}, false
}

func rollThreeBuffCards(seed uint64) []string {
	n := uint64(len(RaidBuffCardCatalog))
	if n < 3 {
		return nil
	}
	picked := make([]string, 0, 3)
	used := make(map[int]bool, 3)
	s := seed
	if s == 0 {
		s = 0x9e3779b97f4a7c15
	}
	for len(picked) < 3 {
		s = s*6364136223846793005 + 1442695040888963407
		idx := int((s >> 16) % n)
		if !used[idx] {
			used[idx] = true
			picked = append(picked, RaidBuffCardCatalog[idx].CardCode)
		}
	}
	return picked
}

func EnsureRaidState(p *PlayerState) {
	if p.EquippedCosmetics == nil {
		p.EquippedCosmetics = map[string]string{}
	}
	if p.LearnedRaidBlueprints == nil {
		p.LearnedRaidBlueprints = map[string]bool{}
	}
	if p.RaidGearInventory == nil {
		p.RaidGearInventory = map[string]int32{}
	}
	if len(p.RaidLoadout.DraftPoolCards) != 3 {
		seed := uint64(p.SimulatedElapsedSeconds*131 + p.TotalManualClicks*17 + int64(len(p.Handle))*97 + 101)
		p.RaidLoadout.DraftPoolCards = rollThreeBuffCards(seed)
	}
	for slot, key := range p.EquippedCosmetics {
		if key != "" && p.ResourcesMilli[key] < ResourceScale {
			delete(p.EquippedCosmetics, slot)
		}
	}
}

func ComputeRaidLoadoutStats(p *PlayerState) (maxHP, atk, def, moveCooldownMs, durationSec, bagCap, safeSlots int32) {
	EnsureRaidState(p)
	maxHP = 100
	atk = 12
	def = 2
	moveCooldownMs = 360
	durationSec = 180
	bagCap = 6
	safeSlots = 1

	if wSpec, ok := FindRaidGearSpec(p.RaidLoadout.WeaponKey); ok && p.RaidGearInventory[wSpec.ItemKey] > 0 {
		atk += wSpec.AtkBonus
	}
	if aSpec, ok := FindRaidGearSpec(p.RaidLoadout.ArmorKey); ok && p.RaidGearInventory[aSpec.ItemKey] > 0 {
		maxHP += aSpec.HpBonus
		def += aSpec.DefBonus
		if aSpec.ItemKey == "gear_hydro_armor" {
			bagCap += 3
		}
	}
	if bSpec, ok := FindRaidGearSpec(p.RaidLoadout.BootsKey); ok && p.RaidGearInventory[bSpec.ItemKey] > 0 {
		def += bSpec.DefBonus
		if bSpec.MoveCooldownMs > 0 {
			moveCooldownMs = bSpec.MoveCooldownMs
		}
	}
	if sSpec, ok := FindRaidGearSpec(p.RaidLoadout.SafeBoxKey); ok && p.RaidGearInventory[sSpec.ItemKey] > 0 {
		if sSpec.SafeSlots > safeSlots {
			safeSlots = sSpec.SafeSlots
		}
	}

	var totalSpeedPct int32
	for _, code := range p.RaidLoadout.EquippedBuffCards {
		if cSpec, ok := FindRaidBuffCardSpec(code); ok {
			maxHP += cSpec.HpBonus
			atk += cSpec.AtkBonus
			def += cSpec.DefBonus
			durationSec += cSpec.DurationBonus
			bagCap += cSpec.BagBonus
			totalSpeedPct += cSpec.MoveSpeedPct
		}
	}
	if totalSpeedPct > 45 {
		totalSpeedPct = 45
	}
	if totalSpeedPct > 0 {
		moveCooldownMs = (moveCooldownMs * (100 - totalSpeedPct)) / 100
	}
	if moveCooldownMs < 110 {
		moveCooldownMs = 110
	}
	return maxHP, atk, def, moveCooldownMs, durationSec, bagCap, safeSlots
}

func EquipCosmetic(p *PlayerState, slot, itemKey string, now time.Time) error {
	EnsureRaidState(p)
	if slot != "headgear" && slot != "mantle" && slot != "held_relic" && slot != "companion" {
		return ErrInvalidInput("未知的外观穿戴部位")
	}
	if itemKey == "" {
		delete(p.EquippedCosmetics, slot)
		AppendLog(p, now, "RAID", "已卸下领主外观部件。")
		return nil
	}
	spec, ok := FindCosmeticSpec(itemKey)
	if !ok || spec.Slot != slot {
		return ErrInvalidInput("外观部件与穿戴部位不匹配")
	}
	if p.ResourcesMilli[itemKey] < ResourceScale {
		return ErrPrecondition("cosmetic_not_owned", "尚未拥有该赛季外观（或已挂单冻结）")
	}
	p.EquippedCosmetics[slot] = itemKey
	AppendLog(p, now, "RAID", fmt.Sprintf("领主形象已穿戴【%s】！主界面与荒原地图实时生效。", spec.Name))
	return nil
}

func LearnRaidBlueprint(p *PlayerState, blueprintKey string, now time.Time) error {
	EnsureRaidState(p)
	var targetGear RaidGearSpec
	found := false
	for _, g := range RaidGearCatalog {
		if g.BlueprintKey == blueprintKey && blueprintKey != "" {
			targetGear = g
			found = true
			break
		}
	}
	if !found {
		return ErrInvalidInput("未知的荒原一次性蓝图")
	}
	if p.LearnedRaidBlueprints[blueprintKey] {
		return ErrPrecondition("already_learned", "本赛季已研读解锁该蓝图配方，可将多余蓝图挂到交易所出售给其他玩家")
	}
	if p.ResourcesMilli[blueprintKey] < ResourceScale {
		return ErrPrecondition("blueprint_missing", fmt.Sprintf("背包中缺少【%s】，请在荒原搜打撤中摸金获取或从市场购买", targetGear.BlueprintName))
	}
	p.ResourcesMilli[blueprintKey] -= ResourceScale
	p.LearnedRaidBlueprints[blueprintKey] = true
	AppendLog(p, now, "BLUEPRINT", fmt.Sprintf("已研读并销毁一次性蓝图【%s】！本赛季永久解锁【%s】局外打造。", targetGear.BlueprintName, targetGear.Name))
	return nil
}

func ManageRaidGear(p *PlayerState, action, itemKey string, now time.Time) error {
	EnsureRaidState(p)
	spec, ok := FindRaidGearSpec(itemKey)
	if !ok {
		return ErrInvalidInput("未知的斥候整备装备或药水")
	}

	switch action {
	case "craft":
		if spec.BlueprintKey != "" && !p.LearnedRaidBlueprints[spec.BlueprintKey] {
			return ErrPrecondition("recipe_locked", fmt.Sprintf("尚未研读一次性蓝图【%s】，无法打造该高阶整备", spec.BlueprintName))
		}
		if spec.Category == "safe_box" && p.RaidGearInventory[itemKey] > 0 {
			return ErrPrecondition("already_owned", "该赛季安全保险箱已打造并永久生效")
		}
		for rKey, reqMilli := range spec.CostsMilli {
			if p.ResourcesMilli[rKey] < reqMilli {
				return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.0f", ResourceName(rKey), float64(reqMilli)/1000.0))
			}
		}
		for rKey, reqMilli := range spec.CostsMilli {
			p.ResourcesMilli[rKey] -= reqMilli
		}
		p.RaidGearInventory[itemKey]++

		switch spec.Category {
		case "weapon":
			p.RaidLoadout.WeaponKey = itemKey
		case "armor":
			p.RaidLoadout.ArmorKey = itemKey
		case "boots":
			p.RaidLoadout.BootsKey = itemKey
		case "safe_box":
			curSlots := int32(1)
			if curSpec, exists := FindRaidGearSpec(p.RaidLoadout.SafeBoxKey); exists {
				curSlots = curSpec.SafeSlots
			}
			if spec.SafeSlots >= curSlots {
				p.RaidLoadout.SafeBoxKey = itemKey
			}
		case "potion":
			if len(p.RaidLoadout.EquippedPotions) < 3 {
				already := false
				for _, pk := range p.RaidLoadout.EquippedPotions {
					if pk == itemKey {
						already = true
						break
					}
				}
				if !already {
					p.RaidLoadout.EquippedPotions = append(p.RaidLoadout.EquippedPotions, itemKey)
				}
			}
		}
		AppendLog(p, now, "RAID", fmt.Sprintf("成功打造斥候整备【%s】（库存 %d）。", spec.Name, p.RaidGearInventory[itemKey]))
		return nil

	case "equip":
		if p.RaidGearInventory[itemKey] <= 0 {
			return ErrPrecondition("not_owned", "尚未打造该整备物品")
		}
		switch spec.Category {
		case "weapon":
			p.RaidLoadout.WeaponKey = itemKey
		case "armor":
			p.RaidLoadout.ArmorKey = itemKey
		case "boots":
			p.RaidLoadout.BootsKey = itemKey
		case "safe_box":
			p.RaidLoadout.SafeBoxKey = itemKey
		case "potion":
			for _, pk := range p.RaidLoadout.EquippedPotions {
				if pk == itemKey {
					return nil
				}
			}
			if len(p.RaidLoadout.EquippedPotions) >= 3 {
				p.RaidLoadout.EquippedPotions = append(p.RaidLoadout.EquippedPotions[1:], itemKey)
			} else {
				p.RaidLoadout.EquippedPotions = append(p.RaidLoadout.EquippedPotions, itemKey)
			}
		}
		return nil

	case "unequip":
		switch spec.Category {
		case "weapon":
			if p.RaidLoadout.WeaponKey == itemKey {
				p.RaidLoadout.WeaponKey = ""
			}
		case "armor":
			if p.RaidLoadout.ArmorKey == itemKey {
				p.RaidLoadout.ArmorKey = ""
			}
		case "boots":
			if p.RaidLoadout.BootsKey == itemKey {
				p.RaidLoadout.BootsKey = ""
			}
		case "potion":
			filtered := make([]string, 0, len(p.RaidLoadout.EquippedPotions))
			for _, pk := range p.RaidLoadout.EquippedPotions {
				if pk != itemKey {
					filtered = append(filtered, pk)
				}
			}
			p.RaidLoadout.EquippedPotions = filtered
		}
		return nil

	default:
		return ErrInvalidInput("未知的整备操作")
	}
}

func DraftRaidBuff(p *PlayerState, action, cardCode string, replaceSlot int32, now time.Time) error {
	EnsureRaidState(p)
	switch action {
	case "reroll":
		for rKey, reqMilli := range RaidRerollCostsMilli {
			if p.ResourcesMilli[rKey] < reqMilli {
				return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：刷新卡池需要 %.0f %s", ResourceName(rKey), float64(reqMilli)/1000.0, ResourceName(rKey)))
			}
		}
		for rKey, reqMilli := range RaidRerollCostsMilli {
			p.ResourcesMilli[rKey] -= reqMilli
		}
		seed := uint64(now.UnixNano()) ^ uint64(p.SimulatedElapsedSeconds*31+p.TotalManualClicks)
		p.RaidLoadout.DraftPoolCards = rollThreeBuffCards(seed)
		return nil

	case "buy":
		inPool := false
		for _, c := range p.RaidLoadout.DraftPoolCards {
			if c == cardCode {
				inPool = true
				break
			}
		}
		if !inPool {
			return ErrPrecondition("card_not_in_pool", "该增益卡不在当前候选池中")
		}
		spec, ok := FindRaidBuffCardSpec(cardCode)
		if !ok {
			return ErrInvalidInput("未知的增益卡")
		}
		for rKey, reqMilli := range spec.CostsMilli {
			if p.ResourcesMilli[rKey] < reqMilli {
				return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：购买【%s】需要 %.0f", ResourceName(rKey), spec.Name, float64(reqMilli)/1000.0))
			}
		}
		for rKey, reqMilli := range spec.CostsMilli {
			p.ResourcesMilli[rKey] -= reqMilli
		}
		if len(p.RaidLoadout.EquippedBuffCards) < 4 {
			p.RaidLoadout.EquippedBuffCards = append(p.RaidLoadout.EquippedBuffCards, cardCode)
		} else {
			idx := int(replaceSlot)
			if idx < 0 || idx >= 4 {
				idx = 3
			}
			p.RaidLoadout.EquippedBuffCards[idx] = cardCode
		}
		seed := uint64(now.UnixNano()) ^ uint64(len(p.RaidLoadout.EquippedBuffCards)*997+int(p.PopulationTotal))
		p.RaidLoadout.DraftPoolCards = rollThreeBuffCards(seed)
		AppendLog(p, now, "RAID", fmt.Sprintf("已购入远征增益卡【%s】（%s）并装入战术槽位，候选池已刷新。", spec.Name, spec.EffectSummary))
		return nil

	case "remove":
		idx := int(replaceSlot)
		if idx >= 0 && idx < len(p.RaidLoadout.EquippedBuffCards) {
			p.RaidLoadout.EquippedBuffCards = append(p.RaidLoadout.EquippedBuffCards[:idx], p.RaidLoadout.EquippedBuffCards[idx+1:]...)
		}
		return nil

	default:
		return ErrInvalidInput("未知的增益卡操作")
	}
}

func StartRaid(p *PlayerState, now time.Time) error {
	EnsureRaidState(p)
	if !p.UnlockedBlueprints[BPScoutCamp] {
		return ErrPrecondition("scout_camp_locked", "尚未解锁【荒原斥候营】")
	}
	seed := now.UnixNano() ^ (p.SimulatedElapsedSeconds*2654435761 + int64(p.PopulationTotal)*97)
	if seed <= 0 {
		seed = -seed + 1001
	}
	p.RaidLoadout.ActiveRaidSeed = seed
	AppendLog(p, now, "RAID", "【荒原搜打撤】斥候小队已进入多区块迷雾裂隙！请在沙暴降临前搜索宝箱、通过传送门探索深渊，并抵达撤离信标。")
	return nil
}

var allowedRaidLootKeys = map[string]bool{
	ResFlint:            true,
	ResAncientShard:     true,
	ResMeteorOre:        true,
	ResBPCrossbow:       true,
	ResBPTitanHammer:    true,
	ResBPCarapaceArmor:  true,
	ResBPHydroArmor:     true,
	ResBPSpringBoots:    true,
	ResBPHermesBoots:    true,
	ResBPCipherSafe:     true,
	ResBPAetherSafe:     true,
	ResBPScavengeElixir: true,
	ResBPBerserkElixir:  true,
	ResCosGoggles:       true,
	ResCosSteamCrown:    true,
	ResCosObsidianCrown: true,
	ResCosSandCloak:     true,
	ResCosHydroWings:    true,
	ResCosAstralWings:   true,
	ResCosCompass:       true,
	ResCosAlchLantern:   true,
	ResCosThunderStaff:  true,
	ResCosWoodFrog:      true,
	ResCosMechOwl:       true,
	ResCosAetherDrake:   true,
}

func FinishRaid(p *PlayerState, status string, backpackLootKeys, safeBoxLootKeys, usedPotionKeys []string, zonesVisited, chestsOpened, bossesKilled int32, now time.Time) error {
	EnsureRaidState(p)
	if p.RaidLoadout.ActiveRaidSeed == 0 {
		return ErrPrecondition("no_active_raid", "当前没有正在进行的荒原搜打撤远征")
	}
	_, _, _, _, _, bagCap, safeSlots := ComputeRaidLoadoutStats(p)

	// Consume used potions
	for _, pk := range usedPotionKeys {
		if p.RaidGearInventory[pk] > 0 {
			p.RaidGearInventory[pk]--
		}
		if p.RaidGearInventory[pk] <= 0 {
			filtered := make([]string, 0, len(p.RaidLoadout.EquippedPotions))
			for _, eq := range p.RaidLoadout.EquippedPotions {
				if eq != pk {
					filtered = append(filtered, eq)
				}
			}
			p.RaidLoadout.EquippedPotions = filtered
		}
	}

	// Single-run buff cards are consumed at the end of the raid
	p.RaidLoadout.EquippedBuffCards = nil
	p.RaidLoadout.ActiveRaidSeed = 0

	// Always award validated Safe Container items (up to safeSlots)
	awardedCounts := make(map[string]int32)
	safeCount := int32(0)
	for _, k := range safeBoxLootKeys {
		if safeCount >= safeSlots {
			break
		}
		if allowedRaidLootKeys[k] {
			addResourceWithCap(p, k, ResourceScale)
			awardedCounts[k]++
			safeCount++
		}
	}

	if status == "EXTRACTED" {
		bagCount := int32(0)
		for _, k := range backpackLootKeys {
			if bagCount >= bagCap {
				break
			}
			if allowedRaidLootKeys[k] {
				addResourceWithCap(p, k, ResourceScale)
				awardedCounts[k]++
				bagCount++
			}
		}
		summaryParts := make([]string, 0, len(awardedCounts))
		for k, cnt := range awardedCounts {
			summaryParts = append(summaryParts, fmt.Sprintf("%s×%d", ResourceName(k), cnt))
		}
		lootText := "未携带战利品"
		if len(summaryParts) > 0 {
			lootText = fmt.Sprintf("成功带出：%v", summaryParts)
		}
		AppendLog(p, now, "RAID", fmt.Sprintf("【成功撤离】穿越 %d 个区块、开启 %d 处宝箱、击败 %d 名守卫！%s。", zonesVisited, chestsOpened, bossesKilled, lootText))
		return nil
	}

	// Hardcore MIA Penalty: equipped Weapon, Armor, and Boots are destroyed!
	lostGear := make([]string, 0, 3)
	if wk := p.RaidLoadout.WeaponKey; wk != "" {
		if spec, ok := FindRaidGearSpec(wk); ok {
			lostGear = append(lostGear, spec.Name)
		}
		if p.RaidGearInventory[wk] > 0 {
			p.RaidGearInventory[wk]--
		}
		if p.RaidGearInventory[wk] <= 0 {
			p.RaidLoadout.WeaponKey = ""
		}
	}
	if ak := p.RaidLoadout.ArmorKey; ak != "" {
		if spec, ok := FindRaidGearSpec(ak); ok {
			lostGear = append(lostGear, spec.Name)
		}
		if p.RaidGearInventory[ak] > 0 {
			p.RaidGearInventory[ak]--
		}
		if p.RaidGearInventory[ak] <= 0 {
			p.RaidLoadout.ArmorKey = ""
		}
	}
	if bk := p.RaidLoadout.BootsKey; bk != "" {
		if spec, ok := FindRaidGearSpec(bk); ok {
			lostGear = append(lostGear, spec.Name)
		}
		if p.RaidGearInventory[bk] > 0 {
			p.RaidGearInventory[bk]--
		}
		if p.RaidGearInventory[bk] <= 0 {
			p.RaidLoadout.BootsKey = ""
		}
	}

	safeSummary := make([]string, 0, len(awardedCounts))
	for k, cnt := range awardedCounts {
		safeSummary = append(safeSummary, fmt.Sprintf("%s×%d", ResourceName(k), cnt))
	}
	AppendLog(p, now, "RAID", fmt.Sprintf("【荒原迷失 MIA】未能及时撤离！背囊物资与穿戴装备（%v）全部损毁遗失，仅安全保险箱保住：%v。", lostGear, safeSummary))
	return nil
}
