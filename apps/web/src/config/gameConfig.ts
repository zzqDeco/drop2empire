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
};

export const EARLY_EXTRACT_CUTOFF_MS = 80000;

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
