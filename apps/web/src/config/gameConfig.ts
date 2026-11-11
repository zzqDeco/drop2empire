export const SETTLEMENT_UI_CONFIG = {
  baseGatherClickMilli: 1000,
  upgradedGatherClickMilli: 2000,
  firstRecruitWaterMilli: 10000,
  firstRecruitClickTarget: 10,
  syncPollIntervalMs: 2000,
  interpTickMs: 150,
  maxInterpSec: 2.5,
} as const;

export const RECRUIT_CURVE_CONFIG = {
  earlyPopThreshold: 40,
  earlyBaseCost: 10,
  earlyGrowthFactor: 1.12,
  lateBaseCost: 931,
  lateSlope: 55,
  lateExponent: 1.32,
  maxBatchCount: 50,
} as const;

export const BUILDING_BASE_COSTS_UNITS: Record<
  string,
  Record<string, number>
> = {
  lumber_camp: { water: 20, wood: 10 },
  house: { water: 30, wood: 15 },
  water_cistern: { water: 60, wood: 25 },
  lumber_yard: { water: 40, wood: 40 },
  quarry: { water: 60, wood: 30 },
  charcoal_kiln: { water: 60, wood: 30, stone: 20 },
};

export const EDICT_BUILDING_MAP: Record<
  string,
  { edictCodes: string[]; label: string }
> = {
  colony_edicts: {
    edictCodes: ["night_shift", "water_ration"],
    label: "篝火夜班 / 节水配给",
  },
  water_wheel_1: {
    edictCodes: ["hydro_saw"],
    label: "水压联动水锤",
  },
  siphon_sluice: {
    edictCodes: ["siphon_sluice"],
    label: "虹吸冲矿机关",
  },
};

export const EDICT_UPKEEP_THRESHOLDS_MILLI: Record<
  string,
  { resourceKey: string; resourceName: string; minMilli: number }
> = {
  night_shift: { resourceKey: "wood", resourceName: "木材", minMilli: 400 },
  hydro_saw: {
    resourceKey: "water",
    resourceName: "净水",
    minMilli: 1500,
  },
};

export const CHEST_CHANNEL_BASE_MS: Record<string, number> = {
  chest_wood: 1100,
  chest_iron: 2200,
  chest_coffin: 3600,
  chest_abyss: 5400,
  extract_early: 2800,
  extract_deep: 2800,
};

export const CHEST_CHANNEL_LABELS: Record<string, string> = {
  chest_wood: "正在搜索破旧木箱",
  chest_iron: "正在撬开铁皮军需箱",
  chest_coffin: "正在破译远古机关石棺",
  chest_abyss: "正在开启深渊黑曜秘宝库",
  extract_early: "正在引导外围撤离信标",
  extract_deep: "正在引导深处撤离信标",
};

export const EARLY_EXTRACT_CUTOFF_MS = 60000;

export function computeChestChannelMs(
  kind: string,
  speedBuffActive: boolean,
  serverChannelMs?: number,
): number {
  if (serverChannelMs && serverChannelMs > 0) {
    return serverChannelMs;
  }
  const base = CHEST_CHANNEL_BASE_MS[kind] ?? 1100;
  return speedBuffActive ? Math.floor(base * 0.5) : base;
}
