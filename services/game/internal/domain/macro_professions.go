package domain

import (
	"fmt"
	"time"
)

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

	// Grant starter batch of profession goods & basic war kits from declarative table
	for resKey, units := range spec.StarterGrantUnits {
		p.ResourcesMilli[resKey] += units * ResourceScale
	}
	for resKey, milli := range MacroBalance.StarterUniversalGrants {
		p.ResourcesMilli[resKey] += milli
	}
	p.ActivityPoints += MacroBalance.StarterActivityPoints

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
	if batches > MacroBalance.MaxCraftBatchesPerReq {
		batches = MacroBalance.MaxCraftBatchesPerReq
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
	if spec.Category == "armament" {
		for _, profSpec := range ProfessionCatalog {
			if profSpec.Code == p.Profession && profSpec.ArmamentOutputMultPct > 100 {
				outMilli = (outMilli * profSpec.ArmamentOutputMultPct) / 100
				break
			}
		}
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
