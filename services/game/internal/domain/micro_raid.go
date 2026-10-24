package domain

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"time"
)

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
	maxHP = RaidBalance.BaseMaxHP
	atk = RaidBalance.BaseAtk
	def = RaidBalance.BaseDef
	moveCooldownMs = RaidBalance.BaseMoveCooldownMs
	durationSec = RaidBalance.BaseDurationSec
	bagCap = RaidBalance.BaseBackpackCap
	safeSlots = RaidBalance.BaseSafeSlots

	if wSpec, ok := FindRaidGearSpec(p.RaidLoadout.WeaponKey); ok && p.RaidGearInventory[wSpec.ItemKey] > 0 {
		atk += wSpec.AtkBonus
	}
	if aSpec, ok := FindRaidGearSpec(p.RaidLoadout.ArmorKey); ok && p.RaidGearInventory[aSpec.ItemKey] > 0 {
		maxHP += aSpec.HpBonus
		def += aSpec.DefBonus
		bagCap += aSpec.BagBonus
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
	if totalSpeedPct > RaidBalance.MaxBuffSpeedPct {
		totalSpeedPct = RaidBalance.MaxBuffSpeedPct
	}
	if totalSpeedPct > 0 {
		moveCooldownMs = (moveCooldownMs * (100 - totalSpeedPct)) / 100
	}
	if moveCooldownMs < RaidBalance.MinMoveCooldownMs {
		moveCooldownMs = RaidBalance.MinMoveCooldownMs
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
			curSlots := RaidBalance.BaseSafeSlots
			if curSpec, exists := FindRaidGearSpec(p.RaidLoadout.SafeBoxKey); exists {
				curSlots = curSpec.SafeSlots
			}
			if spec.SafeSlots >= curSlots {
				p.RaidLoadout.SafeBoxKey = itemKey
			}
		case "potion":
			if len(p.RaidLoadout.EquippedPotions) < RaidBalance.MaxEquippedPotions {
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
			if len(p.RaidLoadout.EquippedPotions) >= RaidBalance.MaxEquippedPotions {
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
		maxSlots := RaidBalance.MaxEquippedBuffCards
		if len(p.RaidLoadout.EquippedBuffCards) < maxSlots {
			p.RaidLoadout.EquippedBuffCards = append(p.RaidLoadout.EquippedBuffCards, cardCode)
		} else {
			idx := int(replaceSlot)
			if idx < 0 || idx >= maxSlots {
				idx = maxSlots - 1
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

func serverNextCryptoUint64(fallback uint64) uint64 {
	var b [8]byte
	if _, err := rand.Read(b[:]); err == nil {
		return binary.LittleEndian.Uint64(b[:]) ^ fallback
	}
	fallback ^= fallback >> 30
	fallback *= 0xbf58476d1ce4e5b9
	fallback ^= fallback >> 27
	fallback *= 0x94d049bb133111eb
	fallback ^= fallback >> 31
	return fallback
}

func computeRaidVisionRadius(p *PlayerState) (radius int32, revealBeacons bool) {
	radius = RaidBalance.VisionRadius
	for _, code := range p.RaidLoadout.EquippedBuffCards {
		if spec, ok := FindRaidBuffCardSpec(code); ok && spec.Category == "vision" {
			radius = RaidBalance.VisionRadius + 1
			if spec.RevealBeacons {
				revealBeacons = true
			}
		}
	}
	return radius, revealBeacons
}

func revealServerZoneAround(zone *RaidZoneState, cx, cy, radius int32, revealBeacons bool) {
	for i := range zone.Tiles {
		t := &zone.Tiles[i]
		dx := t.X - cx
		if dx < 0 {
			dx = -dx
		}
		dy := t.Y - cy
		if dy < 0 {
			dy = -dy
		}
		if dx <= radius && dy <= radius {
			t.Explored = true
		} else if revealBeacons && (t.Kind == "portal" || t.Kind == "extract_early" || t.Kind == "extract_deep") {
			t.Explored = true
		}
	}
}

func buildServerRaidZones(seed int64) []RaidZoneState {
	a := uint32(seed)
	if a == 0 {
		a = 1337
	}
	nextRand := func() float64 {
		a += 0x6d2b79f5
		t := (a ^ (a >> 15)) * (1 | a)
		t = (t + (t^(t>>7))*(61|t)) ^ t
		return float64(t^(t>>14)) / 4294967296.0
	}

	zones := make([]RaidZoneState, 0, len(RaidZoneTemplates))
	for _, tmpl := range RaidZoneTemplates {
		tiles := make([]RaidTileState, 0, int(tmpl.Width*tmpl.Height))
		for y := int32(0); y < tmpl.Height; y++ {
			for x := int32(0); x < tmpl.Width; x++ {
				tiles = append(tiles, RaidTileState{
					X:                x,
					Y:                y,
					Kind:             "empty",
					PortalTargetZone: -1,
				})
			}
		}
		z := RaidZoneState{
			ID:       tmpl.ID,
			Name:     tmpl.Name,
			Subtitle: tmpl.Subtitle,
			Width:    tmpl.Width,
			Height:   tmpl.Height,
			Visited:  tmpl.ID == 0,
			Tiles:    tiles,
		}
		for _, fix := range tmpl.Fixed {
			if fix.X < 0 || fix.X >= z.Width || fix.Y < 0 || fix.Y >= z.Height {
				continue
			}
			tile := &z.Tiles[int(fix.Y*z.Width+fix.X)]
			if fix.EnemyArchetype != "" {
				if spec, ok := RaidEnemyCatalog[fix.EnemyArchetype]; ok {
					tile.Kind = spec.Kind
					tile.EnemyName = spec.Name
					tile.EnemyHP = spec.MaxHP
					tile.EnemyMaxHP = spec.MaxHP
					tile.EnemyAtk = spec.Atk
				}
				continue
			}
			tile.Kind = fix.Kind
			if fix.Kind == "portal" {
				tile.PortalTargetZone = fix.PortalTargetZone
				tile.PortalTargetX = fix.PortalTargetX
				tile.PortalTargetY = fix.PortalTargetY
				tile.PortalLabel = fix.PortalLabel
			}
		}
		for i := range z.Tiles {
			t := &z.Tiles[i]
			if t.Kind != "empty" {
				continue
			}
			r := nextRand()
			for _, rule := range tmpl.ProcRules {
				if r < rule.MaxRoll {
					if rule.Kind == "wall" {
						if (rule.WallClearRowY >= 0 && t.Y == rule.WallClearRowY) ||
							(rule.WallClearColX >= 0 && t.X == rule.WallClearColX) ||
							(rule.WallClearX >= 0 && rule.WallClearY >= 0 && t.X == rule.WallClearX && t.Y == rule.WallClearY) {
							continue
						}
						t.Kind = "wall"
						break
					}
					if rule.EnemyArchetype != "" {
						if spec, ok := RaidEnemyCatalog[rule.EnemyArchetype]; ok {
							t.Kind = spec.Kind
							t.EnemyName = spec.Name
							t.EnemyHP = spec.MaxHP
							t.EnemyMaxHP = spec.MaxHP
							t.EnemyAtk = spec.Atk
						}
						break
					}
					t.Kind = rule.Kind
					break
				}
			}
		}
		zones = append(zones, z)
	}
	return zones
}

func makeServerLootItem(itemKey string, seq *int32) RaidLootItem {
	*seq++
	meta, ok := RaidLootCatalogMeta[itemKey]
	if !ok {
		meta = RaidLootItem{Key: itemKey, Name: ResourceName(itemKey), Rarity: "COMMON", Category: "material"}
	}
	return RaidLootItem{
		ID:       fmt.Sprintf("loot_%d_%s", *seq, itemKey),
		Key:      itemKey,
		Name:     meta.Name,
		Rarity:   meta.Rarity,
		Category: meta.Category,
	}
}

func rollServerChestDrops(chestKind string, seed uint64, seq *int32) []RaidLootItem {
	spec, ok := RaidChestLootTables[chestKind]
	if !ok {
		return nil
	}
	drops := make([]RaidLootItem, 0, 3)
	r1 := serverNextCryptoUint64(seed + uint64(*seq)*997 + 13)
	r2 := serverNextCryptoUint64(seed + uint64(*seq)*1337 + 29)
	p1 := int(r1 % 1000)  // 0..999
	p2 := int(r2 % 10000) // 0..9999

	if spec.GuaranteedItemKey != "" {
		drops = append(drops, makeServerLootItem(spec.GuaranteedItemKey, seq))
	}
	if spec.BonusItemKey != "" && p1 < spec.BonusChance1000 {
		drops = append(drops, makeServerLootItem(spec.BonusItemKey, seq))
	}
	for _, band := range spec.SecondaryBands {
		if p2 < band.MaxRoll10000 && len(band.Pool) > 0 {
			pick := band.Pool[int((r2>>16)%uint64(len(band.Pool)))]
			drops = append(drops, makeServerLootItem(pick, seq))
			break
		}
	}
	return drops
}

func prependRaidLog(sess *ActiveRaidSession, msg string) {
	sess.Logs = append([]string{msg}, sess.Logs...)
	if len(sess.Logs) > 8 {
		sess.Logs = sess.Logs[:8]
	}
}

func StartRaid(p *PlayerState, now time.Time) error {
	EnsureRaidState(p)
	if !p.UnlockedBlueprints[BPScoutCamp] {
		return ErrPrecondition("scout_camp_locked", "尚未解锁【荒原斥候营】")
	}
	seed := int64(serverNextCryptoUint64(uint64(now.UnixNano())^uint64(p.SimulatedElapsedSeconds*2654435761+int64(p.PopulationTotal)*97)) & 0x7fffffffffffffff)
	if seed <= 0 {
		seed = 100001
	}
	maxHP, atk, def, moveCooldownMs, durationSec, _, _ := ComputeRaidLoadoutStats(p)
	zones := buildServerRaidZones(seed)
	visRadius, revealBeacons := computeRaidVisionRadius(p)
	revealServerZoneAround(&zones[0], 1, 3, visRadius, revealBeacons)

	p.RaidLoadout.ActiveRaidSeed = seed
	p.RaidLoadout.LastSettlementReport = nil
	p.RaidLoadout.ActiveSession = &ActiveRaidSession{
		Seed:                 seed,
		StartedAt:            now,
		ExpiresAt:            now.Add(time.Duration(durationSec) * time.Second),
		SteppedOnTileAt:      now,
		CurrentZoneID:        0,
		PlayerX:              1,
		PlayerY:              3,
		Facing:               "right",
		HP:                   maxHP,
		MaxHP:                maxHP,
		Atk:                  atk,
		Def:                  def,
		CheatDeathActive:     false,
		BaseMoveCooldownMs:   moveCooldownMs,
		ActiveContainerTitle: "未开启容器",
		Logs: []string{
			"已踏入【外围 · 沙暴荒原】全屏视野！按 WASD 或点击相邻格移动，平时背囊隐藏，搜索宝箱或按 [B] 键可呼出三栏摸金界面。",
		},
		ZonesVisitedCount: 1,
		Zones:             zones,
	}
	AppendLog(p, now, "RAID", "【荒原搜打撤】斥候小队已进入多区块迷雾裂隙！请在沙暴降临前搜索宝箱、通过传送门探索深渊，并抵达撤离信标。")
	return nil
}

func isAllowedRaidLootKey(key string) bool {
	_, ok := RaidLootCatalogMeta[key]
	return ok
}

func isEarlyExtractionOpen(sess *ActiveRaidSession, now time.Time) bool {
	minRemaining := time.Duration(RaidBalance.EarlyExtractCutoffSec-RaidBalance.EarlyExtractGraceSec) * time.Second
	return sess.ExpiresAt.Sub(now) >= minRemaining
}

func PerformRaidAction(p *PlayerState, action string, dx, dy int32, itemID, fromContainer, toContainer, itemKey string, now time.Time) error {
	EnsureRaidState(p)
	sess := p.RaidLoadout.ActiveSession
	if sess == nil || p.RaidLoadout.ActiveRaidSeed == 0 {
		return ErrPrecondition("no_active_raid", "当前没有正在进行的荒原搜打撤远征")
	}

	// Enforce server-side real-time sandstorm timer expiration
	if now.After(sess.ExpiresAt) {
		return FinishRaid(p, "MIA", now)
	}

	_, _, _, _, _, bagCap, safeSlots := ComputeRaidLoadoutStats(p)
	if int(sess.CurrentZoneID) < 0 || int(sess.CurrentZoneID) >= len(sess.Zones) {
		sess.CurrentZoneID = 0
	}
	zone := &sess.Zones[sess.CurrentZoneID]
	visRadius, revealBeacons := computeRaidVisionRadius(p)

	switch action {
	case "move":
		absDx := dx
		if absDx < 0 {
			absDx = -absDx
		}
		absDy := dy
		if absDy < 0 {
			absDy = -absDy
		}
		if absDx+absDy != 1 {
			return ErrInvalidInput("单步移动仅允许正交相邻 1 格")
		}

		// Server-side leaky-bucket move cooldown check (prevents speed-hack scripts while tolerating rapid WASD bursts)
		effMoveCdMs := int64(sess.BaseMoveCooldownMs)
		if effMoveCdMs <= 0 {
			effMoveCdMs = int64(RaidBalance.BaseMoveCooldownMs)
		}
		if now.Before(sess.GaleEndsAt) && int64(RaidBalance.GalePotionCooldownMs) < effMoveCdMs {
			effMoveCdMs = int64(RaidBalance.GalePotionCooldownMs)
		}
		stepInterval := time.Duration((effMoveCdMs*int64(RaidBalance.MoveCooldownJitterPct))/100) * time.Millisecond
		burstWindow := time.Duration(RaidBalance.MoveBurstAllowanceMs) * time.Millisecond
		baseTime := sess.LastMoveAt
		if baseTime.Before(now.Add(-burstWindow)) {
			baseTime = now.Add(-burstWindow)
		}
		nextAllowed := baseTime.Add(stepInterval)
		if now.Before(nextAllowed) {
			return ErrPrecondition("move_cooldown", "移动频率过快，请等待步伐冷却")
		}

		if dx < 0 {
			sess.Facing = "left"
		} else if dx > 0 {
			sess.Facing = "right"
		} else if dy < 0 {
			sess.Facing = "up"
		} else if dy > 0 {
			sess.Facing = "down"
		}

		nx := sess.PlayerX + dx
		ny := sess.PlayerY + dy
		if nx < 0 || nx >= zone.Width || ny < 0 || ny >= zone.Height {
			return ErrPrecondition("out_of_bounds", "前方为荒原边界岩壁，无法通行")
		}
		dest := &zone.Tiles[int(ny*zone.Width+nx)]
		if dest.Kind == "wall" {
			return nil
		}

		sess.LastMoveAt = nextAllowed
		sess.SteppedOnTileAt = now
		sess.ActiveChestDrops = nil
		sess.PlayerX = nx
		sess.PlayerY = ny
		revealServerZoneAround(zone, nx, ny, visRadius, revealBeacons)

		if (dest.Kind == "enemy_raider" || dest.Kind == "enemy_worm" || dest.Kind == "enemy_boss") && !dest.Looted {
			eHp := dest.EnemyHP
			if eHp <= 0 {
				eHp = RaidEnemyCatalog["raider"].MaxHP
			}
			eAtk := dest.EnemyAtk
			if eAtk <= 0 {
				eAtk = RaidEnemyCatalog["raider"].Atk
			}
			playerDmg := sess.Atk
			if playerDmg < RaidBalance.CombatMinPlayerDmg {
				playerDmg = RaidBalance.CombatMinPlayerDmg
			}
			rounds := (eHp + playerDmg - 1) / playerDmg
			dmgPerRound := eAtk - sess.Def
			if dmgPerRound < RaidBalance.CombatMinEnemyDmg {
				dmgPerRound = RaidBalance.CombatMinEnemyDmg
			}
			totalTaken := (rounds - 1) * dmgPerRound
			if totalTaken < 0 {
				totalTaken = 0
			}

			nextHp := sess.HP - totalTaken
			if nextHp <= 0 && !sess.CheatDeathActive {
				sess.HP = 0
				return FinishRaid(p, "MIA", now)
			}
			if nextHp <= 0 && sess.CheatDeathActive {
				sess.CheatDeathActive = false
				sess.HP = RaidBalance.CheatDeathReviveHP
				prependRaidLog(sess, fmt.Sprintf("免死圣水触发！抵挡了【%s】致命一击并反杀对手！", dest.EnemyName))
			} else {
				sess.HP = nextHp
			}

			dest.Looted = true
			dest.EnemyHP = 0
			if dest.Kind == "enemy_boss" {
				sess.BossesKilledCount++
				bossDrops := rollServerChestDrops("chest_abyss", uint64(sess.Seed), &sess.NextLootSeq)
				sess.ActiveContainerTitle = fmt.Sprintf("%s · 首领战利品箱", dest.EnemyName)
				sess.ActiveChestDrops = bossDrops
				prependRaidLog(sess, fmt.Sprintf("讨伐首领【%s】（受创 -%d HP），掉落战利品箱已展开！", dest.EnemyName, totalTaken))
			} else {
				prependRaidLog(sess, fmt.Sprintf("击溃【%s】（受创 -%d HP）。", dest.EnemyName, totalTaken))
			}
			return nil
		}

		if dest.Kind == "oasis" && !dest.Looted {
			dest.Looted = true
			sess.HP += RaidBalance.OasisHealHP
			if sess.HP > sess.MaxHP {
				sess.HP = sess.MaxHP
			}
			sess.ExpiresAt = sess.ExpiresAt.Add(time.Duration(RaidBalance.OasisBonusSec) * time.Second)
			prependRaidLog(sess, fmt.Sprintf("饮用绿洲甘泉：生命 +%d，沙暴倒计时延长 +%d 秒！", RaidBalance.OasisHealHP, RaidBalance.OasisBonusSec))
			return nil
		}

		if dest.Kind == "merchant" {
			sess.ActiveContainerTitle = "荒原游商营帐 · 局内易物驿站"
			prependRaidLog(sess, "抵达【荒原游商营帐】！已展开游商货架与随身背囊。")
			return nil
		}
		return nil

	case "open_chest", "interact":
		curTile := &zone.Tiles[int(sess.PlayerY*zone.Width+sess.PlayerX)]
		if curTile.Kind == "portal" {
			return PerformRaidAction(p, "use_portal", 0, 0, "", "", "", "", now)
		}
		if curTile.Kind == "extract_early" {
			if !isEarlyExtractionOpen(sess, now) {
				return ErrPrecondition("early_extract_closed", "外围撤离信标已在沙暴前 60 秒关闭，请前往深渊信标撤离")
			}
			return FinishRaid(p, "EXTRACTED", now)
		}
		if curTile.Kind == "extract_deep" {
			return FinishRaid(p, "EXTRACTED", now)
		}
		chestSpec, isChest := RaidChestLootTables[curTile.Kind]
		if !isChest {
			return nil
		}
		if curTile.Looted {
			return nil
		}
		// Server-side chest channeling duration verification when real wall-clock time advances between move and open_chest
		if baseChannelMs, ok := RaidChannelDurationMs[curTile.Kind]; ok && !sess.SteppedOnTileAt.IsZero() && now.After(sess.SteppedOnTileAt) {
			reqMs := int64(baseChannelMs)
			if now.Before(sess.ScavEndsAt) {
				reqMs = (reqMs * int64(100-RaidBalance.PotionScavSpeedPct)) / 100
			}
			minElapsedMs := (reqMs * int64(RaidBalance.ChannelJitterTolerancePct)) / 100
			if now.Sub(sess.SteppedOnTileAt) < time.Duration(minElapsedMs)*time.Millisecond {
				return ErrPrecondition("channeling_incomplete", "宝箱搜索读条尚未完成")
			}
		}

		curTile.Looted = true
		sess.ChestsOpenedCount++
		rolled := rollServerChestDrops(curTile.Kind, uint64(sess.Seed), &sess.NextLootSeq)
		sess.ActiveContainerTitle = chestSpec.Title
		sess.ActiveChestDrops = rolled
		if len(rolled) == 0 {
			prependRaidLog(sess, "开启了容器，内部空无一物。")
		} else {
			names := make([]string, 0, len(rolled))
			for _, r := range rolled {
				names = append(names, r.Name)
			}
			prependRaidLog(sess, fmt.Sprintf("开启容器发现：%v！拖拽或点击可收入背囊/保险箱。", names))
		}
		return nil

	case "use_portal":
		curTile := &zone.Tiles[int(sess.PlayerY*zone.Width+sess.PlayerX)]
		if curTile.Kind != "portal" || int(curTile.PortalTargetZone) < 0 || int(curTile.PortalTargetZone) >= len(sess.Zones) {
			return ErrPrecondition("not_on_portal", "当前未站在星盘传送门上")
		}
		tz := curTile.PortalTargetZone
		tx := curTile.PortalTargetX
		ty := curTile.PortalTargetY
		sess.CurrentZoneID = tz
		sess.PlayerX = tx
		sess.PlayerY = ty
		sess.SteppedOnTileAt = now
		sess.ActiveChestDrops = nil
		if !sess.Zones[tz].Visited {
			sess.Zones[tz].Visited = true
			sess.ZonesVisitedCount++
		}
		revealServerZoneAround(&sess.Zones[tz], tx, ty, visRadius, revealBeacons)
		prependRaidLog(sess, fmt.Sprintf("穿越星盘传送门，抵达【%s】！", sess.Zones[tz].Name))
		return nil

	case "transfer_loot", "loot_transfer":
		if fromContainer == toContainer {
			return nil
		}
		var picked *RaidLootItem
		removeFromSlice := func(slice []RaidLootItem) []RaidLootItem {
			out := make([]RaidLootItem, 0, len(slice))
			for _, it := range slice {
				if picked == nil && it.ID == itemID {
					cp := it
					picked = &cp
					continue
				}
				out = append(out, it)
			}
			return out
		}
		switch fromContainer {
		case "chest":
			sess.ActiveChestDrops = removeFromSlice(sess.ActiveChestDrops)
		case "backpack":
			sess.Backpack = removeFromSlice(sess.Backpack)
		case "safebox":
			sess.SafeBox = removeFromSlice(sess.SafeBox)
		default:
			return ErrInvalidInput("未知的源容器")
		}
		if picked == nil {
			return nil
		}

		switch toContainer {
		case "safebox":
			if int32(len(sess.SafeBox)) >= safeSlots {
				if fromContainer == "chest" {
					sess.ActiveChestDrops = append(sess.ActiveChestDrops, *picked)
				} else if fromContainer == "backpack" {
					sess.Backpack = append(sess.Backpack, *picked)
				}
				return ErrPrecondition("safebox_full", "安全保险箱已满")
			}
			sess.SafeBox = append(sess.SafeBox, *picked)
		case "backpack":
			if int32(len(sess.Backpack)) >= bagCap {
				if fromContainer == "chest" {
					sess.ActiveChestDrops = append(sess.ActiveChestDrops, *picked)
				} else if fromContainer == "safebox" {
					sess.SafeBox = append(sess.SafeBox, *picked)
				}
				return ErrPrecondition("backpack_full", "随身背囊已满")
			}
			sess.Backpack = append(sess.Backpack, *picked)
		case "chest":
			sess.ActiveChestDrops = append(sess.ActiveChestDrops, *picked)
		}
		return nil

	case "loot_all", "take_all":
		if len(sess.ActiveChestDrops) == 0 {
			return nil
		}
		remaining := make([]RaidLootItem, 0, len(sess.ActiveChestDrops))
		for _, d := range sess.ActiveChestDrops {
			if (d.Rarity == "LEGENDARY" || d.Rarity == "EPIC") && int32(len(sess.SafeBox)) < safeSlots {
				sess.SafeBox = append(sess.SafeBox, d)
			} else if int32(len(sess.Backpack)) < bagCap {
				sess.Backpack = append(sess.Backpack, d)
			} else if int32(len(sess.SafeBox)) < safeSlots {
				sess.SafeBox = append(sess.SafeBox, d)
			} else {
				remaining = append(remaining, d)
			}
		}
		sess.ActiveChestDrops = remaining
		return nil

	case "drink_potion", "use_potion":
		for _, used := range sess.UsedPotionKeys {
			if used == itemKey {
				return nil
			}
		}
		equipped := false
		for _, eq := range p.RaidLoadout.EquippedPotions {
			if eq == itemKey && p.RaidGearInventory[itemKey] > 0 {
				equipped = true
				break
			}
		}
		if !equipped {
			return ErrPrecondition("potion_not_equipped", "未携带该战术药水")
		}
		sess.UsedPotionKeys = append(sess.UsedPotionKeys, itemKey)
		if p.RaidGearInventory[itemKey] > 0 {
			p.RaidGearInventory[itemKey]--
		}
		if p.RaidGearInventory[itemKey] <= 0 {
			filtered := make([]string, 0, len(p.RaidLoadout.EquippedPotions))
			for _, eq := range p.RaidLoadout.EquippedPotions {
				if eq != itemKey {
					filtered = append(filtered, eq)
				}
			}
			p.RaidLoadout.EquippedPotions = filtered
		}

		switch itemKey {
		case "pot_heal_spring", "pot_heal_salve":
			sess.HP += RaidBalance.PotionHealSpringHP
			if sess.HP > sess.MaxHP {
				sess.HP = sess.MaxHP
			}
			sess.ExpiresAt = sess.ExpiresAt.Add(time.Duration(RaidBalance.PotionHealSpringBonusS) * time.Second)
			prependRaidLog(sess, fmt.Sprintf("饮用【清泉止血露】：生命 +%d，时间 +%ds！", RaidBalance.PotionHealSpringHP, RaidBalance.PotionHealSpringBonusS))
		case "pot_gale_stride", "pot_gale_draught":
			sess.GaleEndsAt = now.Add(time.Duration(RaidBalance.PotionGaleStrideSec) * time.Second)
			prependRaidLog(sess, fmt.Sprintf("饮用【轻身疾行散】：%d秒内移动冷却缩短 35%%！", RaidBalance.PotionGaleStrideSec))
		case "pot_scavenge_elixir":
			sess.ScavEndsAt = now.Add(time.Duration(RaidBalance.PotionScavElixirSec) * time.Second)
			prependRaidLog(sess, fmt.Sprintf("饮用【巧手速搜合剂】：%d秒内搜索宝箱读条缩短 %d%%！", RaidBalance.PotionScavElixirSec, RaidBalance.PotionScavSpeedPct))
		case "pot_berserk_elixir":
			sess.Atk += RaidBalance.PotionBerserkAtkBonus
			sess.Def += RaidBalance.PotionBerserkDefBonus
			sess.CheatDeathActive = true
			prependRaidLog(sess, fmt.Sprintf("饮用【泰坦狂暴圣水】：攻击+%d、护甲+%d，并激活 1 次致命免死护盾！", RaidBalance.PotionBerserkAtkBonus, RaidBalance.PotionBerserkDefBonus))
		}
		return nil

	case "merchant_buy", "caravan_trade":
		curTile := &zone.Tiles[int(sess.PlayerY*zone.Width+sess.PlayerX)]
		if curTile.Kind != "merchant" {
			return ErrPrecondition("not_at_merchant", "请先移动至荒原游商营帐")
		}
		if itemKey == "heal" {
			flintIdx := -1
			for i, it := range sess.Backpack {
				if it.Key == ResFlint {
					flintIdx = i
					break
				}
			}
			if flintIdx < 0 {
				return ErrPrecondition("missing_flint", "随身背囊中没有燧石结晶")
			}
			sess.Backpack = append(sess.Backpack[:flintIdx], sess.Backpack[flintIdx+1:]...)
			sess.HP += RaidBalance.CaravanHealHP
			if sess.HP > sess.MaxHP {
				sess.HP = sess.MaxHP
			}
			sess.ExpiresAt = sess.ExpiresAt.Add(time.Duration(RaidBalance.CaravanBonusSec) * time.Second)
			prependRaidLog(sess, fmt.Sprintf("向荒原游商交付 1 枚燧石：恢复 +%d 生命、延长 +%d 秒时间！", RaidBalance.CaravanHealHP, RaidBalance.CaravanBonusSec))
			return nil
		}
		shardIdx := -1
		for i, it := range sess.Backpack {
			if it.Key == ResAncientShard {
				shardIdx = i
				break
			}
		}
		if shardIdx < 0 {
			return ErrPrecondition("missing_shard", "随身背囊中没有古文明残片")
		}
		sess.Backpack = append(sess.Backpack[:shardIdx], sess.Backpack[shardIdx+1:]...)
		r := serverNextCryptoUint64(uint64(sess.Seed) + uint64(sess.NextLootSeq)*313)
		pick := RaidMerchantMysteryPool[int(r%uint64(len(RaidMerchantMysteryPool)))]
		drop := makeServerLootItem(pick, &sess.NextLootSeq)
		sess.Backpack = append(sess.Backpack, drop)
		prependRaidLog(sess, fmt.Sprintf("游商盲盒开启：获得【%s】！", drop.Name))
		return nil

	default:
		return ErrInvalidInput("未知的荒原局内动作")
	}
}

func isAtOrNearExtractionTile(sess *ActiveRaidSession, now time.Time) bool {
	if sess == nil || int(sess.CurrentZoneID) < 0 || int(sess.CurrentZoneID) >= len(sess.Zones) {
		return false
	}
	zone := &sess.Zones[sess.CurrentZoneID]
	for _, t := range zone.Tiles {
		if t.Kind != "extract_early" && t.Kind != "extract_deep" {
			continue
		}
		if t.Kind == "extract_early" && !isEarlyExtractionOpen(sess, now) {
			continue
		}
		dx := t.X - sess.PlayerX
		if dx < 0 {
			dx = -dx
		}
		dy := t.Y - sess.PlayerY
		if dy < 0 {
			dy = -dy
		}
		if dx+dy <= 1 {
			return true
		}
	}
	return false
}

func FinishRaid(p *PlayerState, status string, now time.Time) error {
	EnsureRaidState(p)
	sess := p.RaidLoadout.ActiveSession
	if sess == nil || p.RaidLoadout.ActiveRaidSeed == 0 {
		return ErrPrecondition("no_active_raid", "当前没有正在进行的荒原搜打撤远征")
	}
	_, _, _, _, _, bagCap, safeSlots := ComputeRaidLoadoutStats(p)

	// Enforce server-side timer expiration and physical extraction beacon position check
	if now.After(sess.ExpiresAt) || sess.HP <= 0 {
		status = "MIA"
	} else if status == "EXTRACTED" && !isAtOrNearExtractionTile(sess, now) {
		status = "MIA"
	}

	// Single-run buff cards are consumed at the end of the raid
	p.RaidLoadout.EquippedBuffCards = nil
	p.RaidLoadout.ActiveRaidSeed = 0
	p.RaidLoadout.ActiveSession = nil

	awardedCounts := make(map[string]int32)
	safeBoxAwarded := make([]RaidLootItem, 0, len(sess.SafeBox))
	for i, item := range sess.SafeBox {
		if int32(i) >= safeSlots {
			break
		}
		if isAllowedRaidLootKey(item.Key) {
			addResourceWithCap(p, item.Key, ResourceScale)
			awardedCounts[item.Key]++
			safeBoxAwarded = append(safeBoxAwarded, item)
		}
	}

	zonesVisitedCount := sess.ZonesVisitedCount
	if zonesVisitedCount < 1 {
		zonesVisitedCount = 1
	}

	if status == "EXTRACTED" {
		backpackAwarded := make([]RaidLootItem, 0, len(sess.Backpack))
		for i, item := range sess.Backpack {
			if int32(i) >= bagCap {
				break
			}
			if isAllowedRaidLootKey(item.Key) {
				addResourceWithCap(p, item.Key, ResourceScale)
				awardedCounts[item.Key]++
				backpackAwarded = append(backpackAwarded, item)
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
		p.RaidLoadout.LastSettlementReport = &RaidSettlementReport{
			Status:        "EXTRACTED",
			BackpackItems: backpackAwarded,
			SafeBoxItems:  safeBoxAwarded,
			LostGearNames: nil,
			ZonesVisited:  zonesVisitedCount,
			ChestsOpened:  sess.ChestsOpenedCount,
			BossesKilled:  sess.BossesKilledCount,
		}
		AppendLog(p, now, "RAID", fmt.Sprintf("【成功撤离】穿越 %d 个区块、开启 %d 处宝箱、击败 %d 名守卫！%s。", zonesVisitedCount, sess.ChestsOpenedCount, sess.BossesKilledCount, lootText))
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

	p.RaidLoadout.LastSettlementReport = &RaidSettlementReport{
		Status:        "MIA",
		BackpackItems: nil,
		SafeBoxItems:  safeBoxAwarded,
		LostGearNames: lostGear,
		ZonesVisited:  zonesVisitedCount,
		ChestsOpened:  sess.ChestsOpenedCount,
		BossesKilled:  sess.BossesKilledCount,
	}

	safeSummary := make([]string, 0, len(awardedCounts))
	for k, cnt := range awardedCounts {
		safeSummary = append(safeSummary, fmt.Sprintf("%s×%d", ResourceName(k), cnt))
	}
	AppendLog(p, now, "RAID", fmt.Sprintf("【荒原迷失 MIA】未能及时撤离！背囊物资与穿戴装备（%v）全部损毁遗失，仅安全保险箱保住：%v。", lostGear, safeSummary))
	return nil
}
