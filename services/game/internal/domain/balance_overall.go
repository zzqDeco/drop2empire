package domain

const (
	// ResourceScale represents 1.000 physical resource unit = 1,000 milli-units.
	ResourceScale int64 = 1000
	// GoldScale represents 1.0000 Gold unit = 10,000 basis-units.
	GoldScale int64 = 10000
	// OfflineCapSeconds caps a single offline production catch-up at 8 hours.
	OfflineCapSeconds int64 = 8 * 3600
	// DailyWarBudgetCap is the per-member daily armament deployment cap.
	DailyWarBudgetCap int32 = 100
	// MarketTaxBps is 1.00% (100 bps) on spot trades: 0.50% burned, 0.50% to public treasury.
	MarketTaxBps int64 = 100
	// MarketBurnShareBps is 50 bps (half of the 100 bps tax).
	MarketBurnShareBps int64 = 50
	// ChestRedeemCostPoints is the Activity Points required to redeem 1 Season Chest.
	ChestRedeemCostPoints int32 = 100
)

// OverallBalance centralizes cross-season global parameters, initial monetary supply bootstrap,
// and account lifecycle caps.
var OverallBalance = struct {
	TreasuryInitialGoldBasis int64
	NPCInitialGoldBasis      int64
	MaxEventLogEntries       int
	InviteExpireDays         int

	// Pre-seeded veteran demo account parameters:
	VeteranPopulationTotal int32
	VeteranPhase           int32
	VeteranActivityPoints  int32
	VeteranGrantGoldBasis  int64
	VeteranSimElapsedSec   int64
	VeteranWorkers         map[string]int32
	VeteranBuildings       map[string]int32
	VeteranResourcesUnits  map[string]int64
	VeteranInstalledEquips map[string]int32
}{
	TreasuryInitialGoldBasis: 5_000_000 * GoldScale,
	NPCInitialGoldBasis:      2_000_000 * GoldScale,
	MaxEventLogEntries:       40,
	InviteExpireDays:         7,

	VeteranPopulationTotal: 45,
	VeteranPhase:           3,
	VeteranActivityPoints:  260,
	VeteranGrantGoldBasis:  1850 * GoldScale,
	VeteranSimElapsedSec:   2400,
	VeteranWorkers: map[string]int32{
		JobWater:      18,
		JobWood:       12,
		JobStone:      8,
		JobSmeltIron:  4,
		JobPrepRation: 3,
	},
	VeteranBuildings: map[string]int32{
		BuildingLumberCamp: 4,
		BuildingHouse:      11,
		BPWaterCistern:     15,
		BPLumberYard:       10,
		BuildingQuarry:     3,
		BPCharcoalKiln:     2,
		BPColonyEdicts:     1,
		BuildingCaravan:    1,
		BPWaterWheel1:      1,
		BPSiphonSluice:     1,
		BPBasicWorkshop:    1,
		BPScoutCamp:        1,
	},
	VeteranResourcesUnits: map[string]int64{
		ResWater:           12500,
		ResWood:            4800,
		ResStone:           2100,
		ResIronIngot:       28,
		ResRation:          36,
		ResAutoPump:        3,
		ResInfantryKit:     16,
		ResArcherKit:       12,
		ResCavalryKit:      10,
		ResSeasonChest:     2,
		ResFlint:           14,
		ResAncientShard:    5,
		ResMeteorOre:       2,
		ResBPCrossbow:      1,
		ResBPSpringBoots:   1,
		ResCosSteamCrown:   1,
		ResCosHydroWings:   1,
		ResCosAlchLantern:  1,
		ResCosMechOwl:      1,
	},
	VeteranInstalledEquips: map[string]int32{
		ResAutoPump:     2,
		ResAlchCatalyst: 1,
	},
}
