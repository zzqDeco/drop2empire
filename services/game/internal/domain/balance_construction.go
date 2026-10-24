package domain

const (
	SettlementRulesVersion int32 = 2
	InitialHousing         int32 = 4
	MaxBuildingCount       int32 = 128
	TechWoodworking              = "woodworking"
	TechMining                   = "mining"
	TechCharcoal                 = "charcoal"
	TechHydraulics               = "hydraulics"
	TechMechanics                = "mechanics"
	BuildingLumberCamp           = "lumber_camp"
	BuildingHouse                = "house"
	BuildingQuarry               = "quarry"
	BuildingCaravan              = "caravan_post"
)

type TechnologySpec struct {
	Code, Name, PrerequisiteCode, EffectSummary string
	CostsMilli                                  map[string]int64
}

type BuildingSpec struct {
	Code, Name, TechnologyCode, PrerequisiteCode, EffectCode, JobKey, EffectSummary string
	CostsMilli                                                                      map[string]int64
	CapacityUnits                                                                   map[string]int64
	Slots, Housing, Limit                                                           int32
}

// Costs are physical materials in milli-units. Knowledge never supplies a building.
var TechnologyCatalog = []TechnologySpec{
	{TechWoodworking, "基础木工", "", "开放伐木棚、木屋、蓄水池与物资堆场的建造", resourceCosts(20, 0, 0, 0)},
	{TechMining, "采石技术", BPAxeBlueprint, "开放采石场的建造", resourceCosts(40, 10, 0, 0)},
	{TechCharcoal, "烧炭技术", BPQuarryTech, "开放炭窑的建造", resourceCosts(40, 10, 0, 0)},
	{TechHydraulics, "水利技术", BPQuarryTech, "开放水轮与虹吸冲矿槽的建造", resourceCosts(80, 20, 10, 0)},
	{TechMechanics, "机械装配", BPCharcoalKiln, "开放基础工坊与工程装配", resourceCosts(150, 40, 20, 0)},
}

var BuildingCatalog = []BuildingSpec{
	{Code: BuildingLumberCamp, Name: "伐木棚", TechnologyCode: TechWoodworking, EffectCode: BPAxeBlueprint, JobKey: JobWood, Slots: 3, Limit: MaxBuildingCount, CostsMilli: resourceCosts(20, 10, 0, 0), EffectSummary: "新增 3 个伐木岗位；安排居民后生产木材"},
	{Code: BuildingHouse, Name: "木屋", TechnologyCode: TechWoodworking, Housing: 4, Limit: MaxBuildingCount, CostsMilli: resourceCosts(30, 15, 0, 0), EffectSummary: "住宿容量 +4；招募居民仍需支付饮水"},
	{Code: BPWaterCistern, Name: "蓄水池", TechnologyCode: TechWoodworking, EffectCode: BPWaterCistern, Limit: MaxBuildingCount, CostsMilli: resourceCosts(60, 25, 0, 0), CapacityUnits: map[string]int64{ResWater: 500}, EffectSummary: "净水仓储容量 +500"},
	{Code: BPLumberYard, Name: "物资堆场", TechnologyCode: TechWoodworking, EffectCode: BPLumberYard, Limit: MaxBuildingCount, CostsMilli: resourceCosts(40, 40, 0, 0), CapacityUnits: map[string]int64{ResWood: 300, ResStone: 200, ResCharcoal: 100}, EffectSummary: "木材仓容 +300、石材 +200、木炭 +100"},
	{Code: BuildingQuarry, Name: "采石场", TechnologyCode: TechMining, EffectCode: BPQuarryTech, JobKey: JobStone, Slots: 3, Limit: MaxBuildingCount, CostsMilli: resourceCosts(60, 30, 0, 0), EffectSummary: "新增 3 个采石岗位；首座不消耗石材"},
	{Code: BPCharcoalKiln, Name: "炭窑", TechnologyCode: TechCharcoal, EffectCode: BPCharcoalKiln, JobKey: JobCharcoal, Slots: 2, Limit: MaxBuildingCount, CostsMilli: resourceCosts(60, 30, 20, 0), EffectSummary: "新增 2 个烧炭岗位；每人消耗 0.30 木/秒，生产 0.28 炭/秒"},
	{Code: BPColonyEdicts, Name: "议事所", TechnologyCode: TechWoodworking, PrerequisiteCode: BPQuarryTech, EffectCode: BPColonyEdicts, Limit: 1, CostsMilli: resourceCosts(80, 40, 10, 0), EffectSummary: "开放篝火夜班与节水配给政令"},
	{Code: BuildingCaravan, Name: "游商驿站", TechnologyCode: TechWoodworking, PrerequisiteCode: BPAxeBlueprint, Limit: 1, CostsMilli: resourceCosts(80, 40, 0, 0), EffectSummary: "开放已认识物资的应急易物"},
	{Code: BPWaterWheel1, Name: "木制引水轮", TechnologyCode: TechHydraulics, EffectCode: BPWaterWheel1, Limit: 1, CostsMilli: resourceCosts(200, 80, 40, 0), EffectSummary: "取水效率 +25%；开放水压锯木机关"},
	{Code: BPSiphonSluice, Name: "虹吸冲矿槽", TechnologyCode: TechHydraulics, PrerequisiteCode: BPWaterWheel1, EffectCode: BPSiphonSluice, Limit: 1, CostsMilli: resourceCosts(200, 80, 40, 0), EffectSummary: "开启机关后，将净水满仓溢出量转为石材和燧石"},
	{Code: BPBasicWorkshop, Name: "基础工坊", TechnologyCode: TechMechanics, EffectCode: BPBasicWorkshop, Limit: 1, CostsMilli: resourceCosts(400, 180, 100, 40), EffectSummary: "开放三个并行工程部件；毕业后开放职业制造"},
	{Code: BPScoutCamp, Name: "荒原斥候营", TechnologyCode: TechCharcoal, PrerequisiteCode: BPCharcoalKiln, EffectCode: BPScoutCamp, Limit: 1, CostsMilli: resourceCosts(200, 100, 40, 20), EffectSummary: "开放可选的荒原探索与装备整备"},
}

func resourceCosts(water, wood, stone, charcoal int64) map[string]int64 {
	out := map[string]int64{}
	for k, v := range map[string]int64{ResWater: water, ResWood: wood, ResStone: stone, ResCharcoal: charcoal} {
		if v > 0 {
			out[k] = v * ResourceScale
		}
	}
	return out
}
