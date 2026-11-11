import type {
  BuildingNodeDTO,
  CosmeticSpecDTO,
  CostItemDTO,
  DashboardStateResp,
  EquippedCosmeticsDTO,
  ResourceLineDTO,
} from "@drop2empire/api-client";
import {
  BUILDING_BASE_COSTS_UNITS,
  RECRUIT_CURVE_CONFIG,
  SETTLEMENT_UI_CONFIG,
} from "../config/gameConfig";
import type { WorldZoneKey } from "../features/macro/types";

export type CivilizationEra = "stone" | "colony" | "workshop" | "empire";

export interface ProgressionFlags {
  hasActivePopulation: boolean;
  firstResBpUnlocked: boolean;
  axeUnlocked: boolean;
  quarryUnlocked: boolean;
  scoutCampUnlocked: boolean;
  workshopUnlocked: boolean;
  treasureUnlocked: boolean;
  isOpeningStage: boolean;
  showJobAllocationColumn: boolean;
  showProfessionChoice: boolean;
  showAdvancedWorld: boolean;
  showScoutScene: boolean;
  showLordScene: boolean;
  canNavigateWorld: boolean;
  civEra: CivilizationEra;
}

export function deriveProgressionFlags(
  state: DashboardStateResp,
): ProgressionFlags {
  const { player, blueprints, cosmetics, collectibles } = state;
  const hasActivePopulation = player.populationTotal > 0;
  const firstResBpUnlocked =
    blueprints.find((b) => b.code === "first_resident")?.unlocked ?? false;
  const axeUnlocked =
    blueprints.find((b) => b.code === "axe_blueprint")?.unlocked ?? false;
  const quarryUnlocked =
    blueprints.find((b) => b.code === "quarry_tech")?.unlocked ?? false;
  const scoutCampUnlocked =
    blueprints.find((b) => b.code === "scout_camp")?.unlocked ?? false;
  const workshopUnlocked =
    blueprints.find((b) => b.code === "basic_workshop")?.unlocked ?? false;
  const treasureUnlocked =
    blueprints.find((b) => b.code === "mystery_treasure")?.unlocked ?? false;

  const isOpeningStage =
    player.populationTotal === 0 &&
    player.profession === "none" &&
    !treasureUnlocked;

  const showJobAllocationColumn = player.populationTotal > 0;
  const showProfessionChoice =
    treasureUnlocked && player.profession === "none";
  const showAdvancedWorld = player.profession !== "none";
  const showScoutScene = scoutCampUnlocked || showAdvancedWorld;
  const hasOwnedCosmetics = cosmetics.some((c) => c.ownedCount > 0);
  const showLordScene =
    scoutCampUnlocked ||
    showAdvancedWorld ||
    hasOwnedCosmetics ||
    collectibles.length > 0;

  const canNavigateWorld =
    showAdvancedWorld ||
    scoutCampUnlocked ||
    hasOwnedCosmetics ||
    collectibles.length > 0;

  const civEra: CivilizationEra = !quarryUnlocked
    ? "stone"
    : !workshopUnlocked
      ? "colony"
      : player.profession === "none"
        ? "workshop"
        : "empire";

  return {
    hasActivePopulation,
    firstResBpUnlocked,
    axeUnlocked,
    quarryUnlocked,
    scoutCampUnlocked,
    workshopUnlocked,
    treasureUnlocked,
    isOpeningStage,
    showJobAllocationColumn,
    showProfessionChoice,
    showAdvancedWorld,
    showScoutScene,
    showLordScene,
    canNavigateWorld,
    civEra,
  };
}

export function computeLiveWaterMetrics(
  state: DashboardStateResp,
  firstResBpUnlocked: boolean,
  inFlightClicks: number,
  interpSeconds: number,
) {
  const waterRes = state.resources.find((r) => r.key === "water")!;
  const perClickWaterMilli = firstResBpUnlocked
    ? SETTLEMENT_UI_CONFIG.upgradedGatherClickMilli
    : SETTLEMENT_UI_CONFIG.baseGatherClickMilli;
  const rawLiveWaterMilli =
    waterRes.amountMilli +
    inFlightClicks * perClickWaterMilli +
    Math.floor(waterRes.netRatePerSecMilli * interpSeconds);
  const liveWaterMilli = Math.max(
    0,
    waterRes.capacityMilli > 0
      ? Math.min(waterRes.capacityMilli, rawLiveWaterMilli)
      : rawLiveWaterMilli,
  );
  const totalClicks = state.player.totalManualClicks + inFlightClicks;
  const hasAnyWaterYet = liveWaterMilli > 0 || totalClicks > 0;
  const canSeeFirstRecruit =
    liveWaterMilli >= SETTLEMENT_UI_CONFIG.firstRecruitWaterMilli ||
    totalClicks >= SETTLEMENT_UI_CONFIG.firstRecruitClickTarget;
  const firstTenProgressPct = Math.min(
    100,
    Math.floor(
      (liveWaterMilli / SETTLEMENT_UI_CONFIG.firstRecruitWaterMilli) * 100,
    ),
  );

  return {
    waterRes,
    liveWaterMilli,
    totalClicks,
    hasAnyWaterYet,
    canSeeFirstRecruit,
    firstTenProgressPct,
  };
}

export function deriveOpeningStory(
  hasAnyWaterYet: boolean,
  liveWaterMilli: number,
  canSeeFirstRecruit: boolean,
) {
  if (!hasAnyWaterYet) {
    return {
      key: "prologue-0",
      kicker: "序章 · 干涸荒原",
      line1: "干涸的荒原，万籁俱寂。",
      line2: "唯有岩缝深处，尚存一缕微弱的水脉。",
    };
  }
  if (liveWaterMilli < 4000) {
    return {
      key: "prologue-1",
      kicker: "序章 · 微光初现",
      line1: "清冽的水滴汇入石凹，荒原泛起生机。",
      line2: "积满 10 滴水，便能留住路过的流民。",
    };
  }
  if (!canSeeFirstRecruit) {
    return {
      key: "prologue-2",
      kicker: "序章 · 旅人驻足",
      line1: "远处的流民循着水汽向此聚拢……",
      line2: "再掬起几捧清泉，即可招募第一位居民。",
    };
  }
  return {
    key: "prologue-3",
    kicker: "序章 · 聚落起点",
    line1: "石凹蓄满清泉，一位疲惫的旅人停下脚步。",
    line2: "招募他留居于此，开启昼夜不息的自动汲水。",
  };
}

/**
 * Exact replica of Go domain NextResidentCostMilli(n).
 */
export function nextResidentCostMilli(n: number): number {
  const safeN = Math.max(0, Math.floor(n));
  if (safeN < RECRUIT_CURVE_CONFIG.earlyPopThreshold) {
    const cost = Math.ceil(
      RECRUIT_CURVE_CONFIG.earlyBaseCost *
        Math.pow(RECRUIT_CURVE_CONFIG.earlyGrowthFactor, safeN),
    );
    return cost * 1000;
  }
  const extra = safeN - RECRUIT_CURVE_CONFIG.earlyPopThreshold + 1;
  const cost = Math.ceil(
    RECRUIT_CURVE_CONFIG.lateBaseCost +
      RECRUIT_CURVE_CONFIG.lateSlope *
        Math.pow(extra, RECRUIT_CURVE_CONFIG.lateExponent),
  );
  return cost * 1000;
}

export function computeBatchRecruitPreview(
  populationTotal: number,
  housingCapacity: number,
  waterMilli: number,
  requestedCount: number,
): {
  actualCount: number;
  totalCostWaterMilli: number;
  maxAffordableCount: number;
  canRecruit: boolean;
} {
  const housingRoom = Math.max(0, housingCapacity - populationTotal);
  const maxCap = Math.min(housingRoom, RECRUIT_CURVE_CONFIG.maxBatchCount);

  let maxAffordableCount = 0;
  let runningWater = waterMilli;
  for (let i = 0; i < maxCap; i++) {
    const c = nextResidentCostMilli(populationTotal + i);
    if (runningWater < c) break;
    runningWater -= c;
    maxAffordableCount++;
  }

  const targetCount = Math.max(
    1,
    Math.min(requestedCount, maxCap > 0 ? maxCap : 1),
  );
  let totalCostWaterMilli = 0;
  for (let i = 0; i < targetCount; i++) {
    totalCostWaterMilli += nextResidentCostMilli(populationTotal + i);
  }

  return {
    actualCount: targetCount,
    totalCostWaterMilli,
    maxAffordableCount,
    canRecruit: housingRoom > 0 && waterMilli >= totalCostWaterMilli,
  };
}

/**
 * Exact BigInt replica of Go domain BuildingCosts(b, owned, quantity):
 * ceil(baseUnits * 5^n / 4^n) * 1000 summed across n in [owned, owned + quantity - 1].
 */
export function computeBatchBuildingCosts(
  building: BuildingNodeDTO,
  requestedQty: number,
  resources: ResourceLineDTO[],
): {
  quantity: number;
  costs: CostItemDTO[];
  canBuildBatch: boolean;
} {
  const maxRemaining = Math.max(1, Math.min(20, building.limit - building.owned));
  const quantity = building.limit <= 1 ? 1 : Math.max(1, Math.min(requestedQty, maxRemaining));
  if (quantity === 1) {
    return {
      quantity: 1,
      costs: building.costs,
      canBuildBatch: building.canBuild,
    };
  }

  const baseMap = BUILDING_BASE_COSTS_UNITS[building.code];
  const resByKey = new Map(resources.map((r) => [r.key, r]));
  const maxSafeCostMilli = 9_000_000_000_000_000n;
  let exceededCostLimit = false;

  const costs: CostItemDTO[] = building.costs.map((item) => {
    const baseUnits = baseMap?.[item.resourceKey];
    let totalReqMilli = 0n;
    if (baseUnits !== undefined) {
      const baseBig = BigInt(baseUnits);
      for (let i = 0; i < quantity; i++) {
        const exp = BigInt(building.owned + i);
        const num = baseBig * 5n ** exp;
        const den = 4n ** exp;
        const ceilUnits = (num + den - 1n) / den;
        totalReqMilli += ceilUnits * 1000n;
        if (totalReqMilli > maxSafeCostMilli) {
          exceededCostLimit = true;
          totalReqMilli = maxSafeCostMilli + 1n;
          break;
        }
      }
    } else {
      totalReqMilli = BigInt(item.requiredMilli) * BigInt(quantity);
    }

    const requiredMilli = Number(totalReqMilli);
    const liveRes = resByKey.get(item.resourceKey);
    const currentMilli = liveRes?.amountMilli ?? item.currentMilli;
    const capacityMilli = liveRes?.capacityMilli ?? item.capacityMilli;
    const netRate = liveRes?.netRatePerSecMilli ?? 0;
    const deficit = requiredMilli - currentMilli;
    const etaSeconds =
      deficit <= 0
        ? 0
        : netRate > 0
          ? Math.ceil(deficit / netRate)
          : -1;

    return {
      resourceKey: item.resourceKey,
      resourceName: item.resourceName,
      requiredMilli,
      currentMilli,
      capacityMilli,
      etaSeconds,
    };
  });

  const canBuildBatch =
    !exceededCostLimit &&
    building.researched &&
    building.owned + quantity <= building.limit &&
    costs.every((c) => c.currentMilli >= c.requiredMilli);

  return { quantity, costs, canBuildBatch };
}

/**
 * Deterministic combat damage preview matching Go domain resolveRaidEnemyCombat.
 */
export function computeRaidCombatPreview(
  enemyHp: number,
  enemyAtk: number,
  playerAtk: number,
  playerDef: number,
  playerHp: number,
  cheatDeathActive: boolean,
): {
  rounds: number;
  expectedDamage: number;
  isLethal: boolean;
} {
  const dmgPerHit = Math.max(6, playerAtk);
  const rounds = Math.max(1, Math.ceil(enemyHp / dmgPerHit));
  const enemyNetAtk = Math.max(2, enemyAtk - playerDef);
  const expectedDamage = (rounds - 1) * enemyNetAtk;
  return {
    rounds,
    expectedDamage,
    isLethal: expectedDamage >= playerHp && !cheatDeathActive,
  };
}

export type MarketCategoryFilter =
  | "all"
  | "supply"
  | "equipment"
  | "blueprint"
  | "cosmetic";

export function classifyMarketCategory(
  itemKey: string,
): Exclude<MarketCategoryFilter, "all"> {
  if (itemKey.startsWith("bp_")) return "blueprint";
  if (itemKey.startsWith("cos_")) return "cosmetic";
  if (
    itemKey === "auto_pump" ||
    itemKey === "alch_catalyst" ||
    itemKey === "enchant_scroll" ||
    itemKey === "heavy_toolset"
  ) {
    return "equipment";
  }
  return "supply";
}

export function resolveSellableStockMilli(
  state: DashboardStateResp,
  itemKey: string,
): number {
  const res = (state.resources ?? []).find((r) => r.key === itemKey);
  if (res) return res.amountMilli;

  const consumable = (state.economy?.professional?.consumables ?? []).find(
    (c) => c.itemKey === itemKey,
  );
  if (consumable) return consumable.inventoryMilli;

  const eq = (state.installedEquipments ?? []).find(
    (e) => e.itemKey === itemKey,
  );
  if (eq) return eq.inventoryUnits * 1000;

  const bpGear = (state.raidGears ?? []).find(
    (g) => g.blueprintKey === itemKey,
  );
  if (bpGear) return bpGear.blueprintOwnedCount * 1000;

  const cos = (state.cosmetics ?? []).find((c) => c.itemKey === itemKey);
  if (cos) return cos.ownedCount * 1000;

  return 0;
}

export function computeSceneBadges(
  state: DashboardStateResp,
): Record<WorldZoneKey, string | null> {
  const readySettlementCount =
    state.settlement.technologies.filter(
      (t) => t.visible && !t.researched && t.canResearch,
    ).length +
    state.blueprints.filter(
      (b) => b.visible && b.kind !== "building" && !b.unlocked && b.canUnlock,
    ).length;

  const ownOrderCount = state.openOrders.filter((o) => o.isOwn).length;
  const chestUnits = Math.floor(
    (state.resources.find((r) => r.key === "season_chest")?.amountMilli ?? 0) /
      1000,
  );
  const canRedeemChests = Math.floor(state.player.activityPoints / 100);
  const raidInProgress = Boolean(state.raidLoadout.activeSession);
  const unlearnedBlueprints = state.raidGears.filter(
    (g) => !g.recipeUnlocked && g.blueprintOwnedCount > 0,
  ).length;

  return {
    settlement: readySettlementCount > 0 ? `${readySettlementCount}` : null,
    scout: raidInProgress
      ? "战中"
      : unlearnedBlueprints > 0
        ? `${unlearnedBlueprints}`
        : null,
    market: ownOrderCount > 0 ? `${ownOrderCount}` : null,
    war: state.war.joinedGuildId
      ? `D${state.war.currentDay}`
      : "待入驻",
    lord:
      chestUnits + canRedeemChests > 0
        ? `${chestUnits + canRedeemChests}`
        : null,
  };
}

function isLoopbackHost(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return (
    clean === "localhost" ||
    clean === "::1" ||
    clean === "0.0.0.0" ||
    clean === "127.0.0.1" ||
    clean.startsWith("127.")
  );
}

/**
 * Resolves a non-loopback public player HTTP(S) origin for invite links.
 * Because `/admin` is accessed over SSH loopback forwarding (`127.0.0.1:18480`),
 * loopback origins are rejected in favor of `VITE_PUBLIC_ORIGIN` or an operator-configured origin.
 */
export function resolvePublicPlayerOrigin(
  configuredOrigin?: string,
  loc?: Pick<Location, "origin" | "hostname">,
): string {
  const candidates = [configuredOrigin?.trim(), loc?.origin];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      if (isLoopbackHost(parsed.hostname)) {
        continue;
      }
      return parsed.origin;
    } catch {
      continue;
    }
  }
  return "";
}

/**
 * Maps a CosmeticSpecDTO preview onto EquippedCosmeticsDTO using wire slot names
 * ("headgear" | "mantle" | "held_relic" | "companion" in CosmeticCatalog).
 */
export function applyPreviewCosmetic(
  base: EquippedCosmeticsDTO,
  preview: CosmeticSpecDTO | null,
): EquippedCosmeticsDTO {
  if (!preview) return base;
  if (preview.slot === "headgear") {
    return { ...base, headgear: preview.itemKey };
  }
  if (preview.slot === "mantle") {
    return { ...base, mantle: preview.itemKey };
  }
  if (preview.slot === "held_relic") {
    return { ...base, heldRelic: preview.itemKey };
  }
  if (preview.slot === "companion") {
    return { ...base, companion: preview.itemKey };
  }
  return base;
}
