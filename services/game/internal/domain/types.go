package domain

import (
	"context"
	"time"
)

const (
	// ResourceScale represents 1.000 physical resource unit = 1,000 milli-units.
	ResourceScale int64 = 1000
	// GoldScale represents 1.0000 Gold unit = 10,000 basis-units.
	GoldScale int64 = 10000
	// OfflineCapSeconds caps a single offline production catch-up at 8 hours (GDD 6.4).
	OfflineCapSeconds int64 = 8 * 3600
	// DailyWarBudgetCap is the per-member daily armament deployment cap (GDD 10.5).
	DailyWarBudgetCap int32 = 100
	// MarketTaxBps is 1.00% (100 bps) on spot trades: 0.50% burned, 0.50% to public treasury (GDD 7.4).
	MarketTaxBps int64 = 100
	// MarketBurnShareBps is 50 bps (half of the 100 bps tax).
	MarketBurnShareBps int64 = 50
	// ChestRedeemCostPoints is the Activity Points required to redeem 1 Season Chest (GDD 11.1).
	ChestRedeemCostPoints int32 = 100
)

// Resource keys.
const (
	ResWater         = "water"
	ResWood          = "wood"
	ResStone         = "stone"
	ResIronIngot     = "iron_ingot"
	ResRation        = "ration"
	ResAutoPump      = "auto_pump"
	ResAlchCatalyst  = "alch_catalyst"
	ResEnchantScroll = "enchant_scroll"
	ResHeavyToolset  = "heavy_toolset"
	ResInfantryKit   = "infantry_kit"
	ResArcherKit     = "archer_kit"
	ResCavalryKit    = "cavalry_kit"
	ResSeasonChest   = "season_chest"
)

// Worker job keys.
const (
	JobWater      = "water"
	JobWood       = "wood"
	JobStone      = "stone"
	JobSmeltIron  = "smelt_iron"
	JobPrepRation = "prep_ration"
)

// Blueprint codes (Phase 1 progression & intermediate treasure parts).
const (
	BPFirstResident   = "first_resident"
	BPAxeBlueprint    = "axe_blueprint"
	BPWaterWheel1     = "water_wheel_1"
	BPQuarryTech      = "quarry_tech"
	BPStoneSaw1       = "stone_saw_1"
	BPBasicWorkshop   = "basic_workshop"
	BPPartValve       = "part_valve"
	BPPartFrame       = "part_frame"
	BPPartTablet      = "part_tablet"
	BPMysteryTreasure = "mystery_treasure"
)

// Profession codes (GDD 5.2).
const (
	ProfNone      = "none"
	ProfScientist = "scientist"
	ProfAlchemist = "alchemist"
	ProfMage      = "mage"
	ProfArtisan   = "artisan"
)

// Guild codes (GDD 9 & 10).
const (
	GuildObsidian = "OBSIDIAN"
	GuildArgent   = "ARGENT"
	GuildNeutral  = "NEUTRAL"
)

type ResourceMeta struct {
	Key            string
	Name           string
	Tier           string
	Description    string
	Tradable       bool
	InitPriceBasis int64
}

type BlueprintSpec struct {
	Code               string
	Name               string
	Stage              string
	RequiredPopulation int32
	PrerequisiteCode   string
	CostsMilli         map[string]int64
	EffectSummary      string
}

type ProfessionSpec struct {
	Code             string
	Name             string
	Title            string
	ArtifactName     string
	ExclusiveOutputs []string
	StrengthText     string
	WeaknessText     string
	MarketRoleText   string
	PassiveBonusText string
}

type CraftRecipeSpec struct {
	RecipeCode        string
	Name              string
	Category          string
	ProfessionReq     string
	ProfessionReqName string
	OutputKey         string
	OutputName        string
	OutputAmountMilli int64
	CostsMilli        map[string]int64
	GoldCostBasis     int64
	EffectSummary     string
}

type EquipmentSpec struct {
	ItemKey      string
	Name         string
	MaxStack     int32
	BonusSummary string
}

type AllocationPreset struct {
	Name        string           `json:"name"`
	Allocations map[string]int32 `json:"allocations"`
}

type EventEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Category  string `json:"category"`
	Message   string `json:"message"`
}

type CollectibleItem struct {
	ItemID        string `json:"itemId"`
	SerialNumber  int32  `json:"serialNumber"`
	SeasonID      string `json:"seasonId"`
	CollectionID  string `json:"collectionId"`
	Name          string `json:"name"`
	BaseModelID   string `json:"baseModelId"`
	BaseModelName string `json:"baseModelName"`
	TextureID     string `json:"textureId"`
	TextureName   string `json:"textureName"`
	PatternSeed   int64  `json:"patternSeed"`
	UVOffsetX     int32  `json:"uvOffsetX"`
	UVOffsetY     int32  `json:"uvOffsetY"`
	UVScale       int32  `json:"uvScale"`
	UVRotation    int32  `json:"uvRotation"`
	PaletteID     string `json:"paletteId"`
	PaletteName   string `json:"paletteName"`
	RarityTier    string `json:"rarityTier"`
	SpecialTag    string `json:"specialTag"`
	MintedAt      string `json:"mintedAt"`
	OwnerHandle   string `json:"ownerHandle"`
}

type PlayerState struct {
	ID                      string             `json:"id"`
	Handle                  string             `json:"handle"`
	Phase                   int32              `json:"phase"`
	Profession              string             `json:"profession"`
	ArtifactName            string             `json:"artifactName"`
	PopulationTotal         int32              `json:"populationTotal"`
	Workers                 map[string]int32   `json:"workers"`
	ResourcesMilli          map[string]int64   `json:"resourcesMilli"`
	FrozenResourcesMilli    map[string]int64   `json:"frozenResourcesMilli"`
	UnlockedBlueprints      map[string]bool    `json:"unlockedBlueprints"`
	InstalledEquipments     map[string]int32   `json:"installedEquipments"`
	Presets                 []AllocationPreset `json:"presets"`
	GoldBasis               int64              `json:"goldBasis"`
	GoldFrozenBasis         int64              `json:"goldFrozenBasis"`
	ActivityPoints          int32              `json:"activityPoints"`
	GuildCode               string             `json:"guildCode"`
	DailyWarBudgetUsed      int32              `json:"dailyWarBudgetUsed"`
	SpeedMultiplier         int32              `json:"speedMultiplier"`
	TotalManualClicks       int64              `json:"totalManualClicks"`
	SimulatedElapsedSeconds int64              `json:"simulatedElapsedSeconds"`
	LastSettledAt           time.Time          `json:"lastSettledAt"`
	LastOfflineSummary      string             `json:"lastOfflineSummary"`
	EventLogs               []EventEntry       `json:"eventLogs"`
}

type MarketOrder struct {
	ID             string `json:"id"`
	ItemKey        string `json:"itemKey"`
	Side           string `json:"side"` // "BID" or "ASK"
	PriceBasis     int64  `json:"priceBasis"`
	QuantityMilli  int64  `json:"quantityMilli"`
	FilledMilli    int64  `json:"filledMilli"`
	RemainingMilli int64  `json:"remainingMilli"`
	MakerHandle    string `json:"makerHandle"`
	IsNPC          bool   `json:"isNpc"`
	Status         string `json:"status"` // "OPEN", "FILLED", "CANCELLED"
	CreatedAt      string `json:"createdAt"`
}

type MarketTrade struct {
	ID               string `json:"id"`
	ItemKey          string `json:"itemKey"`
	PriceBasis       int64  `json:"priceBasis"`
	QuantityMilli    int64  `json:"quantityMilli"`
	TotalGoldBasis   int64  `json:"totalGoldBasis"`
	TaxBurnedBasis   int64  `json:"taxBurnedBasis"`
	TaxTreasuryBasis int64  `json:"taxTreasuryBasis"`
	BuyerHandle      string `json:"buyerHandle"`
	SellerHandle     string `json:"sellerHandle"`
	ExecutedAt       string `json:"executedAt"`
}

type Troops struct {
	Infantry int32 `json:"infantry"`
	Archer   int32 `json:"archer"`
	Cavalry  int32 `json:"cavalry"`
}

func (t Troops) Total() int32 {
	return t.Infantry + t.Archer + t.Cavalry
}

type WarNodeState struct {
	NodeID          string            `json:"nodeId"`
	Name            string            `json:"name"`
	Region          string            `json:"region"`
	X               int32             `json:"x"`
	Y               int32             `json:"y"`
	OwnerGuild      string            `json:"ownerGuild"`
	DefenseBonusPct int32             `json:"defenseBonusPct"`
	DailyScore      int32             `json:"dailyScore"`
	IsTreasureVault bool              `json:"isTreasureVault"`
	ObsidianTroops  Troops            `json:"obsidianTroops"`
	ArgentTroops    Troops            `json:"argentTroops"`
	NeutralGarrison Troops            `json:"neutralGarrison"`
	PlayerDeployed  map[string]Troops `json:"playerDeployed"` // handle -> Troops
	IntelNote       string            `json:"intelNote"`
}

type WarEdge struct {
	FromNode string `json:"fromNode"`
	ToNode   string `json:"toNode"`
}

type WarBattleNodeReport struct {
	NodeID                string `json:"nodeId"`
	NodeName              string `json:"nodeName"`
	PrevOwner             string `json:"prevOwner"`
	NewOwner              string `json:"newOwner"`
	ObsidianInfantry      int32  `json:"obsidianInfantry"`
	ObsidianArcher        int32  `json:"obsidianArcher"`
	ObsidianCavalry       int32  `json:"obsidianCavalry"`
	ArgentInfantry        int32  `json:"argentInfantry"`
	ArgentArcher          int32  `json:"argentArcher"`
	ArgentCavalry         int32  `json:"argentCavalry"`
	EffectiveAttackMilli  int64  `json:"effectiveAttackMilli"`
	EffectiveDefenseMilli int64  `json:"effectiveDefenseMilli"`
	Winner                string `json:"winner"`
	CasualtySummary       string `json:"casualtySummary"`
}

type WarDaySettlement struct {
	DayIndex              int32                 `json:"dayIndex"`
	SettledAt             string                `json:"settledAt"`
	ObsidianScoreDelta    int32                 `json:"obsidianScoreDelta"`
	ArgentScoreDelta      int32                 `json:"argentScoreDelta"`
	PlayerPointsEarned    int32                 `json:"playerPointsEarned"`
	PlayerBudgetSubmitted int32                 `json:"playerBudgetSubmitted"`
	NodeReports           []WarBattleNodeReport `json:"nodeReports"`
}

type WorldState struct {
	ActiveHandle           string                  `json:"activeHandle"`
	Players                map[string]*PlayerState `json:"players"`
	TotalIssuedBasis       int64                   `json:"totalIssuedBasis"`
	NPCHeldBasis           int64                   `json:"npcHeldBasis"`
	TreasuryHeldBasis      int64                   `json:"treasuryHeldBasis"`
	PermanentlyBurnedBasis int64                   `json:"permanentlyBurnedBasis"`
	LastPricesBasis        map[string]int64        `json:"lastPricesBasis"`
	OpenPriceBasis         map[string]int64        `json:"openPriceBasis"`
	Orders                 []MarketOrder           `json:"orders"`
	Trades                 []MarketTrade           `json:"trades"`
	SeasonCode             string                  `json:"seasonCode"`
	SeasonName             string                  `json:"seasonName"`
	WarDay                 int32                   `json:"warDay"`
	ObsidianScore          int32                   `json:"obsidianScore"`
	ArgentScore            int32                   `json:"argentScore"`
	WarNodes               []WarNodeState          `json:"warNodes"`
	WarEdges               []WarEdge               `json:"warEdges"`
	WarHistory             []WarDaySettlement      `json:"warHistory"`
	Collectibles           []CollectibleItem       `json:"collectibles"`
	NextOrderSeq           int64                   `json:"nextOrderSeq"`
	NextTradeSeq           int64                   `json:"nextTradeSeq"`
	NextCollectibleSeq     int32                   `json:"nextCollectibleSeq"`
}

// TxManager coordinates atomic domain persistence operations.
type TxManager interface {
	WithinTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// WorldRepository persists and retrieves the authoritative WorldState snapshot.
type WorldRepository interface {
	LoadWorld(ctx context.Context, now time.Time) (*WorldState, error)
	SaveWorld(ctx context.Context, world *WorldState) error
}
