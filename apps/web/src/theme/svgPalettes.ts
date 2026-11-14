export const LORD_ILLUSTRATION_PALETTE = {
  // Hand-inked brush contour & stage rim (never inverts to chalk white in dark mode)
  ink: "#1A1714",
  inkSoft: "#3A332D",
  stageGlow: "rgba(250, 246, 238, 0.22)",
  shadowWash: "rgba(26, 23, 20, 0.18)",

  // Expressive 2.5-head chibi skin & facial tones
  skin: "#F8E4CE",
  skinShadow: "#E4C1A0",
  blush: "#E69B8C",
  eyeWhite: "#FFFDF9",
  iris: "#2D4F6C",
  irisDeep: "#182D40",

  // Layered sepia-ink hair
  hair: "#241E1B",
  hairMid: "#382F2A",
  hairHighlight: "#5B4E46",
  hairRim: "#7D6C5E",

  // Frontier Lord Coat & Scarf
  coat: "#263A50",
  coatDark: "#192738",
  coatTrim: "#EFE7D8",
  scarf: "#A62E2E",
  scarfDark: "#761E20",

  // Natural gear materials (wood, linen, leather, chitin, brass, verdigris, obsidian)
  linen: "#E4D7C1",
  linenDark: "#C4B296",
  wood: "#855836",
  woodLight: "#AD7950",
  leather: "#3D2E26",
  leatherLight: "#614A3E",
  steel: "#7B848E",
  steelLight: "#BAC2CB",
  steelDark: "#49515A",
  brass: "#CA9335",
  brassLight: "#ECC56E",
  brassDark: "#8B601B",
  verdigris: "#287B58",
  verdigrisLight: "#6AD0A3",
  obsidian: "#2D273B",
  obsidianMid: "#49405E",
  obsidianRim: "#8E80AD",
  cinnabar: "#B53030",
  cinnabarLight: "#EA6852",
  parchment: "#FAF6EE",
} as const;

export const RAID_CREATURE_PALETTE = {
  ink: "#1A1714",
  shadowWash: "rgba(26, 23, 20, 0.22)",
  raiderHood: "#634C3C",
  raiderHoodDark: "#3E2F25",
  raiderMask: "#241F1C",
  raiderCloth: "#9A7A5E",
  raiderScarf: "#B23232",
  raiderSteel: "#C2CAD2",
  raiderSteelDark: "#6E7782",
  bone: "#F0E7D6",
  boneShadow: "#C8B99E",
  wormShell: "#765B43",
  wormShellDark: "#4B3828",
  wormBelly: "#DFC9AA",
  wormMaw: "#2E1919",
  amberEye: "#F5B038",
  crimsonEye: "#EB4242",
  bossObsidian: "#2D273B",
  bossArmor: "#463E5B",
  bossRim: "#9384B4",
  bossBrass: "#D9A241",
  bossCore: "#EE4D3B",
  bossCoreInner: "#FFE08C",
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
