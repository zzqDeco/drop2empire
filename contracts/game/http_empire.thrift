namespace go game.empire

// Public HTTP wire contract for Drop to Empire (滴水成城) V1.0.
// All monetary values use basis units (1 Gold = 10,000 basis).
// All resource quantities use milli units (1 Unit = 1,000 milli).

struct ResourceLineDTO {
  1: required string key (api.body="key")
  2: required string name (api.body="name")
  3: required string tier (api.body="tier")
  4: required i64 amountMilli (api.body="amountMilli")
  5: required i64 frozenMilli (api.body="frozenMilli")
  6: required i64 netRatePerSecMilli (api.body="netRatePerSecMilli")
  7: required bool unlocked (api.body="unlocked")
  8: required string description (api.body="description")
  9: required i64 capacityMilli (api.body="capacityMilli")
  10: required i64 grossRatePerSecMilli (api.body="grossRatePerSecMilli")
  11: required i64 drainRatePerSecMilli (api.body="drainRatePerSecMilli")
}

struct WorkerJobDTO {
  1: required string jobKey (api.body="jobKey")
  2: required string name (api.body="name")
  3: required i32 assigned (api.body="assigned")
  4: required i64 baseRateMilli (api.body="baseRateMilli")
  5: required i64 effectiveRateMilli (api.body="effectiveRateMilli")
  6: required i64 totalOutputPerSecMilli (api.body="totalOutputPerSecMilli")
  7: required i32 efficiencyPct (api.body="efficiencyPct")
  8: required bool unlocked (api.body="unlocked")
  9: required string unlockHint (api.body="unlockHint")
  10: required string inputSummary (api.body="inputSummary")
}

struct AllocationEntryDTO {
  1: required string jobKey (api.body="jobKey")
  2: required i32 count (api.body="count")
}

struct AllocationPresetDTO {
  1: required string name (api.body="name")
  2: required list<AllocationEntryDTO> entries (api.body="entries")
}

struct CostItemDTO {
  1: required string resourceKey (api.body="resourceKey")
  2: required string resourceName (api.body="resourceName")
  3: required i64 requiredMilli (api.body="requiredMilli")
  4: required i64 currentMilli (api.body="currentMilli")
  5: required i64 etaSeconds (api.body="etaSeconds")
}

struct BlueprintNodeDTO {
  1: required string code (api.body="code")
  2: required string name (api.body="name")
  3: required string stage (api.body="stage")
  4: required i32 requiredPopulation (api.body="requiredPopulation")
  5: required string prerequisiteCode (api.body="prerequisiteCode")
  6: required list<CostItemDTO> costs (api.body="costs")
  7: required string effectSummary (api.body="effectSummary")
  8: required bool unlocked (api.body="unlocked")
  9: required bool canUnlock (api.body="canUnlock")
  10: required bool visible (api.body="visible")
  11: required i64 etaSeconds (api.body="etaSeconds")
}

struct ColonyEdictDTO {
  1: required string code (api.body="code")
  2: required string name (api.body="name")
  3: required string category (api.body="category")
  4: required string effectSummary (api.body="effectSummary")
  5: required string drawbackSummary (api.body="drawbackSummary")
  6: required bool unlocked (api.body="unlocked")
  7: required bool active (api.body="active")
}

struct ExpeditionRouteDTO {
  1: required string routeCode (api.body="routeCode")
  2: required string name (api.body="name")
  3: required i32 durationSeconds (api.body="durationSeconds")
  4: required list<CostItemDTO> costs (api.body="costs")
  5: required string rewardSummary (api.body="rewardSummary")
  6: required bool canDispatch (api.body="canDispatch")
}

struct ActiveExpeditionDTO {
  1: required string routeCode (api.body="routeCode")
  2: required string routeName (api.body="routeName")
  3: required i64 remainingSeconds (api.body="remainingSeconds")
  4: required i64 totalSeconds (api.body="totalSeconds")
  5: required bool completed (api.body="completed")
}

struct CaravanOfferDTO {
  1: required string offerCode (api.body="offerCode")
  2: required string title (api.body="title")
  3: required list<CostItemDTO> costs (api.body="costs")
  4: required string rewardSummary (api.body="rewardSummary")
  5: required bool canTrade (api.body="canTrade")
}

struct CosmeticSpecDTO {
  1: required string itemKey (api.body="itemKey")
  2: required string name (api.body="name")
  3: required string slot (api.body="slot")
  4: required string rarity (api.body="rarity")
  5: required string seasonTag (api.body="seasonTag")
  6: required string visualEffect (api.body="visualEffect")
  7: required i32 ownedCount (api.body="ownedCount")
  8: required bool equipped (api.body="equipped")
}

struct EquippedCosmeticsDTO {
  1: required string headgear (api.body="headgear")
  2: required string mantle (api.body="mantle")
  3: required string heldRelic (api.body="heldRelic")
  4: required string companion (api.body="companion")
}

struct RaidGearSpecDTO {
  1: required string itemKey (api.body="itemKey")
  2: required string name (api.body="name")
  3: required string category (api.body="category")
  4: required i32 tier (api.body="tier")
  5: required string blueprintKey (api.body="blueprintKey")
  6: required string blueprintName (api.body="blueprintName")
  7: required i32 blueprintOwnedCount (api.body="blueprintOwnedCount")
  8: required bool recipeUnlocked (api.body="recipeUnlocked")
  9: required i32 ownedCount (api.body="ownedCount")
  10: required bool equipped (api.body="equipped")
  11: required string statSummary (api.body="statSummary")
  12: required i32 atkBonus (api.body="atkBonus")
  13: required i32 hpBonus (api.body="hpBonus")
  14: required i32 defBonus (api.body="defBonus")
  15: required i32 moveCooldownMs (api.body="moveCooldownMs")
  16: required i32 safeSlots (api.body="safeSlots")
  17: required list<CostItemDTO> costs (api.body="costs")
  18: required bool canCraft (api.body="canCraft")
}

struct RaidBuffCardDTO {
  1: required string cardCode (api.body="cardCode")
  2: required string name (api.body="name")
  3: required string category (api.body="category")
  4: required string rarity (api.body="rarity")
  5: required string effectSummary (api.body="effectSummary")
  6: required list<CostItemDTO> costs (api.body="costs")
  7: required bool canBuy (api.body="canBuy")
}

struct RaidLootItemDTO {
  1: required string id (api.body="id")
  2: required string key (api.body="key")
  3: required string name (api.body="name")
  4: required string rarity (api.body="rarity")
  5: required string category (api.body="category")
}

struct RaidTileViewDTO {
  1: required i32 x (api.body="x")
  2: required i32 y (api.body="y")
  3: required string kind (api.body="kind")
  4: required bool explored (api.body="explored")
  5: required bool looted (api.body="looted")
  6: required string enemyName (api.body="enemyName")
  7: required i32 enemyHp (api.body="enemyHp")
  8: required i32 enemyMaxHp (api.body="enemyMaxHp")
  9: required i32 enemyAtk (api.body="enemyAtk")
  10: required i32 portalTargetZone (api.body="portalTargetZone")
  11: required string portalLabel (api.body="portalLabel")
  12: required i32 channelMs (api.body="channelMs")
}

struct RaidZoneViewDTO {
  1: required i32 id (api.body="id")
  2: required string name (api.body="name")
  3: required string subtitle (api.body="subtitle")
  4: required i32 width (api.body="width")
  5: required i32 height (api.body="height")
  6: required bool visited (api.body="visited")
  7: required i32 exploredCount (api.body="exploredCount")
  8: required list<RaidTileViewDTO> tiles (api.body="tiles")
}

struct RaidSettlementReportDTO {
  8: required string raidId (api.body="raidId")
  1: required string status (api.body="status")
  2: required list<RaidLootItemDTO> backpackItems (api.body="backpackItems")
  3: required list<RaidLootItemDTO> safeBoxItems (api.body="safeBoxItems")
  4: required list<string> lostGearNames (api.body="lostGearNames")
  5: required i32 zonesVisited (api.body="zonesVisited")
  6: required i32 chestsOpened (api.body="chestsOpened")
  7: required i32 bossesKilled (api.body="bossesKilled")
}

struct RaidSessionDTO {
  25: required string raidId (api.body="raidId")
  26: required i64 lastCommandSeq (api.body="lastCommandSeq")
  27: required i64 channelRemainingMs (api.body="channelRemainingMs")
  2: required i32 currentZoneId (api.body="currentZoneId")
  3: required i32 playerX (api.body="playerX")
  4: required i32 playerY (api.body="playerY")
  5: required string facing (api.body="facing")
  6: required i32 hp (api.body="hp")
  7: required i32 maxHp (api.body="maxHp")
  8: required i32 atk (api.body="atk")
  9: required i32 def (api.body="def")
  10: required bool cheatDeathActive (api.body="cheatDeathActive")
  11: required i64 timeRemainingMs (api.body="timeRemainingMs")
  12: required i32 effectiveMoveCooldownMs (api.body="effectiveMoveCooldownMs")
  13: required i64 galeRemainingMs (api.body="galeRemainingMs")
  14: required i64 scavRemainingMs (api.body="scavRemainingMs")
  15: required list<string> usedPotionKeys (api.body="usedPotionKeys")
  16: required list<RaidLootItemDTO> backpack (api.body="backpack")
  17: required list<RaidLootItemDTO> safeBox (api.body="safeBox")
  18: required list<RaidLootItemDTO> activeChestDrops (api.body="activeChestDrops")
  19: required string activeContainerTitle (api.body="activeContainerTitle")
  20: required list<string> logs (api.body="logs")
  21: required i32 zonesVisitedCount (api.body="zonesVisitedCount")
  22: required i32 chestsOpenedCount (api.body="chestsOpenedCount")
  23: required i32 bossesKilledCount (api.body="bossesKilledCount")
  24: required list<RaidZoneViewDTO> zones (api.body="zones")
}

struct RaidLoadoutStateDTO {
  1: required string weaponKey (api.body="weaponKey")
  2: required string armorKey (api.body="armorKey")
  3: required string bootsKey (api.body="bootsKey")
  4: required string safeBoxKey (api.body="safeBoxKey")
  5: required i32 safeSlotCount (api.body="safeSlotCount")
  6: required list<string> equippedPotions (api.body="equippedPotions")
  7: required list<RaidBuffCardDTO> equippedBuffCards (api.body="equippedBuffCards")
  8: required list<RaidBuffCardDTO> draftPoolCards (api.body="draftPoolCards")
  9: required list<CostItemDTO> rerollCosts (api.body="rerollCosts")
  10: required bool canReroll (api.body="canReroll")
  11: required i32 totalMaxHp (api.body="totalMaxHp")
  12: required i32 totalAtk (api.body="totalAtk")
  13: required i32 totalDef (api.body="totalDef")
  14: required i32 moveCooldownMs (api.body="moveCooldownMs")
  15: required i32 raidDurationSeconds (api.body="raidDurationSeconds")
  16: required i32 backpackCapacity (api.body="backpackCapacity")
  18: optional RaidSessionDTO activeSession (api.body="activeSession")
  19: optional RaidSettlementReportDTO lastSettlementReport (api.body="lastSettlementReport")
}

struct ProfessionSpecDTO {
  1: required string code (api.body="code")
  2: required string name (api.body="name")
  3: required string title (api.body="title")
  4: required string artifactName (api.body="artifactName")
  5: required list<string> exclusiveOutputs (api.body="exclusiveOutputs")
  6: required string strengthText (api.body="strengthText")
  7: required string weaknessText (api.body="weaknessText")
  8: required string marketRoleText (api.body="marketRoleText")
  9: required string passiveBonusText (api.body="passiveBonusText")
}

struct CraftRecipeDTO {
  1: required string recipeCode (api.body="recipeCode")
  2: required string name (api.body="name")
  3: required string category (api.body="category")
  4: required string professionReq (api.body="professionReq")
  5: required string professionReqName (api.body="professionReqName")
  6: required string outputKey (api.body="outputKey")
  7: required string outputName (api.body="outputName")
  8: required i64 outputAmountMilli (api.body="outputAmountMilli")
  9: required list<CostItemDTO> costs (api.body="costs")
  10: required i64 goldCostBasis (api.body="goldCostBasis")
  11: required string effectSummary (api.body="effectSummary")
  12: required bool canCraft (api.body="canCraft")
  13: required bool professionMatched (api.body="professionMatched")
}

struct InstalledEquipmentDTO {
  1: required string itemKey (api.body="itemKey")
  2: required string name (api.body="name")
  3: required i32 inventoryUnits (api.body="inventoryUnits")
  4: required i32 installedCount (api.body="installedCount")
  5: required i32 maxStack (api.body="maxStack")
  6: required string bonusSummary (api.body="bonusSummary")
}

struct MarketOrderDTO {
  1: required string id (api.body="id")
  2: required string itemKey (api.body="itemKey")
  3: required string itemName (api.body="itemName")
  4: required string side (api.body="side")
  5: required i64 priceBasis (api.body="priceBasis")
  6: required i64 quantityMilli (api.body="quantityMilli")
  7: required i64 filledMilli (api.body="filledMilli")
  8: required i64 remainingMilli (api.body="remainingMilli")
  9: required string makerName (api.body="makerName")
  10: required bool isOwn (api.body="isOwn")
  11: required bool isNpc (api.body="isNpc")
  12: required string status (api.body="status")
  13: required string createdAt (api.body="createdAt")
}

struct MarketTradeDTO {
  1: required string id (api.body="id")
  2: required string itemKey (api.body="itemKey")
  3: required string itemName (api.body="itemName")
  4: required i64 priceBasis (api.body="priceBasis")
  5: required i64 quantityMilli (api.body="quantityMilli")
  6: required i64 totalGoldBasis (api.body="totalGoldBasis")
  7: required i64 taxBurnedBasis (api.body="taxBurnedBasis")
  8: required i64 taxTreasuryBasis (api.body="taxTreasuryBasis")
  9: required string buyerName (api.body="buyerName")
  10: required string sellerName (api.body="sellerName")
  11: required string executedAt (api.body="executedAt")
}

struct MarketSummaryDTO {
  1: required string itemKey (api.body="itemKey")
  2: required string itemName (api.body="itemName")
  3: required string tier (api.body="tier")
  4: required i64 lastPriceBasis (api.body="lastPriceBasis")
  5: required i64 bestBidBasis (api.body="bestBidBasis")
  6: required i64 bestAskBasis (api.body="bestAskBasis")
  7: required i64 volume24hMilli (api.body="volume24hMilli")
  8: required i32 change24hPctBps (api.body="change24hPctBps")
}

struct MacroLedgerDTO {
  1: required i64 totalIssuedBasis (api.body="totalIssuedBasis")
  2: required i64 playerHeldBasis (api.body="playerHeldBasis")
  3: required i64 escrowFrozenBasis (api.body="escrowFrozenBasis")
  4: required i64 npcHeldBasis (api.body="npcHeldBasis")
  5: required i64 treasuryHeldBasis (api.body="treasuryHeldBasis")
  6: required i64 permanentlyBurnedBasis (api.body="permanentlyBurnedBasis")
  7: required i32 taxRateBps (api.body="taxRateBps")
  8: required i32 burnShareBps (api.body="burnShareBps")
}

struct WarNodeDTO {
  1: required string nodeId (api.body="nodeId")
  2: required string name (api.body="name")
  3: required string region (api.body="region")
  4: required i32 x (api.body="x")
  5: required i32 y (api.body="y")
  6: required string ownerGuild (api.body="ownerGuild")
  7: required i32 defenseBonusPct (api.body="defenseBonusPct")
  8: required i32 dailyScore (api.body="dailyScore")
  9: required bool isTreasureVault (api.body="isTreasureVault")
  10: required i64 garrisonPower (api.body="garrisonPower")
  11: required i32 infantryCount (api.body="infantryCount")
  12: required i32 archerCount (api.body="archerCount")
  13: required i32 cavalryCount (api.body="cavalryCount")
  14: required i32 myInfantry (api.body="myInfantry")
  15: required i32 myArcher (api.body="myArcher")
  16: required i32 myCavalry (api.body="myCavalry")
  17: required bool canDeploy (api.body="canDeploy")
  18: required bool supplyConnected (api.body="supplyConnected")
  19: required string intelNote (api.body="intelNote")
}

struct WarEdgeDTO {
  1: required string fromNode (api.body="fromNode")
  2: required string toNode (api.body="toNode")
}

struct WarBattleNodeReportDTO {
  1: required string nodeId (api.body="nodeId")
  2: required string nodeName (api.body="nodeName")
  3: required string prevOwner (api.body="prevOwner")
  4: required string newOwner (api.body="newOwner")
  5: required i32 obsidianInfantry (api.body="obsidianInfantry")
  6: required i32 obsidianArcher (api.body="obsidianArcher")
  7: required i32 obsidianCavalry (api.body="obsidianCavalry")
  8: required i32 argentInfantry (api.body="argentInfantry")
  9: required i32 argentArcher (api.body="argentArcher")
  10: required i32 argentCavalry (api.body="argentCavalry")
  11: required i64 effectiveAttackMilli (api.body="effectiveAttackMilli")
  12: required i64 effectiveDefenseMilli (api.body="effectiveDefenseMilli")
  13: required string winner (api.body="winner")
  14: required string casualtySummary (api.body="casualtySummary")
}

struct WarDaySettlementDTO {
  1: required i32 dayIndex (api.body="dayIndex")
  2: required string settledAt (api.body="settledAt")
  3: required i32 obsidianScoreDelta (api.body="obsidianScoreDelta")
  4: required i32 argentScoreDelta (api.body="argentScoreDelta")
  5: required i32 playerPointsEarned (api.body="playerPointsEarned")
  6: required i32 playerBudgetSubmitted (api.body="playerBudgetSubmitted")
  7: required list<WarBattleNodeReportDTO> nodeReports (api.body="nodeReports")
}

struct GuildMemberDTO {
  1: required string handle (api.body="handle")
  2: required string role (api.body="role")
  3: required i64 contribution (api.body="contribution")
  4: required i32 warDeployed (api.body="warDeployed")
}

struct GuildDTO {
  1: required string guildId (api.body="guildId")
  2: required string name (api.body="name")
  3: required string tag (api.body="tag")
  4: required string faction (api.body="faction")
  5: required string factionName (api.body="factionName")
  6: required string leaderHandle (api.body="leaderHandle")
  7: required i32 level (api.body="level")
  8: required i64 xp (api.body="xp")
  9: required i64 nextLevelXp (api.body="nextLevelXp")
  10: required i32 memberCount (api.body="memberCount")
  11: required i64 treasuryGoldBasis (api.body="treasuryGoldBasis")
  12: required string rallyNodeId (api.body="rallyNodeId")
  13: required string rallyNodeName (api.body="rallyNodeName")
  14: required string announcement (api.body="announcement")
  15: required string bonusSummary (api.body="bonusSummary")
  16: required list<GuildMemberDTO> members (api.body="members")
}

struct WarStateDTO {
  1: required string seasonCode (api.body="seasonCode")
  2: required string seasonName (api.body="seasonName")
  3: required i32 currentDay (api.body="currentDay")
  4: required string nextSettlementLabel (api.body="nextSettlementLabel")
  5: required string playerGuild (api.body="playerGuild")
  6: required string playerGuildName (api.body="playerGuildName")
  7: required string playerRole (api.body="playerRole")
  8: required i32 dailyBudgetUsed (api.body="dailyBudgetUsed")
  9: required i32 dailyBudgetCap (api.body="dailyBudgetCap")
  10: required i32 obsidianTotalScore (api.body="obsidianTotalScore")
  11: required i32 argentTotalScore (api.body="argentTotalScore")
  12: required list<WarNodeDTO> nodes (api.body="nodes")
  13: required list<WarEdgeDTO> edges (api.body="edges")
  14: required list<WarDaySettlementDTO> settlementHistory (api.body="settlementHistory")
  15: required string joinedGuildId (api.body="joinedGuildId")
  16: required i64 playerGuildContribution (api.body="playerGuildContribution")
  17: required list<GuildDTO> guilds (api.body="guilds")
}

struct CollectibleItemDTO {
  1: required string itemId (api.body="itemId")
  2: required i32 serialNumber (api.body="serialNumber")
  3: required string seasonId (api.body="seasonId")
  4: required string collectionId (api.body="collectionId")
  5: required string name (api.body="name")
  6: required string baseModelId (api.body="baseModelId")
  7: required string baseModelName (api.body="baseModelName")
  8: required string textureId (api.body="textureId")
  9: required string textureName (api.body="textureName")
  10: required i64 patternSeed (api.body="patternSeed")
  11: required i32 uvOffsetX (api.body="uvOffsetX")
  12: required i32 uvOffsetY (api.body="uvOffsetY")
  13: required i32 uvScale (api.body="uvScale")
  14: required i32 uvRotation (api.body="uvRotation")
  15: required string paletteId (api.body="paletteId")
  16: required string paletteName (api.body="paletteName")
  17: required string rarityTier (api.body="rarityTier")
  18: required string specialTag (api.body="specialTag")
  19: required string mintedAt (api.body="mintedAt")
  20: required string ownerName (api.body="ownerName")
}

struct SeasonNoticeDTO {
  1: required string seasonId (api.body="seasonId")
  2: required string title (api.body="title")
  3: required string effectiveIn (api.body="effectiveIn")
  4: required string summary (api.body="summary")
  5: required list<string> demandShifts (api.body="demandShifts")
}

struct SeasonStateDTO {
  1: required string seasonId (api.body="seasonId")
  2: required i32 seasonNumber (api.body="seasonNumber")
  3: required string title (api.body="title")
  4: required string subtitle (api.body="subtitle")
  5: required string startedAt (api.body="startedAt")
  6: required list<string> resetRules (api.body="resetRules")
  7: required list<string> retentionRules (api.body="retentionRules")
}

struct EventLogDTO {
  1: required string id (api.body="id")
  2: required string timestamp (api.body="timestamp")
  3: required string category (api.body="category")
  4: required string message (api.body="message")
}

struct RegistrationInviteDTO {
  1: required string id (api.body="id")
  2: required string codePreview (api.body="codePreview")
  3: required string createdAt (api.body="createdAt")
  4: required string expiresAt (api.body="expiresAt")
  5: optional string usedAt (api.body="usedAt")
  6: optional string usedBy (api.body="usedBy")
  7: optional string revokedAt (api.body="revokedAt")
}

struct PlayerProfileDTO {
  1: required string id (api.body="id")
  2: required string handle (api.body="handle")
  3: required i32 phase (api.body="phase")
  4: required string profession (api.body="profession")
  5: required string professionName (api.body="professionName")
  6: required string artifactName (api.body="artifactName")
  7: required i32 populationTotal (api.body="populationTotal")
  8: required i32 populationAssigned (api.body="populationAssigned")
  9: required i32 populationIdle (api.body="populationIdle")
  10: required i64 nextResidentCostWaterMilli (api.body="nextResidentCostWaterMilli")
  11: required i64 nextResidentEtaSeconds (api.body="nextResidentEtaSeconds")
  12: required i64 goldBasis (api.body="goldBasis")
  13: required i64 goldFrozenBasis (api.body="goldFrozenBasis")
  14: required i32 activityPoints (api.body="activityPoints")
  15: required i32 speedMultiplier (api.body="speedMultiplier")
  16: required i64 totalManualClicks (api.body="totalManualClicks")
  17: required i64 simulatedElapsedSeconds (api.body="simulatedElapsedSeconds")
  18: required string offlineAwardSummary (api.body="offlineAwardSummary")
  19: required bool isAdmin (api.body="isAdmin")
}

struct DashboardStateResp {
  32: required i64 revision (api.body="revision")
  1: required string serverTime (api.body="serverTime")
  2: required PlayerProfileDTO player (api.body="player")
  3: required list<string> availableHandles (api.body="availableHandles")
  4: required list<ResourceLineDTO> resources (api.body="resources")
  5: required list<WorkerJobDTO> jobs (api.body="jobs")
  6: required list<AllocationPresetDTO> presets (api.body="presets")
  7: required list<BlueprintNodeDTO> blueprints (api.body="blueprints")
  8: required list<ProfessionSpecDTO> professions (api.body="professions")
  9: required list<CraftRecipeDTO> recipes (api.body="recipes")
  10: required list<InstalledEquipmentDTO> installedEquipments (api.body="installedEquipments")
  11: required list<MarketSummaryDTO> marketSummaries (api.body="marketSummaries")
  12: required list<MarketOrderDTO> openOrders (api.body="openOrders")
  13: required list<MarketTradeDTO> recentTrades (api.body="recentTrades")
  14: required MacroLedgerDTO macroLedger (api.body="macroLedger")
  15: required WarStateDTO war (api.body="war")
  16: required list<CollectibleItemDTO> collectibles (api.body="collectibles")
  17: required list<SeasonNoticeDTO> seasonNotices (api.body="seasonNotices")
  18: required list<EventLogDTO> eventLogs (api.body="eventLogs")
  19: optional string sessionToken (api.body="sessionToken")
  20: required list<RegistrationInviteDTO> invites (api.body="invites")
  21: optional string createdInviteCode (api.body="createdInviteCode")
  22: required list<ColonyEdictDTO> edicts (api.body="edicts")
  23: required list<ExpeditionRouteDTO> expeditionRoutes (api.body="expeditionRoutes")
  24: optional ActiveExpeditionDTO activeExpedition (api.body="activeExpedition")
  25: required list<CaravanOfferDTO> caravanOffers (api.body="caravanOffers")
  26: required bool hydrationWarning (api.body="hydrationWarning")
  27: required EquippedCosmeticsDTO equippedCosmetics (api.body="equippedCosmetics")
  28: required list<CosmeticSpecDTO> cosmetics (api.body="cosmetics")
  29: required list<RaidGearSpecDTO> raidGears (api.body="raidGears")
  30: required RaidLoadoutStateDTO raidLoadout (api.body="raidLoadout")
  31: required SeasonStateDTO currentSeason (api.body="currentSeason")
}

struct RaidUpdateResp {
  1: required string playerHandle (api.body="playerHandle")
  2: required i64 revision (api.body="revision")
  3: required RaidLoadoutStateDTO raidLoadout (api.body="raidLoadout")
}

struct GetDashboardReq {}

struct RegisterAccountReq {
  1: required string handle (api.body="handle")
  2: required string password (api.body="password")
  3: required string inviteCode (api.body="inviteCode")
}

struct CreateInviteReq {}

struct RevokeInviteReq {
  1: required string id (api.path="id")
}

struct LoginAccountReq {
  1: required string handle (api.body="handle")
  2: required string password (api.body="password")
}

struct LogoutAccountReq {}

struct LogoutAccountResp {
  1: required bool ok (api.body="ok")
}

struct SwitchAccountReq {
  1: required string handle (api.body="handle")
}

struct GatherWaterReq {
  1: optional i32 clicks (api.body="clicks")
}

struct RecruitResidentReq {
  1: optional i32 count (api.body="count")
}

struct AllocateWorkersReq {
  1: required string mode (api.body="mode")
  2: optional list<AllocationEntryDTO> entries (api.body="entries")
  3: optional string presetName (api.body="presetName")
}

struct SaveAllocationPresetReq {
  1: required string name (api.body="name")
}

struct UnlockBlueprintReq {
  1: required string code (api.body="code")
}

struct ToggleEdictReq {
  1: required string code (api.body="code")
}

struct DispatchExpeditionReq {
  1: required string routeCode (api.body="routeCode")
}

struct ClaimExpeditionReq {}

struct TradeCaravanReq {
  1: required string offerCode (api.body="offerCode")
}

struct EquipCosmeticReq {
  1: required string slot (api.body="slot")
  2: required string itemKey (api.body="itemKey")
}

struct LearnRaidBlueprintReq {
  1: required string blueprintKey (api.body="blueprintKey")
}

struct ManageRaidGearReq {
  1: required string action (api.body="action")
  2: required string itemKey (api.body="itemKey")
}

struct DraftRaidBuffReq {
  1: required string action (api.body="action")
  2: optional string cardCode (api.body="cardCode")
  3: optional i32 replaceSlot (api.body="replaceSlot")
}

struct StartRaidReq {}

struct RolloverSeasonReq {
  1: optional string nextTitle (api.body="nextTitle")
}

struct PublishNoticeReq {
  1: required string title (api.body="title")
  2: required string effectiveIn (api.body="effectiveIn")
  3: required string summary (api.body="summary")
  4: optional list<string> demandShifts (api.body="demandShifts")
}

struct RaidActionReq {
  8: required string raidId (api.body="raidId")
  9: required i64 commandSeq (api.body="commandSeq")
  1: required string action (api.body="action")
  2: optional i32 dx (api.body="dx")
  3: optional i32 dy (api.body="dy")
  4: optional string itemId (api.body="itemId")
  5: optional string fromContainer (api.body="fromContainer")
  6: optional string toContainer (api.body="toContainer")
  7: optional string itemKey (api.body="itemKey")
}

struct FinishRaidReq {
  2: required string raidId (api.body="raidId")
  3: required i64 commandSeq (api.body="commandSeq")
  1: required string status (api.body="status")
}

struct ChooseProfessionReq {
  1: required string profession (api.body="profession")
}

struct CraftItemReq {
  1: required string recipeCode (api.body="recipeCode")
  2: required i32 batches (api.body="batches")
}

struct InstallEquipmentReq {
  1: required string itemKey (api.body="itemKey")
  2: required i32 delta (api.body="delta")
}

struct PlaceMarketOrderReq {
  1: required string itemKey (api.body="itemKey")
  2: required string side (api.body="side")
  3: required i64 priceBasis (api.body="priceBasis")
  4: required i64 quantityMilli (api.body="quantityMilli")
}

struct CancelMarketOrderReq {
  1: required string id (api.path="id")
}

struct SwitchGuildReq {
  1: required string guildCode (api.body="guildCode")
}

struct GuildActionReq {
  1: required string action (api.body="action")
  2: optional string guildId (api.body="guildId")
  3: optional string name (api.body="name")
  4: optional string tag (api.body="tag")
  5: optional string faction (api.body="faction")
  6: optional string rallyNodeId (api.body="rallyNodeId")
}

struct DeployWarTroopsReq {
  1: required string nodeId (api.body="nodeId")
  2: required i32 infantryDelta (api.body="infantryDelta")
  3: required i32 archerDelta (api.body="archerDelta")
  4: required i32 cavalryDelta (api.body="cavalryDelta")
}

struct TriggerWarSettlementReq {}

struct RedeemSeasonChestReq {
  1: required i32 count (api.body="count")
}

struct OpenSeasonChestReq {
  1: optional i64 clientSeedHint (api.body="clientSeedHint")
}

struct ControlSimulationReq {
  1: required string action (api.body="action")
  2: optional i32 speedMultiplier (api.body="speedMultiplier")
  3: optional i64 advanceSeconds (api.body="advanceSeconds")
  4: optional string targetHandle (api.body="targetHandle")
}

struct BenchmarkMilestoneDTO {
  1: required string code (api.body="code")
  2: required string name (api.body="name")
  3: required double reachedSeconds (api.body="reachedSeconds")
  4: required string formattedTime (api.body="formattedTime")
  5: required i32 population (api.body="population")
}

struct BenchmarkRunDTO {
  1: required string strategyCode (api.body="strategyCode")
  2: required string strategyName (api.body="strategyName")
  3: required string description (api.body="description")
  4: required double totalSeconds (api.body="totalSeconds")
  5: required string formattedTotal (api.body="formattedTotal")
  6: required list<BenchmarkMilestoneDTO> milestones (api.body="milestones")
}

struct RunBenchmark30mReq {}

struct Benchmark30mResp {
  1: required list<BenchmarkRunDTO> runs (api.body="runs")
  2: required string note (api.body="note")
}

service EmpireService {
  DashboardStateResp GetDashboard(1: GetDashboardReq req) (api.get="/api/v1/empire/state")
  DashboardStateResp RegisterAccount(1: RegisterAccountReq req) (api.post="/api/v1/empire/auth/register")
  DashboardStateResp LoginAccount(1: LoginAccountReq req) (api.post="/api/v1/empire/auth/login")
  LogoutAccountResp LogoutAccount(1: LogoutAccountReq req) (api.post="/api/v1/empire/auth/logout")
  DashboardStateResp SwitchAccount(1: SwitchAccountReq req) (api.post="/api/v1/empire/account/switch")
  DashboardStateResp GatherWater(1: GatherWaterReq req) (api.post="/api/v1/empire/production/gather-water")
  DashboardStateResp RecruitResident(1: RecruitResidentReq req) (api.post="/api/v1/empire/production/recruit")
  DashboardStateResp AllocateWorkers(1: AllocateWorkersReq req) (api.post="/api/v1/empire/production/allocate")
  DashboardStateResp SaveAllocationPreset(1: SaveAllocationPresetReq req) (api.post="/api/v1/empire/production/presets")
  DashboardStateResp UnlockBlueprint(1: UnlockBlueprintReq req) (api.post="/api/v1/empire/progression/unlock-blueprint")
  DashboardStateResp ChooseProfession(1: ChooseProfessionReq req) (api.post="/api/v1/empire/progression/choose-profession")
  DashboardStateResp CraftItem(1: CraftItemReq req) (api.post="/api/v1/empire/crafting/craft")
  DashboardStateResp InstallEquipment(1: InstallEquipmentReq req) (api.post="/api/v1/empire/crafting/install")
  DashboardStateResp PlaceMarketOrder(1: PlaceMarketOrderReq req) (api.post="/api/v1/empire/market/orders")
  DashboardStateResp CancelMarketOrder(1: CancelMarketOrderReq req) (api.post="/api/v1/empire/market/orders/:id/cancel")
  DashboardStateResp SwitchGuild(1: SwitchGuildReq req) (api.post="/api/v1/empire/war/guild")
  DashboardStateResp GuildAction(1: GuildActionReq req) (api.post="/api/v1/empire/war/guild-action")
  DashboardStateResp DeployWarTroops(1: DeployWarTroopsReq req) (api.post="/api/v1/empire/war/deploy")
  DashboardStateResp TriggerWarSettlement(1: TriggerWarSettlementReq req) (api.post="/api/v1/empire/war/settle")
  DashboardStateResp RedeemSeasonChest(1: RedeemSeasonChestReq req) (api.post="/api/v1/empire/season/redeem-chest")
  DashboardStateResp OpenSeasonChest(1: OpenSeasonChestReq req) (api.post="/api/v1/empire/season/open-chest")
  DashboardStateResp ControlSimulation(1: ControlSimulationReq req) (api.post="/api/v1/empire/admin/sim")
  Benchmark30mResp RunBenchmark30m(1: RunBenchmark30mReq req) (api.post="/api/v1/empire/admin/benchmark-30m")
  DashboardStateResp CreateInvite(1: CreateInviteReq req) (api.post="/api/v1/empire/admin/invites")
  DashboardStateResp RevokeInvite(1: RevokeInviteReq req) (api.post="/api/v1/empire/admin/invites/:id/revoke")
  DashboardStateResp ToggleEdict(1: ToggleEdictReq req) (api.post="/api/v1/empire/colony/toggle-edict")
  DashboardStateResp DispatchExpedition(1: DispatchExpeditionReq req) (api.post="/api/v1/empire/colony/expedition/dispatch")
  DashboardStateResp ClaimExpedition(1: ClaimExpeditionReq req) (api.post="/api/v1/empire/colony/expedition/claim")
  DashboardStateResp TradeCaravan(1: TradeCaravanReq req) (api.post="/api/v1/empire/colony/caravan/trade")
  DashboardStateResp EquipCosmetic(1: EquipCosmeticReq req) (api.post="/api/v1/empire/colony/cosmetic/equip")
  DashboardStateResp LearnRaidBlueprint(1: LearnRaidBlueprintReq req) (api.post="/api/v1/empire/colony/raid/learn-blueprint")
  DashboardStateResp ManageRaidGear(1: ManageRaidGearReq req) (api.post="/api/v1/empire/colony/raid/gear")
  DashboardStateResp DraftRaidBuff(1: DraftRaidBuffReq req) (api.post="/api/v1/empire/colony/raid/buff")
  DashboardStateResp StartRaid(1: StartRaidReq req) (api.post="/api/v1/empire/colony/raid/start")
  RaidUpdateResp RaidAction(1: RaidActionReq req) (api.post="/api/v1/empire/colony/raid/action")
  RaidUpdateResp FinishRaid(1: FinishRaidReq req) (api.post="/api/v1/empire/colony/raid/finish")
  DashboardStateResp RolloverSeason(1: RolloverSeasonReq req) (api.post="/api/v1/empire/admin/season/rollover")
  DashboardStateResp PublishNotice(1: PublishNoticeReq req) (api.post="/api/v1/empire/admin/notices")
}
