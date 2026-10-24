package domain

import (
	"fmt"
	"math/big"
	"time"
)

func FindBuilding(code string) (BuildingSpec, bool) {
	for _, b := range BuildingCatalog {
		if b.Code == code {
			return b, true
		}
	}
	return BuildingSpec{}, false
}

func FindTechnology(code string) (TechnologySpec, bool) {
	for _, t := range TechnologyCatalog {
		if t.Code == code {
			return t, true
		}
	}
	return TechnologySpec{}, false
}

func HousingCapacity(p *PlayerState) int32 {
	return InitialHousing + p.BuildingCounts[BuildingHouse]*4
}

func JobCapacity(p *PlayerState, job string) int32 {
	if p.PopulationTotal <= 0 {
		return 0
	}
	switch job {
	case JobWater:
		return p.PopulationTotal
	case JobForage:
		return 1
	case JobSmeltIron, JobPrepRation:
		if p.UnlockedBlueprints[BPBasicWorkshop] && p.Profession != ProfNone {
			return p.PopulationTotal
		}
		return 0
	}
	var slots int32
	for _, b := range BuildingCatalog {
		if b.JobKey == job {
			slots += p.BuildingCounts[b.Code] * b.Slots
		}
	}
	return slots
}

// Exact rational escalation; round once per resource per building, never compound
// a rounded previous price. Bound prices below JavaScript's safe integer range.
func BuildingCosts(b BuildingSpec, owned, quantity int32) (map[string]int64, error) {
	if owned < 0 || quantity < 1 || quantity > 20 || int64(owned)+int64(quantity) > int64(b.Limit) {
		return nil, ErrPrecondition("building_limit", "已达到设施数量上限，或建造数量无效")
	}
	costs := map[string]int64{}
	const maxCost int64 = 9_000_000_000_000_000
	for k, base := range b.CostsMilli {
		for n := owned; n < owned+quantity; n++ {
			num := new(big.Int).Exp(big.NewInt(5), big.NewInt(int64(n)), nil)
			den := new(big.Int).Exp(big.NewInt(4), big.NewInt(int64(n)), nil)
			if b.Limit == 1 {
				num.SetInt64(1)
				den.SetInt64(1)
			}
			num.Mul(num, big.NewInt(base/ResourceScale))
			num.Add(num, new(big.Int).Sub(den, big.NewInt(1)))
			num.Quo(num, den).Mul(num, big.NewInt(ResourceScale))
			if !num.IsInt64() || num.Int64() > maxCost-costs[k] {
				return nil, ErrPrecondition("cost_limit", "设施成本超过本阶段可建设范围")
			}
			costs[k] += num.Int64()
		}
	}
	return costs, nil
}

func CostsBlockReason(p *PlayerState, costs map[string]int64) string {
	for _, key := range []string{ResWater, ResWood, ResStone, ResCharcoal, ResFlint, ResAncientShard} {
		need := costs[key]
		if p.ResourcesMilli[key] >= need {
			continue
		}
		if cap := ResourceCapacityMilli(p, key); cap > 0 && need > cap {
			return fmt.Sprintf("%s仓容不足，请先扩仓", ResourceName(key))
		}
		return fmt.Sprintf("缺少 %.1f %s", float64(need-p.ResourcesMilli[key])/float64(ResourceScale), ResourceName(key))
	}
	return ""
}

func TechnologyAvailable(p *PlayerState, t TechnologySpec) bool {
	return p.PopulationTotal > 0 && (t.PrerequisiteCode == "" || p.UnlockedBlueprints[t.PrerequisiteCode])
}

func BuildingAvailable(p *PlayerState, b BuildingSpec) bool {
	return p.PopulationTotal > 0 && p.ResearchedTechnologies[b.TechnologyCode] && (b.PrerequisiteCode == "" || p.UnlockedBlueprints[b.PrerequisiteCode])
}

func BlueprintPrerequisitesMet(p *PlayerState, b BlueprintSpec) bool {
	if p.PopulationTotal < b.RequiredPopulation || (b.PrerequisiteCode != "" && !p.UnlockedBlueprints[b.PrerequisiteCode]) {
		return false
	}
	for _, code := range b.RequiredCodes {
		if !p.UnlockedBlueprints[code] {
			return false
		}
	}
	return true
}

// Sequenced commands make a lost response safe to retry, and fence stale tabs.
// Only the most recent receipt replays; older requests fail closed, including
// across resets (the sequence is retained when resetting seasonal progress).
func settlementCommand(p *PlayerState, seq int64, signature string, apply func() error) error {
	if seq > 0 && seq == p.SettlementCommandSeq && signature == p.LastSettlementCommand {
		return nil
	}
	if seq <= 0 || seq != p.SettlementCommandSeq+1 {
		return ErrPrecondition("settlement_sequence_conflict", "建设状态已变化，请同步后重试")
	}
	if err := apply(); err != nil {
		return err
	}
	p.SettlementCommandSeq, p.LastSettlementCommand = seq, signature
	RefreshSettlementDiscovery(p)
	return nil
}

func ResearchTechnology(p *PlayerState, code string, seq int64, now time.Time) error {
	return settlementCommand(p, seq, "research:"+code, func() error {
		t, ok := FindTechnology(code)
		if !ok {
			return ErrNotFound("未知的聚落技术")
		}
		if p.ResearchedTechnologies[code] {
			return ErrPrecondition("already_researched", "已掌握这项技术")
		}
		if !TechnologyAvailable(p, t) {
			return ErrPrecondition("technology_locked", "尚未达到这项技术的前置里程碑")
		}
		if reason := CostsBlockReason(p, t.CostsMilli); reason != "" {
			return ErrPrecondition("insufficient_resource", reason)
		}
		for key, cost := range t.CostsMilli {
			p.ResourcesMilli[key] -= cost
		}
		p.ResearchedTechnologies[code] = true
		AppendLog(p, now, "BLUEPRINT", "已掌握【"+t.Name+"】，可花费材料建造对应设施。")
		return nil
	})
}

func ConstructBuilding(p *PlayerState, code string, quantity int32, seq int64, now time.Time) error {
	return settlementCommand(p, seq, fmt.Sprintf("build:%s:%d", code, quantity), func() error {
		b, ok := FindBuilding(code)
		if !ok {
			return ErrNotFound("未知的聚落设施")
		}
		if !BuildingAvailable(p, b) {
			return ErrPrecondition("building_locked", "请先研究技术并完成前置建设")
		}
		costs, err := BuildingCosts(b, p.BuildingCounts[code], quantity)
		if err != nil {
			return err
		}
		if reason := CostsBlockReason(p, costs); reason != "" {
			return ErrPrecondition("insufficient_resource", reason)
		}
		for key, cost := range costs {
			p.ResourcesMilli[key] -= cost
		}
		p.BuildingCounts[code] += quantity
		if b.EffectCode != "" {
			p.UnlockedBlueprints[b.EffectCode] = true
		}
		AppendLog(p, now, "BUILDING", fmt.Sprintf("建成 %d 座【%s】（现有 %d 座）：%s。", quantity, b.Name, p.BuildingCounts[code], b.EffectSummary))
		return nil
	})
}

func RefreshSettlementDiscovery(p *PlayerState) {
	if p.DiscoveredResources == nil {
		p.DiscoveredResources = map[string]bool{}
	}
	p.DiscoveredResources[ResWater] = true
	if p.PopulationTotal > 0 {
		p.DiscoveredResources[ResWood] = true
	}
	for k, v := range p.ResourcesMilli {
		if v > 0 || p.FrozenResourcesMilli[k] > 0 {
			p.DiscoveredResources[k] = true
		}
	}
}

func CaravanOfferVisible(p *PlayerState, offer CaravanOfferSpec) bool {
	for key := range offer.CostsMilli {
		if !p.DiscoveredResources[key] {
			return false
		}
	}
	for key := range offer.RewardsMilli {
		if !p.DiscoveredResources[key] {
			return false
		}
	}
	return true
}

func ResetSettlementProgress(p *PlayerState) {
	p.ResearchedTechnologies = map[string]bool{}
	p.BuildingCounts = map[string]int32{}
	p.DiscoveredResources = map[string]bool{ResWater: true}
	p.SettlementCommandSeq++
	p.LastSettlementCommand = ""
}

func EnsureSettlementState(p *PlayerState) {
	if p.ResearchedTechnologies == nil {
		p.ResearchedTechnologies = map[string]bool{}
	}
	if p.BuildingCounts == nil {
		p.BuildingCounts = map[string]int32{}
	}
	for _, b := range BuildingCatalog {
		if p.BuildingCounts[b.Code] > 0 && b.EffectCode != "" {
			p.UnlockedBlueprints[b.EffectCode] = true
		}
	}
	RefreshSettlementDiscovery(p)
}

type SettlementGuide struct{ Code, Title, Text string }

func CurrentSettlementGuide(p *PlayerState) SettlementGuide {
	switch {
	case p.Profession != ProfNone:
		return SettlementGuide{"empire", "专精与帝国", "已择定终身职业。可在工坊制造专精物资，或前往世界舆图参与现货交易、商会战区与荒原探索。"}
	case p.UnlockedBlueprints[BPMysteryTreasure]:
		return SettlementGuide{"trade", "专精与贸易", "古代装置已经复苏。了解四个职业的产品与分工，选择自己的长期生产方向。"}
	case p.UnlockedBlueprints[BPBasicWorkshop]:
		return SettlementGuide{"assembly", "装配古代装置", "工坊已建成。三个工程部件可以按任意顺序制造，各自完成立即提升产能；全部完成后装配。"}
	case p.UnlockedBlueprints[BPCharcoalKiln]:
		return SettlementGuide{"industry", "产线相互连接", "木材用于建设，也用于烧炭。可以改善水利、筹备工坊，或建设斥候营探索荒原。"}
	case p.UnlockedBlueprints[BPQuarryTech]:
		return SettlementGuide{"stone", "石材加入建设", "采石场已经落成。安排居民采石，研究烧炭技术；住房、岗位与仓容都可以继续扩张。"}
	case p.UnlockedBlueprints[BPAxeBlueprint]:
		return SettlementGuide{"expansion", "经营开始展开", "伐木棚已经落成，安排居民才会生产木材。接下来可以扩建住房、仓储，或研究采石。"}
	case p.ResearchedTechnologies[TechWoodworking]:
		return SettlementGuide{"first_build", "把知识变成设施", "已掌握基础木工。安排一名居民拾枝，按建设区显示的材料成本建造第一座伐木棚。"}
	default:
		return SettlementGuide{"first_technology", "第一位居民", "居民已开始自动取水。研究基础木工，安排拾枝，逐步建立木材生产。初始营地可容纳四人。"}
	}
}
