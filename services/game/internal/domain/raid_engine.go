package domain

import (
	"fmt"
	"time"
)

var RaidRerollCostsMilli = map[string]int64{
	ResWater: 25 * ResourceScale,
	ResWood:  15 * ResourceScale,
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
	// Unequip any cosmetic that the player no longer holds in un-frozen stock
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
	// Single-use blueprint is permanently consumed upon learning!
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

		// Auto-equip newly crafted gear
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
