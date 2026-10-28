import type { DashboardStateResp } from "@drop2empire/api-client";
import { SETTLEMENT_UI_CONFIG } from "../config/gameConfig";

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

export function deriveProgressionFlags(state: DashboardStateResp): ProgressionFlags {
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
