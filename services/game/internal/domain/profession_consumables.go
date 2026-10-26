package domain

import (
	"fmt"
	"time"
)

const (
	ResOverload      = "overload_battery"
	ResDetector      = "portable_detector"
	ResCalibration   = "fire_control_pack"
	ResCatalyst      = "industrial_catalyst"
	ResRecovery      = "recovery_potion"
	ResMedic         = "field_medkit"
	ResSigil         = "direction_sigil"
	ResBlink         = "blink_scroll"
	ResWard          = "defense_ward"
	ResFineTool      = "fine_tool"
	ResBreach        = "breach_tool"
	ResFortification = "fortification_pack"
)

type ProfessionalState struct {
	Level             int32              `json:"level"`
	Queue             *ProfessionalBatch `json:"queue,omitempty"`
	ProductionMode    string             `json:"productionMode"`
	ProductionCharges int32              `json:"productionCharges"`
	ConstructionTool  bool               `json:"constructionTool"`
	GuildTool         bool               `json:"guildTool"`
	SigilSeconds      int64              `json:"sigilSeconds"`
}
type ProfessionalBatch struct {
	Item             string `json:"item"`
	Output           int64  `json:"output"`
	RemainingSeconds int64  `json:"remainingSeconds"`
}
type ConsumableSpec struct {
	Key, Name, Profession, Use, Effect string
	Inputs                             map[string]int64
	Output                             int64
	Seconds                            int64
}

var ConsumableCatalog = []ConsumableSpec{
	{ResOverload, "过载电池", ProfScientist, "production", "接下来 5 批职业制造时间 -20%，用水 +20%；与触媒互斥", units(ResWater, 20, ResIronIngot, 8, ResCharcoal, 6), 5, 120},
	{ResDetector, "便携探测器", ProfScientist, "raid", "本次远征扫描身边 4 格；每局限用一次", units(ResWood, 15, ResIronIngot, 3, ResFlint, 2), 1, 90},
	{ResCalibration, "火控校准包", ProfScientist, "war", "指定节点的己方军队本轮不利克制惩罚减半", units(ResIronIngot, 12, ResWood, 6, ResFlint, 8), 2, 180},
	{ResCatalyst, "工业触媒", ProfAlchemist, "production", "接下来 5 批职业制造普通原料 -10%；与电池互斥", units(ResWater, 60, ResCharcoal, 10, ResFlint, 4), 5, 120},
	{ResRecovery, "恢复药剂", ProfAlchemist, "raid", "回复 30 点生命；每局限用一次", units(ResWater, 20, ResRation, 2, ResFlint, 1), 2, 90},
	{ResMedic, "战地救护包", ProfAlchemist, "war", "指定节点的己方军队本轮战损率 -5 个百分点", units(ResWater, 60, ResRation, 8, ResCharcoal, 4), 2, 180},
	{ResSigil, "定向符印", ProfMage, "settlement", "有采石工时持续 600 秒：石材 -20%，采石伴生物 +50%", units(ResWood, 8, ResFlint, 6, ResAncientShard, 1), 3, 120},
	{ResBlink, "闪步卷轴", ProfMage, "raid", "沿指定方向瞬移 2 格，仅限已探索的安全通道；每局一次", units(ResWood, 4, ResFlint, 3), 1, 90},
	{ResWard, "守城结界", ProfMage, "war", "指定己方节点本轮防御 +8%，不能叠加", units(ResWood, 10, ResFlint, 10, ResAncientShard, 2), 2, 180},
	{ResFineTool, "精锻刀具", ProfArtisan, "construction", "下一次已建设施的重复建设普通材料 -10%，只覆盖 1 座", units(ResIronIngot, 8, ResWood, 8, ResCharcoal, 4), 2, 120},
	{ResBreach, "破障工具", ProfArtisan, "raid", "缩短当前未完成宝箱读条剩余时间 40%；每局一次", units(ResIronIngot, 3, ResWood, 6), 1, 90},
	{ResFortification, "工事包", ProfArtisan, "guild", "下一次公会后勤建设普通材料 -8%，消耗后生效", units(ResIronIngot, 12, ResWood, 20, ResStone, 30), 20, 180},
}

func init() {
	for _, s := range ConsumableCatalog {
		inputCost := int64(0)
		for _, raw := range ResourceCatalog {
			inputCost += s.Inputs[raw.Key] / ResourceScale * raw.InitPriceBasis
		}
		reference := max(int64(100), (inputCost+s.Output-1)/s.Output*120/100)
		ResourceCatalog = append(ResourceCatalog, ResourceMeta{Key: s.Key, Name: s.Name, Tier: "consumable", Description: s.Effect, Tradable: true, InitPriceBasis: reference})
		CraftRecipeCatalog = append(CraftRecipeCatalog, CraftRecipeSpec{RecipeCode: s.Key, Name: s.Name, Category: "consumable", ProfessionReq: s.Profession, ProfessionReqName: map[string]string{ProfScientist: "科学家", ProfAlchemist: "炼金师", ProfMage: "魔法师", ProfArtisan: "工匠"}[s.Profession], OutputKey: s.Key, OutputName: s.Name, OutputAmountMilli: s.Output * 1000, CostsMilli: s.Inputs, EffectSummary: s.Effect})
	}
}
func FindConsumable(key string) (ConsumableSpec, bool) {
	for _, s := range ConsumableCatalog {
		if s.Key == key {
			return s, true
		}
	}
	return ConsumableSpec{}, false
}
func EnsureProfessional(p *PlayerState) *ProfessionalState {
	if p.Professional == nil {
		p.Professional = &ProfessionalState{}
	}
	return p.Professional
}
func ProfessionFacilityName(prof string, level int32) string {
	names := map[string][2]string{ProfScientist: {"机巧工坊", "动力实验室"}, ProfAlchemist: {"蒸馏工坊", "催化实验室"}, ProfMage: {"铭文工坊", "符阵工场"}, ProfArtisan: {"精锻工坊", "工程装配坊"}}
	pair, ok := names[prof]
	if !ok {
		return "职业工坊"
	}
	if level >= 2 {
		return pair[1]
	}
	return pair[0]
}
func ProfessionFacilityCosts(level int32, pack string) map[string]int64 {
	costs := units(ResWater, 500, ResWood, 250, ResStone, 180, ResIronIngot, 40, ResCharcoal, 30)
	if level >= 1 {
		for k, n := range costs {
			costs[k] = n * 3
		}
		if pack == ResHeavyPack || pack == ResPrecisionPack {
			for k, n := range costs {
				costs[k] = n * 8 / 10
			}
			costs[pack] = 4 * 1000
		}
	}
	return costs
}
func BuildProfessionFacility(p *PlayerState, pack string, now time.Time) error {
	ps := EnsureProfessional(p)
	if p.Profession == ProfNone || !p.UnlockedBlueprints[BPBasicWorkshop] {
		return ErrPrecondition("profession_required", "先选择职业并建成基础工坊")
	}
	if ps.Level >= 2 {
		return ErrPrecondition("facility_limit", "已达到本期职业设施上限")
	}
	if pack != "" && (ps.Level == 0 || (pack != ResHeavyPack && pack != ResPrecisionPack)) {
		return ErrInvalidInput("首建不需要作业包，升级可选择一条替代材料路线")
	}
	costs := ProfessionFacilityCosts(ps.Level, pack)
	if err := payResources(p, costs); err != nil {
		return err
	}
	ps.Level++
	AppendLog(p, now, "BUILDING", "建成"+ProfessionFacilityName(p.Profession, ps.Level))
	return nil
}
func payResources(p *PlayerState, costs map[string]int64) error {
	for _, k := range sortedKeys(costs) {
		if p.ResourcesMilli[k] < costs[k] {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足", ResourceName(k)))
		}
	}
	for k, n := range costs {
		p.ResourcesMilli[k] -= n
	}
	return nil
}

func QueueProfessionalCraft(p *PlayerState, key string, batches int32, now time.Time) error {
	s, ok := FindConsumable(key)
	if !ok {
		return ErrNotFound("未知的职业耗材")
	}
	ps := EnsureProfessional(p)
	if p.Profession != s.Profession {
		return ErrPrecondition("profession_mismatch", "只有对应职业能够制造，所有职业均可购买使用")
	}
	if ps.Level == 0 {
		return ErrPrecondition("facility_required", "请先支付材料建造职业工坊")
	}
	if ps.Queue != nil {
		return ErrPrecondition("line_busy", "个人产线正在制造")
	}
	if batches < 1 || batches > 20 {
		return ErrInvalidInput("制造批次需在 1–20 之间")
	}
	costs := map[string]int64{}
	duration := int64(0)
	charges := ps.ProductionCharges
	for i := int32(0); i < batches; i++ {
		seconds := s.Seconds
		if ps.Level == 2 {
			seconds = seconds * 8 / 10
		}
		for k, n := range s.Inputs {
			if charges > 0 {
				if ps.ProductionMode == ResCatalyst {
					n = (n*9 + 9) / 10
				}
				if ps.ProductionMode == ResOverload && k == ResWater {
					n = (n*12 + 9) / 10
				}
			}
			costs[k] += n
		}
		if charges > 0 {
			if ps.ProductionMode == ResOverload {
				seconds = seconds * 8 / 10
			}
			charges--
		}
		duration += seconds
	}
	if err := payResources(p, costs); err != nil {
		return err
	}
	ps.ProductionCharges = charges
	if charges == 0 {
		ps.ProductionMode = ""
	}
	ps.Queue = &ProfessionalBatch{Item: key, Output: s.Output * int64(batches) * 1000, RemainingSeconds: duration}
	return nil
}
func advanceProfessional(p *PlayerState) {
	ps := p.Professional
	if ps == nil {
		return
	}
	if ps.Queue != nil {
		ps.Queue.RemainingSeconds--
		if ps.Queue.RemainingSeconds <= 0 {
			p.ResourcesMilli[ps.Queue.Item] += ps.Queue.Output
			ps.Queue = nil
		}
	}
	if ps.SigilSeconds > 0 && p.Workers[JobStone] > 0 {
		ps.SigilSeconds--
	}
}

func UseConsumable(w *WorldState, p *PlayerState, key, target string, now time.Time) error {
	s, ok := FindConsumable(key)
	if !ok {
		return ErrNotFound("未知的耗材")
	}
	if p.ResourcesMilli[key] < 1000 {
		return ErrPrecondition("insufficient_resource", "库存中没有该耗材")
	}
	ps := EnsureProfessional(p)
	switch s.Use {
	case "production":
		if ps.Level == 0 || ps.ProductionCharges > 0 || ps.Queue != nil {
			return ErrPrecondition("production_mode_locked", "需空闲职业产线且没有剩余耗材效果")
		}
		ps.ProductionMode = key
		ps.ProductionCharges = 5
	case "construction":
		if ps.ConstructionTool {
			return ErrPrecondition("effect_active", "已有待使用刀具")
		}
		ps.ConstructionTool = true
	case "guild":
		if p.JoinedGuildID == "" || ps.GuildTool {
			return ErrPrecondition("guild_required", "需加入公会且没有待使用工事包")
		}
		ps.GuildTool = true
	case "settlement":
		if ps.SigilSeconds > 0 || p.Workers[JobStone] <= 0 {
			return ErrPrecondition("sigil_unavailable", "需要采石工且不能叠加符印")
		}
		ps.SigilSeconds = 600
	case "war":
		if p.JoinedGuildID == "" {
			return ErrPrecondition("guild_required", "需要加入公会")
		}
		var node *WarNodeState
		for i := range w.WarNodes {
			if w.WarNodes[i].NodeID == target {
				node = &w.WarNodes[i]
				break
			}
		}
		if node == nil || node.PlayerDeployed[p.Handle].Total() == 0 {
			return ErrPrecondition("deployment_required", "只能支援自己已出兵的节点")
		}
		if key == ResWard && node.OwnerGuild != p.GuildCode {
			return ErrPrecondition("friendly_node_required", "结界只能用于己方城防")
		}
		if node.Consumables == nil {
			node.Consumables = map[string]bool{}
		}
		flag := p.GuildCode + ":" + key
		if node.Consumables[flag] {
			return ErrPrecondition("effect_active", "本节点本方已有相同效果")
		}
		node.Consumables[flag] = true
	default:
		return ErrPrecondition("raid_action_required", "在远征内使用，并提交远征指令序号")
	}
	p.ResourcesMilli[key] -= 1000
	AppendLog(p, now, "CONSUMABLE", "已使用"+s.Name)
	return nil
}
