package domain

import (
	"fmt"
	"time"
)

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
	},
}

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

var EquipmentCatalog = []EquipmentSpec{
	{
		ItemKey:      ResAutoPump,
		Name:         "自动抽水机",
		MaxStack:     5,
		BonusSummary: "打水/伐木 +15%/台",
	},
	{
		ItemKey:      ResAlchCatalyst,
		Name:         "赫尔墨斯催化剂",
		MaxStack:     5,
		BonusSummary: "全岗位 +12%/瓶",
	},
	{
		ItemKey:      ResEnchantScroll,
		Name:         "星界附魔卷轴",
		MaxStack:     5,
		BonusSummary: "采石/军粮 +15%/卷",
	},
	{
		ItemKey:      ResHeavyToolset,
		Name:         "泰坦精锻工具组",
		MaxStack:     5,
		BonusSummary: "伐木/炼铁 +15%/套",
	},
}

func ChooseProfession(p *PlayerState, prof string, now time.Time) error {
	if !p.UnlockedBlueprints[BPMysteryTreasure] {
		return ErrPrecondition("treasure_locked", "必须先开启【神秘的宝藏】才能选择职业")
	}
	if p.Profession != ProfNone {
		return ErrPrecondition("profession_locked", "首次职业选择已锁定，不可反悔")
	}
	var spec *ProfessionSpec
	for i := range ProfessionCatalog {
		if ProfessionCatalog[i].Code == prof {
			spec = &ProfessionCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrInvalidInput("无效的职业代码")
	}
	p.Profession = spec.Code
	p.ArtifactName = spec.ArtifactName
	p.Phase = 3

	// Grant starter batch of profession goods & basic war kits so player can immediately trade or deploy
	switch spec.Code {
	case ProfScientist:
		p.ResourcesMilli[ResAutoPump] += 2 * ResourceScale
	case ProfAlchemist:
		p.ResourcesMilli[ResAlchCatalyst] += 2 * ResourceScale
	case ProfMage:
		p.ResourcesMilli[ResEnchantScroll] += 2 * ResourceScale
	case ProfArtisan:
		p.ResourcesMilli[ResHeavyToolset] += 2 * ResourceScale
	}
	p.ResourcesMilli[ResIronIngot] += 10 * ResourceScale
	p.ResourcesMilli[ResRation] += 12 * ResourceScale
	p.ResourcesMilli[ResInfantryKit] += 6 * ResourceScale
	p.ResourcesMilli[ResArcherKit] += 6 * ResourceScale
	p.ResourcesMilli[ResCavalryKit] += 6 * ResourceScale
	p.ActivityPoints += 120

	AppendLog(p, now, "PROFESSION", fmt.Sprintf("已执掌神器【%s】并就职为【%s】！全球现货交易所、跨职业工坊与七日商会战争已全面开放。", spec.ArtifactName, spec.Name))
	return nil
}

func CraftItem(w *WorldState, p *PlayerState, recipeCode string, batches int32, now time.Time) error {
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		return ErrPrecondition("workshop_locked", "需要先建成【基础工坊】")
	}
	if batches <= 0 {
		batches = 1
	}
	if batches > 20 {
		batches = 20
	}
	var spec *CraftRecipeSpec
	for i := range CraftRecipeCatalog {
		if CraftRecipeCatalog[i].RecipeCode == recipeCode {
			spec = &CraftRecipeCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的制造配方")
	}
	if spec.ProfessionReq != "all" && p.Profession != spec.ProfessionReq {
		return ErrPrecondition("profession_mismatch", fmt.Sprintf("该配方为【%s】独占配方，其他职业请前往现货交易所向该职业玩家采购", spec.ProfessionReqName))
	}

	b64 := int64(batches)
	totalGoldCost := spec.GoldCostBasis * b64
	if p.GoldBasis < totalGoldCost {
		return ErrPrecondition("insufficient_gold", fmt.Sprintf("金币不足：需要 %.4f 金币", float64(totalGoldCost)/float64(GoldScale)))
	}
	for resKey, costMilli := range spec.CostsMilli {
		need := costMilli * b64
		if p.ResourcesMilli[resKey] < need {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.1f，当前 %.1f",
				ResourceName(resKey), float64(need)/1000.0, float64(p.ResourcesMilli[resKey])/1000.0))
		}
	}

	for resKey, costMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= costMilli * b64
	}
	if totalGoldCost > 0 {
		p.GoldBasis -= totalGoldCost
		// System crafting fee: 50% burned, 50% to public treasury
		burn := totalGoldCost / 2
		treasury := totalGoldCost - burn
		w.PermanentlyBurnedBasis += burn
		w.TotalIssuedBasis -= burn
		w.TreasuryHeldBasis += treasury
	}

	outMilli := spec.OutputAmountMilli * b64
	if p.Profession == ProfArtisan && spec.Category == "armament" {
		outMilli = (outMilli * 125) / 100
	}
	p.ResourcesMilli[spec.OutputKey] += outMilli
	AppendLog(p, now, "PRODUCTION", fmt.Sprintf("工坊制造完成：产出 %.1f 单位【%s】。", float64(outMilli)/1000.0, spec.OutputName))
	return nil
}

func InstallEquipment(p *PlayerState, itemKey string, delta int32, now time.Time) error {
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		return ErrPrecondition("workshop_locked", "需要先建成【基础工坊】")
	}
	if delta == 0 {
		return nil
	}
	var spec *EquipmentSpec
	for i := range EquipmentCatalog {
		if EquipmentCatalog[i].ItemKey == itemKey {
			spec = &EquipmentCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("该物品不可作为工坊设备加装")
	}

	cur := p.InstalledEquipments[itemKey]
	if delta > 0 {
		if cur+delta > spec.MaxStack {
			return ErrPrecondition("max_stack_reached", fmt.Sprintf("该设备最多加装 %d 件", spec.MaxStack))
		}
		needMilli := int64(delta) * ResourceScale
		if p.ResourcesMilli[itemKey] < needMilli {
			return ErrPrecondition("insufficient_equipment", fmt.Sprintf("仓库中没有足够的【%s】可供加装，请先制造或在市场购买", ResourceName(itemKey)))
		}
		p.ResourcesMilli[itemKey] -= needMilli
		p.InstalledEquipments[itemKey] = cur + delta
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已在工坊加装 %d 件【%s】（当前 %d/%d）。", delta, spec.Name, cur+delta, spec.MaxStack))
	} else {
		remove := -delta
		if remove > cur {
			remove = cur
		}
		if remove <= 0 {
			return ErrPrecondition("none_installed", "当前未加装该设备")
		}
		p.InstalledEquipments[itemKey] = cur - remove
		p.ResourcesMilli[itemKey] += int64(remove) * ResourceScale
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已从工坊卸下 %d 件【%s】并退回仓库。", remove, spec.Name))
	}
	return nil
}
