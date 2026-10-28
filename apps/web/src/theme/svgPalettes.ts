export const LORD_VOXEL_PALETTE = {
  skinFront: "#F3E1C8",
  skinSide: "#D9BD98",
  hairInk: "#231F1C",
  tunicFront: "#28415E",
  tunicSide: "#1B2C40",
  legFront: "#3D3630",
} as const;

export interface RelicPalette {
  primary: string;
  accent: string;
  bg: string;
}

const RELIC_PALETTES: Record<string, RelicPalette> = {
  cinnabar_seal: { primary: "#141413", accent: "#9e2a2b", bg: "#faf6f2" },
  oxidized_verdigris: { primary: "#141413", accent: "#1f5c3a", bg: "#f3f8f5" },
  gilded_obsidian: { primary: "#faf8f5", accent: "#d9a441", bg: "#181715" },
  default: { primary: "#141413", accent: "#52504c", bg: "#faf8f5" },
};

export function getRelicPalette(paletteId: string): RelicPalette {
  return RELIC_PALETTES[paletteId] ?? RELIC_PALETTES.default;
}
