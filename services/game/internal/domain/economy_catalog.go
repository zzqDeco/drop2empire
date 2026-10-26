package domain

// S1 supply graph. Reference prices are planning hints, never executable quotes.
var CompanyCatalog = []CompanySpec{
	{"alloy", "澜川合金", "高压烧结核心", ResConductiveAlloy, 10, 245000, []CompanyRecipe{
		{"standard", units(ResIronIngot, 40, ResCharcoal, 30, ResStone, 20, ResWater, 100), 1800},
	}},
	{"crystal", "星砂晶材", "晶格共振炉", ResStableCrystal, 10, 275000, []CompanyRecipe{
		{"standard", units(ResIronIngot, 20, ResFlint, 30, ResStone, 60, ResWater, 160), 1800},
	}},
	{"heavy", "赤炉机造", "巨型铸压机组", ResHeavyUnit, 4, 610000, []CompanyRecipe{
		{"standard", units(ResConductiveAlloy, 6, ResIronIngot, 10, ResCharcoal, 10, ResWater, 40), 1800},
		{"alternative", units(ResStableCrystal, 4, ResIronIngot, 16, ResCharcoal, 16, ResWater, 40), 2700},
	}},
	{"control", "星衡控制", "精密刻控阵列", ResPrecisionUnit, 4, 505000, []CompanyRecipe{
		{"standard", units(ResStableCrystal, 4, ResIronIngot, 6, ResFlint, 10, ResWater, 40), 1800},
		{"alternative", units(ResConductiveAlloy, 6, ResIronIngot, 10, ResFlint, 16, ResWater, 40), 2700},
	}},
	{"works", "岩筑工务", "重载集成设施", ResHeavyPack, 10, 495000, []CompanyRecipe{
		{"standard", units(ResHeavyUnit, 4, ResStone, 100, ResWood, 60, ResCharcoal, 20), 2700},
		{"alternative", units(ResPrecisionUnit, 6, ResStone, 120, ResWood, 80, ResCharcoal, 25), 3600},
	}},
	{"precision", "云衡精工", "精密集成设施", ResPrecisionPack, 10, 505000, []CompanyRecipe{
		{"standard", units(ResPrecisionUnit, 4, ResIronIngot, 40, ResFlint, 20, ResWood, 30), 2700},
		{"alternative", units(ResHeavyUnit, 6, ResIronIngot, 60, ResFlint, 30, ResWood, 40), 3600},
	}},
}

func companyRecipe(s CompanySpec, route string) (CompanyRecipe, bool) {
	for _, r := range s.Recipes {
		if r.Route == route {
			return r, true
		}
	}
	return CompanyRecipe{}, false
}
func isCorporateGood(key string) bool {
	for _, s := range CompanyCatalog {
		if s.Output == key {
			return true
		}
	}
	return false
}

func init() {
	for _, s := range CompanyCatalog {
		ResourceCatalog = append(ResourceCatalog, ResourceMeta{Key: s.Output, Name: map[string]string{
			ResConductiveAlloy: "导能合金", ResStableCrystal: "稳定晶材", ResHeavyUnit: "重载单元", ResPrecisionUnit: "精密单元", ResHeavyPack: "重载作业包", ResPrecisionPack: "精密作业包",
		}[s.Output], Tier: "corporate", Description: s.Name + "专有产线制造，可自由交易", Tradable: true, InitPriceBasis: s.ReferencePrice})
	}
}
