package domain

import (
	"context"
	"time"
)

// Resource keys.
const (
	ResWater         = "water"
	ResWood          = "wood"
	ResCharcoal      = "charcoal"
	ResStone         = "stone"
	ResFlint         = "flint"
	ResAncientShard  = "ancient_shard"
	ResMeteorOre     = "meteor_ore"
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

	// Single-use tradable Raid Blueprints (found in 2D Raid, consumed to unlock seasonal crafting or traded on Market).
	ResBPCrossbow       = "bp_crossbow"
	ResBPTitanHammer    = "bp_titan_hammer"
	ResBPCarapaceArmor  = "bp_carapace_armor"
	ResBPHydroArmor     = "bp_hydro_armor"
	ResBPSpringBoots    = "bp_spring_boots"
	ResBPHermesBoots    = "bp_hermes_boots"
	ResBPCipherSafe     = "bp_cipher_safe"
	ResBPAetherSafe     = "bp_aether_safe"
	ResBPScavengeElixir = "bp_scavenge_elixir"
	ResBPBerserkElixir  = "bp_berserk_elixir"

	// Season-Limited Animated Avatar Cosmetics (tradable on Market & equippable on Lord Avatar + 2D Map token).
	ResCosGoggles       = "cos_goggles"
	ResCosSteamCrown    = "cos_steam_crown"
	ResCosObsidianCrown = "cos_obsidian_crown"
	ResCosSandCloak     = "cos_sand_cloak"
	ResCosHydroWings    = "cos_hydro_wings"
	ResCosAstralWings   = "cos_astral_wings"
	ResCosCompass       = "cos_compass"
	ResCosAlchLantern   = "cos_alch_lantern"
	ResCosThunderStaff  = "cos_thunder_staff"
	ResCosWoodFrog      = "cos_wood_frog"
	ResCosMechOwl       = "cos_mech_owl"
	ResCosAetherDrake   = "cos_aether_drake"
)

// Worker job keys.
const (
	JobWater      = "water"
	JobForage     = "forage"
	JobWood       = "wood"
	JobCharcoal   = "charcoal"
	JobStone      = "stone"
	JobSmeltIron  = "smelt_iron"
	JobPrepRation = "prep_ration"
)

// Blueprint codes (Phase 1 progression, storage expansion, mechanisms & intermediate treasure parts).
const (
	BPFirstResident   = "first_resident"
	BPWaterCistern    = "water_cistern"
	BPColonyEdicts    = "colony_edicts"
	BPScoutCamp       = "scout_camp"
	BPAxeBlueprint    = "axe_blueprint"
	BPCharcoalKiln    = "charcoal_kiln"
	BPLumberYard      = "lumber_yard"
	BPWaterWheel1     = "water_wheel_1"
	BPSiphonSluice    = "siphon_sluice"
	BPQuarryTech      = "quarry_tech"
	BPStoneVault      = "stone_vault"
	BPStoneSaw1       = "stone_saw_1"
	BPBasicWorkshop   = "basic_workshop"
	BPPartValve       = "part_valve"
	BPPartFrame       = "part_frame"
	BPPartTablet      = "part_tablet"
	BPMysteryTreasure = "mystery_treasure"
)

// Colony Edict & Mechanism toggle codes.
const (
	EdictNightShift   = "night_shift"
	EdictWaterRation  = "water_ration"
	EdictHydroSaw     = "hydro_saw"
	EdictSiphonSluice = "siphon_sluice"
)

// Wasteland Expedition route codes.
const (
	ExpRouteWoods   = "exp_woods"
	ExpRouteQuarry  = "exp_quarry"
	ExpRouteSanctum = "exp_sanctum"
)

// Profession codes.
const (
	ProfNone      = "none"
	ProfScientist = "scientist"
	ProfAlchemist = "alchemist"
	ProfMage      = "mage"
	ProfArtisan   = "artisan"
)

// Guild codes.
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
	BaseCapUnits   int64
}

type BlueprintSpec struct {
	Kind               string
	RequiredCodes      []string
	Code               string
	Name               string
	Stage              string
	RequiredPopulation int32
	PrerequisiteCode   string
	CostsMilli         map[string]int64
	EffectSummary      string
	// Structured balance modifiers (decoupled from engine logic):
	CapacityOverrideUnits map[string]int64 // ResourceKey -> new minimum capacity in whole units
	JobEfficiencyBonusPct map[string]int64 // JobKey -> +efficiency%
	DoublesByproductProc  bool
	GrantsGoldBasis       int64
	AutoEnableEdict       string
}

type ProfessionSpec struct {
	Code                  string
	Name                  string
	Title                 string
	ArtifactName          string
	ExclusiveOutputs      []string
	StrengthText          string
	WeaknessText          string
	MarketRoleText        string
	PassiveBonusText      string
	JobEfficiencyBonusPct map[string]int64 // JobKey -> +efficiency%
	StarterGrantUnits     map[string]int64 // ResourceKey -> initial units granted
	ArmamentOutputMultPct int64            // e.g. 125 for Artisan (+25% armament batch output)
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
	ItemKey               string
	Name                  string
	MaxStack              int32
	BonusSummary          string
	JobEfficiencyPerStack map[string]int64 // JobKey -> +efficiency% per installed unit
}

type EdictSpec struct {
	Code                      string
	Name                      string
	Category                  string
	PrerequisiteCode          string
	EffectSummary             string
	DrawbackSummary           string
	MutuallyExclusiveWith     string
	JobEfficiencyBonusPct     map[string]int64 // JobKey -> +/-efficiency%
	PerResidentWaterDrainMod  int64            // delta milli-water/sec per resident
	FlatResourceDrainMilliSec map[string]int64 // ResourceKey -> flat milli/sec drain when active
}

type ExpeditionRouteSpec struct {
	RouteCode            string
	Name                 string
	DurationSeconds      int32
	CostsMilli           map[string]int64
	RewardSummary        string
	RewardsMilli         map[string]int64
	EvenSimSecBonusPop   int32
	CompletionLogWithPop string
	CompletionLogNormal  string
}

type ActiveExpeditionState struct {
	RouteCode       string `json:"routeCode"`
	RouteName       string `json:"routeName"`
	StartedAtSimSec int64  `json:"startedAtSimSec"`
	DurationSeconds int64  `json:"durationSeconds"`
}

type CaravanOfferSpec struct {
	OfferCode        string
	Title            string
	CostsMilli       map[string]int64
	RewardSummary    string
	RewardsMilli     map[string]int64
	RewardPopulation int32
}

type CosmeticSpec struct {
	ItemKey      string
	Name         string
	Slot         string // "headgear", "mantle", "held_relic", "companion"
	Rarity       string // "RARE", "EPIC", "LEGENDARY"
	SeasonTag    string
	VisualEffect string
}

type RaidGearSpec struct {
	ItemKey        string
	Name           string
	Category       string // "weapon", "armor", "boots", "safe_box", "potion"
	Tier           int32  // 1 (direct buy/craft), 2 (single-use blueprint), 3 (abyssal blueprint)
	BlueprintKey   string // "" for Tier 1
	BlueprintName  string
	StatSummary    string
	AtkBonus       int32
	HpBonus        int32
	DefBonus       int32
	BagBonus       int32
	MoveCooldownMs int32
	SafeSlots      int32
	CostsMilli     map[string]int64
}

type RaidBuffCardSpec struct {
	CardCode      string
	Name          string
	Category      string // "time", "vision", "scavenge", "offense", "defense", "tactical"
	Rarity        string // "COMMON", "RARE", "EPIC"
	EffectSummary string
	CostsMilli    map[string]int64
	DurationBonus int32
	HpBonus       int32
	AtkBonus      int32
	DefBonus      int32
	MoveSpeedPct  int32
	BagBonus      int32
	RevealBeacons bool
}

type RaidLootItem struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	Name     string `json:"name"`
	Rarity   string `json:"rarity"`
	Category string `json:"category"`
}

type RaidTileState struct {
	X                int32  `json:"x"`
	Y                int32  `json:"y"`
	Kind             string `json:"kind"`
	Explored         bool   `json:"explored"`
	Looted           bool   `json:"looted"`
	EnemyName        string `json:"enemyName,omitempty"`
	EnemyHP          int32  `json:"enemyHp,omitempty"`
	EnemyMaxHP       int32  `json:"enemyMaxHp,omitempty"`
	EnemyAtk         int32  `json:"enemyAtk,omitempty"`
	PortalTargetZone int32  `json:"portalTargetZone"`
	PortalTargetX    int32  `json:"portalTargetX"`
	PortalTargetY    int32  `json:"portalTargetY"`
	PortalLabel      string `json:"portalLabel,omitempty"`
}

type RaidZoneState struct {
	ID       int32           `json:"id"`
	Name     string          `json:"name"`
	Subtitle string          `json:"subtitle"`
	Width    int32           `json:"width"`
	Height   int32           `json:"height"`
	Visited  bool            `json:"visited"`
	Tiles    []RaidTileState `json:"tiles"`
}

type RaidSettlementReport struct {
	RaidID        string         `json:"raidId"`
	CommandSeq    int64          `json:"commandSeq"`
	CommandDigest string         `json:"commandDigest"`
	Status        string         `json:"status"`
	BackpackItems []RaidLootItem `json:"backpackItems"`
	SafeBoxItems  []RaidLootItem `json:"safeBoxItems"`
	LostGearNames []string       `json:"lostGearNames"`
	ZonesVisited  int32          `json:"zonesVisited"`
	ChestsOpened  int32          `json:"chestsOpened"`
	BossesKilled  int32          `json:"bossesKilled"`
}

type ActiveRaidSession struct {
	RaidID               string          `json:"raidId"`
	LastCommandSeq       int64           `json:"lastCommandSeq"`
	LastCommandDigest    string          `json:"lastCommandDigest"`
	ChannelReadyAt       time.Time       `json:"channelReadyAt"`
	Seed                 int64           `json:"seed"`
	StartedAt            time.Time       `json:"startedAt"`
	ExpiresAt            time.Time       `json:"expiresAt"`
	LastMoveAt           time.Time       `json:"lastMoveAt"`
	SteppedOnTileAt      time.Time       `json:"steppedOnTileAt"`
	CurrentZoneID        int32           `json:"currentZoneId"`
	PlayerX              int32           `json:"playerX"`
	PlayerY              int32           `json:"playerY"`
	Facing               string          `json:"facing"`
	HP                   int32           `json:"hp"`
	MaxHP                int32           `json:"maxHp"`
	Atk                  int32           `json:"atk"`
	Def                  int32           `json:"def"`
	CheatDeathActive     bool            `json:"cheatDeathActive"`
	BaseMoveCooldownMs   int32           `json:"baseMoveCooldownMs"`
	GaleEndsAt           time.Time       `json:"galeEndsAt"`
	ScavEndsAt           time.Time       `json:"scavEndsAt"`
	UsedPotionKeys       []string        `json:"usedPotionKeys"`
	Backpack             []RaidLootItem  `json:"backpack"`
	SafeBox              []RaidLootItem  `json:"safeBox"`
	ActiveChestDrops     []RaidLootItem  `json:"activeChestDrops"`
	ActiveContainerTitle string          `json:"activeContainerTitle"`
	Logs                 []string        `json:"logs"`
	ZonesVisitedCount    int32           `json:"zonesVisitedCount"`
	ChestsOpenedCount    int32           `json:"chestsOpenedCount"`
	BossesKilledCount    int32           `json:"bossesKilledCount"`
	NextLootSeq          int32           `json:"nextLootSeq"`
	Zones                []RaidZoneState `json:"zones"`
}

type RaidLoadoutState struct {
	CompletedRaids       []RaidSettlementReport `json:"completedRaids,omitempty"`
	WeaponKey            string                 `json:"weaponKey"`
	ArmorKey             string                 `json:"armorKey"`
	BootsKey             string                 `json:"bootsKey"`
	SafeBoxKey           string                 `json:"safeBoxKey"`
	EquippedPotions      []string               `json:"equippedPotions"`
	EquippedBuffCards    []string               `json:"equippedBuffCards"`
	DraftPoolCards       []string               `json:"draftPoolCards"`
	ActiveRaidSeed       int64                  `json:"activeRaidSeed"`
	ActiveSession        *ActiveRaidSession     `json:"activeSession,omitempty"`
	LastSettlementReport *RaidSettlementReport  `json:"lastSettlementReport,omitempty"`
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

type RegistrationInvite struct {
	ID          string `json:"id"`
	CodeHash    string `json:"codeHash"`
	CodePreview string `json:"codePreview"`
	CreatedAt   string `json:"createdAt"`
	ExpiresAt   string `json:"expiresAt"`
	UsedAt      string `json:"usedAt,omitempty"`
	UsedBy      string `json:"usedBy,omitempty"`
	RevokedAt   string `json:"revokedAt,omitempty"`
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
	Revision                int64                  `json:"revision"`
	ProductionRemainders    map[string]int64       `json:"productionRemainders,omitempty"`
	SimulatedRemainderMs    int64                  `json:"simulatedRemainderMs"`
	ID                      string                 `json:"id"`
	Handle                  string                 `json:"handle"`
	PasswordHash            string                 `json:"passwordHash"`
	IsAdmin                 bool                   `json:"isAdmin"`
	Phase                   int32                  `json:"phase"`
	Profession              string                 `json:"profession"`
	ArtifactName            string                 `json:"artifactName"`
	PopulationTotal         int32                  `json:"populationTotal"`
	Workers                 map[string]int32       `json:"workers"`
	ResourcesMilli          map[string]int64       `json:"resourcesMilli"`
	FrozenResourcesMilli    map[string]int64       `json:"frozenResourcesMilli"`
	UnlockedBlueprints      map[string]bool        `json:"unlockedBlueprints"`
	ResearchedTechnologies  map[string]bool        `json:"researchedTechnologies"`
	BuildingCounts          map[string]int32       `json:"buildingCounts"`
	DiscoveredResources     map[string]bool        `json:"discoveredResources"`
	SettlementCommandSeq    int64                  `json:"settlementCommandSeq"`
	LastSettlementCommand   string                 `json:"lastSettlementCommand"`
	ActiveEdicts            map[string]bool        `json:"activeEdicts"`
	ActiveExpedition        *ActiveExpeditionState `json:"activeExpedition,omitempty"`
	HydrationWarning        bool                   `json:"hydrationWarning"`
	EquippedCosmetics       map[string]string      `json:"equippedCosmetics"`
	LearnedRaidBlueprints   map[string]bool        `json:"learnedRaidBlueprints"`
	RaidGearInventory       map[string]int32       `json:"raidGearInventory"`
	RaidLoadout             RaidLoadoutState       `json:"raidLoadout"`
	InstalledEquipments     map[string]int32       `json:"installedEquipments"`
	Presets                 []AllocationPreset     `json:"presets"`
	GoldBasis               int64                  `json:"goldBasis"`
	GoldFrozenBasis         int64                  `json:"goldFrozenBasis"`
	ActivityPoints          int32                  `json:"activityPoints"`
	GuildCode               string                 `json:"guildCode"`
	JoinedGuildID           string                 `json:"joinedGuildId"`
	GuildContribution       int64                  `json:"guildContribution"`
	DailyWarBudgetUsed      int32                  `json:"dailyWarBudgetUsed"`
	SpeedMultiplier         int32                  `json:"speedMultiplier"`
	TotalManualClicks       int64                  `json:"totalManualClicks"`
	LastGatherWaterAt       time.Time              `json:"lastGatherWaterAt"`
	SimulatedElapsedSeconds int64                  `json:"simulatedElapsedSeconds"`
	LastSettledAt           time.Time              `json:"lastSettledAt"`
	LastOfflineSummary      string                 `json:"lastOfflineSummary"`
	EventLogs               []EventEntry           `json:"eventLogs"`
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

type GuildMember struct {
	Handle       string `json:"handle"`
	Role         string `json:"role"`
	Contribution int64  `json:"contribution"`
	WarDeployed  int32  `json:"warDeployed"`
}

type GuildState struct {
	GuildID           string        `json:"guildId"`
	Name              string        `json:"name"`
	Tag               string        `json:"tag"`
	Faction           string        `json:"faction"`
	LeaderHandle      string        `json:"leaderHandle"`
	Level             int32         `json:"level"`
	XP                int64         `json:"xp"`
	TreasuryGoldBasis int64         `json:"treasuryGoldBasis"`
	RallyNodeID       string        `json:"rallyNodeId"`
	Announcement      string        `json:"announcement"`
	Members           []GuildMember `json:"members"`
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

type SeasonNotice struct {
	SeasonID     string   `json:"seasonId"`
	Title        string   `json:"title"`
	EffectiveIn  string   `json:"effectiveIn"`
	Summary      string   `json:"summary"`
	DemandShifts []string `json:"demandShifts"`
}

type WorldState struct {
	LastWarPeriod          string                  `json:"lastWarPeriod"`
	PendingTrades          []MarketTrade           `json:"-"`
	PendingCollectibles    []CollectibleItem       `json:"-"`
	ActiveHandle           string                  `json:"activeHandle"`
	AdminMode              bool                    `json:"-"`
	Players                map[string]*PlayerState `json:"players"`
	Sessions               map[string]string       `json:"sessions"`
	Invites                []RegistrationInvite    `json:"invites"`
	NextInviteSeq          int64                   `json:"nextInviteSeq"`
	TotalIssuedBasis       int64                   `json:"totalIssuedBasis"`
	NPCHeldBasis           int64                   `json:"npcHeldBasis"`
	TreasuryHeldBasis      int64                   `json:"treasuryHeldBasis"`
	PermanentlyBurnedBasis int64                   `json:"permanentlyBurnedBasis"`
	LastPricesBasis        map[string]int64        `json:"lastPricesBasis"`
	OpenPriceBasis         map[string]int64        `json:"openPriceBasis"`
	Orders                 []MarketOrder           `json:"orders"`
	Trades                 []MarketTrade           `json:"trades"`
	SeasonNumber           int32                   `json:"seasonNumber"`
	SeasonCode             string                  `json:"seasonCode"`
	SeasonName             string                  `json:"seasonName"`
	SeasonSubtitle         string                  `json:"seasonSubtitle"`
	SeasonStartedAt        string                  `json:"seasonStartedAt"`
	Announcements          []SeasonNotice          `json:"announcements"`
	WarDay                 int32                   `json:"warDay"`
	ObsidianScore          int32                   `json:"obsidianScore"`
	ArgentScore            int32                   `json:"argentScore"`
	WarNodes               []WarNodeState          `json:"warNodes"`
	WarEdges               []WarEdge               `json:"warEdges"`
	WarHistory             []WarDaySettlement      `json:"warHistory"`
	Guilds                 []GuildState            `json:"guilds"`
	NextGuildSeq           int64                   `json:"nextGuildSeq"`
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

// PlayerRepository isolates high-frequency raid commands from realm-wide transactions.
// The player must be locked for the duration of the surrounding transaction.
type PlayerRepository interface {
	LoadSessionPlayer(ctx context.Context, token string) (*PlayerState, bool, error)
	SavePlayer(ctx context.Context, player *PlayerState) error
}

type GameRepository interface {
	WorldRepository
	PlayerRepository
}
