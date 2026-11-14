import { useId } from "react";
import type { EquippedCosmeticsDTO } from "@drop2empire/api-client";
import { LORD_ILLUSTRATION_PALETTE as P } from "./theme/svgPalettes";

export type FacingDirection = "down" | "up" | "left" | "right";

interface LordAvatarSVGProps {
  cosmetics: EquippedCosmeticsDTO;
  weaponKey?: string;
  armorKey?: string;
  bootsKey?: string;
  size?: "profile" | "stage" | "token" | "mini";
  facing?: FacingDirection;
  isMoving?: boolean;
}

/**
 * Hand-Drawn 2.5-Head Blueprint & Ink Chibi Explorer (`LordAvatarSVG`).
 * Crafted with non-inverting India-ink contours, expressive eyes, dynamic coat/scarf silhouette,
 * true 4-directional stances ("down" | "right" | "left" | "up"), and full S1 gear & cosmetic layers.
 */
export function LordAvatarSVG({
  cosmetics,
  weaponKey = "",
  armorKey = "",
  bootsKey = "",
  size = "profile",
  facing = "down",
  isMoving = false,
}: LordAvatarSVGProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hatchId = `inkHatch_${uid}`;
  const sealHatchId = `sealHatch_${uid}`;
  const glowId = `stageGlow_${uid}`;

  const dim =
    size === "stage"
      ? 168
      : size === "profile"
        ? 128
        : size === "token"
          ? 48
          : 36;
  const isFramed = size === "profile" || size === "stage";
  const isSide = facing === "left" || facing === "right";
  const isBack = facing === "up";

  const hasLegendary =
    cosmetics.headgear === "cos_obsidian_crown" ||
    cosmetics.mantle === "cos_astral_wings" ||
    cosmetics.heldRelic === "cos_thunder_staff" ||
    cosmetics.companion === "cos_aether_drake";

  const hasCrown =
    cosmetics.headgear === "cos_steam_crown" ||
    cosmetics.headgear === "cos_obsidian_crown";

  /* -------------------- SHARED WEAPON RENDERER (Palm-Pivot Anchored) -------------------- */
  const renderWeapon = (compactSide = false) => {
    if (!weaponKey) return null;

    if (weaponKey === "gear_titan_hammer") {
      return (
        <g
          transform={
            compactSide
              ? "translate(73.5, 79.5) rotate(24) translate(-15.2, -45)"
              : "translate(42.5, 79.5) rotate(-22) translate(-15.2, -45)"
          }
        >
          {/* Reinforced Ironwood Shaft */}
          <rect
            x="13"
            y="16"
            width="4.5"
            height="45"
            rx="2"
            fill={P.woodLight}
            stroke={P.ink}
            strokeWidth="1.8"
          />
          <rect x="13" y="33" width="4.5" height="8" fill={P.brass} stroke={P.ink} strokeWidth="1.2" />
          <circle cx="15.2" cy="62" r="3" fill={P.brassLight} stroke={P.ink} strokeWidth="1.5" />
          {/* Heavy Beveled Obsidian & Steel Maul Head */}
          <path
            d="M2 5 L28 5 L31 11 L28 21 L2 21 L-1 13 Z"
            fill={P.obsidian}
            stroke={P.ink}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Steel Striking Faces & Rim Highlight */}
          <rect x="1" y="6.5" width="4.5" height="13" rx="1" fill={P.steelLight} stroke={P.ink} strokeWidth="1.2" />
          <rect x="25" y="6.5" width="4.5" height="13" rx="1" fill={P.steelLight} stroke={P.ink} strokeWidth="1.2" />
          <path d="M6 7.5 H24" stroke={P.obsidianRim} strokeWidth="1.4" strokeLinecap="round" />
          {/* Brass Collar & Cinnabar Rune Core */}
          <rect x="11" y="4.5" width="8.5" height="17.5" rx="1.5" fill={P.brassLight} stroke={P.ink} strokeWidth="1.5" />
          <polygon points="15.2,8.8 18.6,13.2 15.2,17.8 11.8,13.2" fill={P.cinnabarLight} stroke={P.ink} strokeWidth="1.1" />
        </g>
      );
    }

    if (weaponKey === "gear_repeat_crossbow") {
      return (
        <g
          transform={
            compactSide
              ? "translate(73.5, 79.5) scale(-1, 1) rotate(-8) translate(-23, -17)"
              : "translate(42.5, 79.5) rotate(-14) translate(-23, -17)"
          }
        >
          {/* Stock */}
          <path
            d="M8 15 L30 12 L30 19 L10 21 Z"
            fill={P.wood}
            stroke={P.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Top Magazine Box */}
          <rect
            x="14"
            y="7"
            width="13"
            height="7"
            rx="1.5"
            fill={P.obsidianMid}
            stroke={P.ink}
            strokeWidth="1.6"
          />
          <line x1="17" y1="10.5" x2="24" y2="10.5" stroke={P.brassLight} strokeWidth="1.4" />
          {/* Brass Prod Bow Arc */}
          <path
            d="M11 2 Q4 14 11 27"
            fill="none"
            stroke={P.brass}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line x1="11" y1="3" x2="18" y2="13" stroke={P.inkSoft} strokeWidth="1.1" />
          <line x1="11" y1="26" x2="18" y2="16" stroke={P.inkSoft} strokeWidth="1.1" />
          {/* Loaded Bolt Tip */}
          <polygon points="2,14 9,11.5 9,16.5" fill={P.cinnabarLight} stroke={P.ink} strokeWidth="1.2" />
        </g>
      );
    }

    if (weaponKey === "gear_flint_bow") {
      return (
        <g
          transform={
            compactSide
              ? "translate(73.5, 79.5) scale(-1, 1) rotate(-8) translate(-9, -23)"
              : "translate(42.5, 79.5) rotate(-10) translate(-9, -23)"
          }
        >
          {/* Bowstring */}
          <line x1="17" y1="4" x2="17" y2="42" stroke={P.linenDark} strokeWidth="1.3" />
          {/* Curved Recurve Wood Limb */}
          <path
            d="M17 4 C5 10 5 36 17 42"
            fill="none"
            stroke={P.wood}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M17 4 C5 10 5 36 17 42"
            fill="none"
            stroke={P.ink}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Grip Wrap & Nocked Flint Arrow */}
          <rect x="7" y="20" width="4" height="6" rx="1" fill={P.scarf} stroke={P.ink} strokeWidth="1.2" />
          <line x1="3" y1="23" x2="21" y2="23" stroke={P.ink} strokeWidth="1.6" />
          <polygon points="0,23 6,20 6,26" fill={P.steelLight} stroke={P.ink} strokeWidth="1.2" />
        </g>
      );
    }

    /* gear_wood_spear (削尖硬木矛) */
    return (
      <g
        transform={
          compactSide
            ? "translate(73.5, 79.5) rotate(22) translate(-11.8, -44)"
            : "translate(42.5, 79.5) rotate(-18) translate(-11.8, -44)"
        }
      >
        <rect
          x="10"
          y="16"
          width="3.6"
          height="48"
          rx="1.8"
          fill={P.woodLight}
          stroke={P.ink}
          strokeWidth="1.7"
        />
        {/* Red Tassel & Cord Binding */}
        <path d="M10 18 Q4 22 6 27" fill="none" stroke={P.scarf} strokeWidth="2.2" strokeLinecap="round" />
        <rect x="9" y="15" width="5.6" height="4" rx="1" fill={P.leather} stroke={P.ink} strokeWidth="1.3" />
        {/* Leaf-Shaped Flint Spearhead */}
        <path
          d="M11.8 1 L17.5 15 L11.8 17.5 L6.1 15 Z"
          fill={P.steelLight}
          stroke={P.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <line x1="11.8" y1="4" x2="11.8" y2="15" stroke={P.ink} strokeWidth="1.1" />
      </g>
    );
  };

  /* -------------------- HELD RELIC RENDERER -------------------- */
  const renderHeldRelic = (compactSide = false) => {
    if (!cosmetics.heldRelic) return null;
    const baseTx = compactSide ? "translate(40, 68)" : "translate(84, 66)";

    if (cosmetics.heldRelic === "cos_compass") {
      return (
        <g transform={baseTx}>
          <circle cx="10" cy="11" r="8.5" fill={P.brassLight} stroke={P.ink} strokeWidth="1.8" />
          <circle cx="10" cy="11" r="6" fill={P.parchment} stroke={P.ink} strokeWidth="1.1" />
          <polygon points="10,5.5 12.2,11 10,16.5 7.8,11" fill={P.cinnabar} />
          <circle cx="10" cy="11" r="1.4" fill={P.ink} />
        </g>
      );
    }

    if (cosmetics.heldRelic === "cos_alch_lantern") {
      return (
        <g transform={baseTx}>
          <path d="M2 4 Q11 -1 12 7" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" />
          <polygon
            points="7,7 17,7 19,12 16,22 8,22 5,12"
            fill={P.parchment}
            stroke={P.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect x="7" y="5.5" width="10" height="2.5" rx="1" fill={P.brass} stroke={P.ink} strokeWidth="1.2" />
          <path d="M12 10 C9.5 13.5 9.5 18 12 19.5 C14.5 18 14.5 13.5 12 10 Z" fill={P.verdigrisLight}>
            <animate attributeName="opacity" values="1;0.55;1" dur="1.4s" repeatCount="indefinite" />
          </path>
        </g>
      );
    }

    if (cosmetics.heldRelic === "cos_thunder_staff") {
      return (
        <g transform={compactSide ? "translate(34, 40) rotate(-14)" : "translate(88, 38) rotate(12)"}>
          <rect x="8.5" y="18" width="3.8" height="50" rx="1.8" fill={P.obsidianMid} stroke={P.ink} strokeWidth="1.7" />
          <line x1="10.4" y1="20" x2="10.4" y2="65" stroke={P.obsidianRim} strokeWidth="1" />
          <ellipse cx="10.3" cy="11" rx="8.5" ry="7.5" fill="none" stroke={P.brassLight} strokeWidth="2" />
          <ellipse cx="10.3" cy="11" rx="4.5" ry="8.5" fill="none" stroke={P.brass} strokeWidth="1.4" />
          <polygon
            points="10.3,4.2 14.5,11 10.3,17.8 6.1,11"
            fill={P.cinnabarLight}
            stroke={P.ink}
            strokeWidth="1.4"
          />
        </g>
      );
    }

    return null;
  };

  /* -------------------- MANTLE / WINGS BACK LAYER -------------------- */
  const renderBackMantle = () => {
    if (cosmetics.mantle === "cos_sand_cloak") {
      return (
        <g>
          <path
            d="M46 61 C36 68 31 84 29 101 L41 99 L46 103 L82 103 L87 99 L99 101 C97 84 92 68 82 61 Z"
            fill={P.linen}
            stroke={P.ink}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M46 61 C38 70 35 84 34 99 L45 98 L49 64 Z"
            fill={P.linenDark}
          />
          <path
            d="M36 93 H92"
            stroke={P.scarf}
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
        </g>
      );
    }

    if (cosmetics.mantle === "cos_hydro_wings") {
      return (
        <g>
          {/* Left Articulated Da Vinci Glider Wing */}
          <path
            d="M52 66 L17 48 L22 59 L14 64 L23 72 L19 80 L48 78 Z"
            fill={P.parchment}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M50 67 L20 51 M49 72 L18 65" stroke={P.brass} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="61" r="2.6" fill={P.verdigrisLight} stroke={P.ink} strokeWidth="1.2" />

          {/* Right Articulated Da Vinci Glider Wing */}
          <path
            d="M76 66 L111 48 L106 59 L114 64 L105 72 L109 80 L80 78 Z"
            fill={P.parchment}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M78 67 L108 51 M79 72 L110 65" stroke={P.brass} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="96" cy="61" r="2.6" fill={P.verdigrisLight} stroke={P.ink} strokeWidth="1.2" />
        </g>
      );
    }

    if (cosmetics.mantle === "cos_astral_wings") {
      return (
        <g>
          {/* Sweeping Celestial Pinions with Luminous Rim */}
          <path
            d="M52 65 C36 50 22 43 11 44 C16 53 22 57 28 59 C18 60 13 64 10 69 C19 71 27 71 34 70 C25 74 20 79 19 85 C30 84 41 80 50 76 Z"
            fill={P.obsidian}
            stroke={P.obsidianRim}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M48 67 C35 55 24 50 16 50 M46 72 C34 68 24 67 16 68"
            fill="none"
            stroke={P.cinnabarLight}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="24" cy="56" r="1.5" fill={P.brassLight} />
          <path
            d="M76 65 C92 50 106 43 117 44 C112 53 106 57 100 59 C110 60 115 64 118 69 C109 71 101 71 94 70 C103 74 108 79 109 85 C98 84 87 80 78 76 Z"
            fill={P.obsidian}
            stroke={P.obsidianRim}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M80 67 C93 55 104 50 112 50 M82 72 C94 68 104 67 112 68"
            fill="none"
            stroke={P.cinnabarLight}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="104" cy="56" r="1.5" fill={P.brassLight} />
        </g>
      );
    }

    /* Default Dashing Short Explorer Capelet */
    return (
      <path
        d="M49 63 C42 70 39 81 38 92 L50 90 L78 90 L90 92 C89 81 86 70 79 63 Z"
        fill={P.coatDark}
        stroke={cosmetics.mantle === "cos_astral_wings" ? P.obsidianRim : P.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    );
  };

  /* -------------------- HEADGEAR RENDERER -------------------- */
  const renderHeadgear = (profileShiftX = 0) => {
    if (cosmetics.headgear === "cos_goggles") {
      return (
        <g transform={`translate(${profileShiftX}, 0)`}>
          {/* Leather Forehead Strap */}
          <path
            d="M42 29 Q64 25 86 29"
            fill="none"
            stroke={P.leather}
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <line x1="60" y1="27" x2="68" y2="27" stroke={P.brassLight} strokeWidth="2.6" />
          {/* Left Round Brass Aviator Goggle */}
          <circle cx="54.5" cy="27" r="6.6" fill={P.brassLight} stroke={P.ink} strokeWidth="1.8" />
          <circle cx="54.5" cy="27" r="4.3" fill={P.verdigris} stroke={P.ink} strokeWidth="1.1" />
          <path d="M52.2 25 Q54.5 23.5 56.8 25" fill="none" stroke={P.parchment} strokeWidth="1.4" strokeLinecap="round" />
          {/* Right Round Brass Aviator Goggle */}
          <circle cx="73.5" cy="27" r="6.6" fill={P.brassLight} stroke={P.ink} strokeWidth="1.8" />
          <circle cx="73.5" cy="27" r="4.3" fill={P.verdigris} stroke={P.ink} strokeWidth="1.1" />
          <path d="M71.2 25 Q73.5 23.5 75.8 25" fill="none" stroke={P.parchment} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    }

    if (cosmetics.headgear === "cos_steam_crown") {
      return (
        <g transform={`translate(${profileShiftX * 0.6}, 0)`}>
          <path
            d="M46 24 L49 14 L56 19 L64 11 L72 19 L79 14 L82 24 Q64 21 46 24 Z"
            fill={P.brassLight}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M47 23 Q64 20 81 23" stroke={P.brassDark} strokeWidth="2" />
          <circle cx="64" cy="18" r="4" fill={P.verdigris} stroke={P.ink} strokeWidth="1.4" />
          <circle cx="64" cy="18" r="1.5" fill={P.parchment} />
        </g>
      );
    }

    if (cosmetics.headgear === "cos_obsidian_crown") {
      return (
        <g transform={`translate(${profileShiftX * 0.6}, 0)`}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`${profileShiftX * 0.6},0; ${profileShiftX * 0.6},-2; ${profileShiftX * 0.6},0`}
            dur="2s"
            repeatCount="indefinite"
          />
          <path
            d="M46 23 L48 13 L56 18 L64 9 L72 18 L80 13 L82 23 Q64 20 46 23 Z"
            fill={P.obsidian}
            stroke={P.obsidianRim}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon points="64,11.5 67.2,17 64,21 60.8,17" fill={P.cinnabarLight} stroke={P.ink} strokeWidth="1.1" />
          <circle cx="52" cy="18" r="1.8" fill={P.brassLight} />
          <circle cx="76" cy="18" r="1.8" fill={P.brassLight} />
        </g>
      );
    }

    return null;
  };

  /* -------------------- BOOT STYLE HELPER -------------------- */
  const renderBootPair = () => {
    const isHermes = bootsKey === "gear_hermes_boots";
    const isSpring = bootsKey === "gear_spring_boots";
    const isHide = bootsKey === "gear_hide_boots";
    const isStraw = bootsKey === "gear_straw_sandals";

    const bootFill = isHermes
      ? P.cinnabar
      : isSpring
        ? P.steelDark
        : isHide
          ? P.leatherLight
          : isStraw
            ? P.linenDark
            : P.leather;

    return (
      <g>
        {/* Left Leg & Boot */}
        <g>
          {isMoving && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,-2.5; 0,2.5; 0,-2.5"
              dur="0.32s"
              repeatCount="indefinite"
            />
          )}
          <path
            d="M53 89 H60 V101 H53 Z"
            fill={P.coatDark}
            stroke={P.ink}
            strokeWidth="1.8"
          />
          <path
            d="M51 98 H61 V109 C61 110.5 59.5 111 55 111 H49.5 C48 111 48 108 50 106 L51 104 Z"
            fill={bootFill}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <line x1="49" y1="109.5" x2="61" y2="109.5" stroke={P.ink} strokeWidth="2" strokeLinecap="round" />
          {isSpring && (
            <path d="M52 101 H60 M52 104.5 H60" stroke={P.brassLight} strokeWidth="1.6" />
          )}
          {isHermes && (
            <path
              d="M51 101 L43 96 L45 102 L42 105 L51 105 Z"
              fill={P.parchment}
              stroke={P.ink}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
        </g>

        {/* Right Leg & Boot */}
        <g>
          {isMoving && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,2.5; 0,-2.5; 0,2.5"
              dur="0.32s"
              repeatCount="indefinite"
            />
          )}
          <path
            d="M68 89 H75 V101 H68 Z"
            fill={P.coatDark}
            stroke={P.ink}
            strokeWidth="1.8"
          />
          <path
            d="M67 98 H77 L78 104 L79 106 C80.5 108 80.5 111 78.5 111 H73 C68.5 111 67 110.5 67 109 Z"
            fill={bootFill}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <line x1="67" y1="109.5" x2="79" y2="109.5" stroke={P.ink} strokeWidth="2" strokeLinecap="round" />
          {isSpring && (
            <path d="M68 101 H76 M68 104.5 H76" stroke={P.brassLight} strokeWidth="1.6" />
          )}
          {isHermes && (
            <path
              d="M77 101 L85 96 L83 102 L86 105 L77 105 Z"
              fill={P.parchment}
              stroke={P.ink}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
        </g>
      </g>
    );
  };

  /* -------------------- FRONT COAT / ARMOR RENDERER -------------------- */
  const renderFrontTorso = () => {
    const isHydro = armorKey === "gear_hydro_armor";
    const isCarapace = armorKey === "gear_carapace_armor";
    const isSplint = armorKey === "gear_splint_mail";
    const isLinen = armorKey === "gear_linen_vest";

    const bodyFill = isHydro
      ? P.steelDark
      : isCarapace
        ? P.obsidian
        : isSplint
          ? P.wood
          : isLinen
            ? P.linen
            : P.coat;

    return (
      <g>
        {/* Tailored A-Line Explorer Coat / Cuirass */}
        <path
          d="M50 63 L78 63 L83 92 L67 92 L64 85 L61 92 L45 92 Z"
          fill={bodyFill}
          stroke={P.ink}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />

        {isHydro ? (
          <g>
            {/* Brass Pauldrons & Glowing Hydro Reactor Core */}
            <path d="M47 63 Q54 61 56 69 L46 70 Z" fill={P.brass} stroke={P.ink} strokeWidth="1.5" />
            <path d="M81 63 Q74 61 72 69 L82 70 Z" fill={P.brass} stroke={P.ink} strokeWidth="1.5" />
            <circle cx="64" cy="75" r="6" fill={P.parchment} stroke={P.ink} strokeWidth="1.6" />
            <circle cx="64" cy="75" r="3.4" fill={P.verdigrisLight} />
            <rect x="48" y="83" width="32" height="4" rx="1.5" fill={P.brass} stroke={P.ink} strokeWidth="1.3" />
          </g>
        ) : isCarapace ? (
          <g>
            {/* Segmented Obsidian Chitin Plates */}
            <path d="M51 70 Q64 74 77 70" fill="none" stroke={P.obsidianMid} strokeWidth="2" />
            <path d="M49 77 Q64 81 79 77" fill="none" stroke={P.obsidianMid} strokeWidth="2" />
            <polygon points="64,67 69,74 64,81 59,74" fill={P.cinnabarLight} stroke={P.ink} strokeWidth="1.4" />
          </g>
        ) : isSplint ? (
          <g>
            {/* Lamellar Hardwood Splints */}
            <line x1="56" y1="65" x2="55" y2="88" stroke={P.ink} strokeWidth="1.4" />
            <line x1="64" y1="65" x2="64" y2="85" stroke={P.ink} strokeWidth="1.4" />
            <line x1="72" y1="65" x2="73" y2="88" stroke={P.ink} strokeWidth="1.4" />
            <rect x="48" y="80" width="32" height="4.5" rx="1.5" fill={P.leather} stroke={P.ink} strokeWidth="1.4" />
          </g>
        ) : (
          <g>
            {/* Crisp Coat Lapels, Center Seam & Brass Belt */}
            <path
              d="M56 63 L64 75 L72 63"
              fill={P.coatTrim}
              stroke={P.ink}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line x1="64" y1="75" x2="64" y2="86" stroke={P.ink} strokeWidth="1.4" />
            <rect x="47.5" y="80" width="33" height="4.8" rx="1.5" fill={P.leather} stroke={P.ink} strokeWidth="1.5" />
            <rect x="60.5" y="79.2" width="7" height="6.4" rx="1.2" fill={P.brassLight} stroke={P.ink} strokeWidth="1.4" />
          </g>
        )}

        {/* Iconic Billowing Cinnabar Explorer Scarf */}
        <path
          d="M50 60 Q64 67 78 60 L76 66 Q64 71 52 66 Z"
          fill={P.scarf}
          stroke={P.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M68 65 L75 76 L69 77 L65 66 Z"
          fill={P.scarf}
          stroke={P.ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    );
  };

  /* -------------------- COMPANION PET RENDERER (Clear Sky / Ground Orbit) -------------------- */
  const renderCompanion = () => {
    if (cosmetics.companion === "cos_wood_frog") {
      return (
        <g transform="translate(14, 91)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="14,91; 14,87; 14,91"
            dur="1.3s"
            repeatCount="indefinite"
          />
          {/* Brass Wind-up Key */}
          <line x1="5" y1="8" x2="1" y2="5" stroke={P.brass} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="0.5" cy="4.5" r="2.2" fill="none" stroke={P.brass} strokeWidth="1.5" />
          {/* Plump Clockwork Wooden Frog Body */}
          <ellipse cx="12" cy="12" rx="8.5" ry="6.5" fill={P.woodLight} stroke={P.ink} strokeWidth="1.8" />
          <path d="M6 13 Q12 16 18 13" fill="none" stroke={P.ink} strokeWidth="1.3" strokeLinecap="round" />
          {/* Big Round Frog Eyes */}
          <circle cx="9" cy="5.8" r="3" fill={P.verdigrisLight} stroke={P.ink} strokeWidth="1.5" />
          <circle cx="9.3" cy="5.8" r="1.1" fill={P.ink} />
          <circle cx="15.5" cy="5.8" r="3" fill={P.verdigrisLight} stroke={P.ink} strokeWidth="1.5" />
          <circle cx="15.8" cy="5.8" r="1.1" fill={P.ink} />
        </g>
      );
    }

    if (cosmetics.companion === "cos_mech_owl") {
      return (
        <g transform="translate(94, 13)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="94,13; 94,9; 94,13"
            dur="1.6s"
            repeatCount="indefinite"
          />
          {/* Plump Da Vinci Clockwork Owl */}
          <path
            d="M5 8 L3 3 L9 6 Q12 5 15 6 L21 3 L19 8 C22 12 21 20 12 21 C3 20 2 12 5 8 Z"
            fill={P.parchment}
            stroke={P.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Belly Scallops */}
          <path d="M8 16 Q10 18 12 16 Q14 18 16 16" fill="none" stroke={P.brassDark} strokeWidth="1.2" />
          {/* Big Amber Goggle Eyes & Beak */}
          <circle cx="8.8" cy="11" r="3.2" fill={P.brassLight} stroke={P.ink} strokeWidth="1.4" />
          <circle cx="8.8" cy="11" r="1.3" fill={P.ink} />
          <circle cx="15.2" cy="11" r="3.2" fill={P.brassLight} stroke={P.ink} strokeWidth="1.4" />
          <circle cx="15.2" cy="11" r="1.3" fill={P.ink} />
          <polygon points="12,12.2 13.8,14.8 10.2,14.8" fill={P.cinnabar} stroke={P.ink} strokeWidth="1" />
        </g>
      );
    }

    if (cosmetics.companion === "cos_aether_drake") {
      return (
        <g transform="translate(91, 11)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="91,11; 91,7; 91,11"
            dur="1.4s"
            repeatCount="indefinite"
          />
          {/* Cute Wing */}
          <path
            d="M15 13 L25 5 L23 13 L26 16 L16 17 Z"
            fill={P.cinnabarLight}
            stroke={P.ink}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Curled Chibi Astral Dragon Head & S-Body */}
          <path
            d="M6 12 C6 7 11 5 16 7 L20 3 L18 8 C20 11 19 16 15 18 C18 21 15 25 9 23 C12 21 12 18 9 16 C6 15 6 14 6 12 Z"
            fill={P.obsidian}
            stroke={P.obsidianRim}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Horn & Golden Eye */}
          <path d="M12 6 L9 2" stroke={P.brassLight} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="11" cy="11" r="2.1" fill={P.brassLight} />
          <circle cx="10.7" cy="11" r="0.85" fill={P.ink} />
        </g>
      );
    }

    return null;
  };

  /* ==================== DIRECTIONAL BODY RIGS ==================== */
  const renderFrontCharacter = () => (
    <g>
      {renderBackMantle()}
      {renderBootPair()}
      {renderFrontTorso()}

      {/* Left Screen Arm (Wields Main Weapon — palm wraps over shaft!) */}
      <g>
        {isMoving && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,2; 0,-2; 0,2"
            dur="0.32s"
            repeatCount="indefinite"
          />
        )}
        <path
          d="M50 64 L41 77 L46 81 L53 70 Z"
          fill={P.coat}
          stroke={P.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        {renderWeapon(false)}
        <circle cx="42.5" cy="79.5" r="3.6" fill={P.skin} stroke={P.ink} strokeWidth="1.7" />
      </g>

      {/* Right Screen Arm (Holds Off-hand Relic) */}
      <g>
        {isMoving && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,-2; 0,2; 0,-2"
            dur="0.32s"
            repeatCount="indefinite"
          />
        )}
        <path
          d="M78 64 L87 77 L82 81 L75 70 Z"
          fill={P.coat}
          stroke={P.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <circle cx="85.5" cy="79.5" r="3.6" fill={P.skin} stroke={P.ink} strokeWidth="1.7" />
        {renderHeldRelic(false)}
      </g>

      {/* ==================== 2.5-HEAD CHIBI HEAD (FRONT) ==================== */}
      <g>
        {/* Feathery Back Hair Tufts Framing Collar */}
        <path
          d="M41 39 L36 47 L41 49 L38 56 L46 61 L82 61 L90 56 L87 49 L92 47 L87 39 Z"
          fill={P.hair}
          stroke={P.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />

        {/* Ears */}
        <ellipse cx="42.5" cy="46" rx="3.4" ry="4.5" fill={P.skinShadow} stroke={P.ink} strokeWidth="1.7" />
        <ellipse cx="85.5" cy="46" rx="3.4" ry="4.5" fill={P.skinShadow} stroke={P.ink} strokeWidth="1.7" />

        {/* Sculpted Chibi Head Contour */}
        <path
          d="M43 39 C43 24 51 20 64 20 C77 20 85 24 85 39 C85 52 77.5 61 64 61.5 C50.5 61 43 52 43 39 Z"
          fill={P.skin}
          stroke={P.ink}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path d="M51 57.5 Q64 62 77 57.5" fill="none" stroke={P.skinShadow} strokeWidth="2.2" strokeLinecap="round" />

        {/* Warm Cheek Blush */}
        <ellipse cx="49.5" cy="50.5" rx="3.8" ry="2" fill={P.blush} opacity="0.5" />
        <ellipse cx="78.5" cy="50.5" rx="3.8" ry="2" fill={P.blush} opacity="0.5" />

        {/* Expressive Confident Brows */}
        <path d="M49 38.8 Q53.5 36.8 58 38.4" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" />
        <path d="M70 38.4 Q74.5 36.8 79 38.8" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" />

        {/* Layered Anime/Chibi Eyes with Specular Catchlights */}
        <g>
          <ellipse cx="53.8" cy="45.2" rx="4.4" ry="4.8" fill={P.eyeWhite} stroke={P.ink} strokeWidth="1.4" />
          <ellipse cx="54.1" cy="45.6" rx="3.1" ry="3.6" fill={P.iris} />
          <ellipse cx="54.1" cy="46.2" rx="1.7" ry="2" fill={P.irisDeep} />
          <circle cx="52.6" cy="43.8" r="1.4" fill={P.eyeWhite} />
          <circle cx="55.4" cy="47.2" r="0.65" fill={P.eyeWhite} />
          <path d="M48.8 43.2 Q53.8 39.8 58.6 43.4" fill="none" stroke={P.ink} strokeWidth="2.3" strokeLinecap="round" />

          <ellipse cx="74.2" cy="45.2" rx="4.4" ry="4.8" fill={P.eyeWhite} stroke={P.ink} strokeWidth="1.4" />
          <ellipse cx="73.9" cy="45.6" rx="3.1" ry="3.6" fill={P.iris} />
          <ellipse cx="73.9" cy="46.2" rx="1.7" ry="2" fill={P.irisDeep} />
          <circle cx="72.4" cy="43.8" r="1.4" fill={P.eyeWhite} />
          <circle cx="75.2" cy="47.2" r="0.65" fill={P.eyeWhite} />
          <path d="M69.4 43.4 Q74.2 39.8 79.2 43.2" fill="none" stroke={P.ink} strokeWidth="2.3" strokeLinecap="round" />
        </g>

        {/* Subtle Nose & Confident Half-Smile */}
        <path d="M63.5 49.5 L64.5 51.2" stroke={P.skinShadow} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M60.8 55.2 Q64.2 57.4 67.8 54.8" fill="none" stroke={P.ink} strokeWidth="1.7" strokeLinecap="round" />

        {/* Dynamic Tapered Anime/Illustrative Bangs & Sideburn Locks */}
        <path
          d={
            hasCrown
              ? "M41 43 C40 23 50 18 64 18 C78 18 88 23 87 43 L84 51 L82 37 L77 32 L74 39 L69 30 L63 40 L59 31 L53 39 L49 32 L46 37 L44 51 Z"
              : "M41 43 C40 23 50 18 61 18 C62 13 67 11 71 13 C67 15 66 17 67 18 C79 19 88 24 87 43 L84 51 L82 37 L77 32 L74 39 L69 30 L63 40 L59 31 L53 39 L49 32 L46 37 L44 51 Z"
          }
          fill={P.hair}
          stroke={P.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        {/* Hair Sheen Ribbon & Crown Rim Highlight (Dark-Mode Readability) */}
        <path
          d="M49 26 Q64 21.5 79 26"
          fill="none"
          stroke={P.hairHighlight}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        {!hasCrown && (
          <path
            d="M47 22.5 C53 18.8 60 18.2 64 18.2 C69 18.2 76 19.2 81 23"
            fill="none"
            stroke={P.hairRim}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}

        {renderHeadgear(0)}
      </g>
    </g>
  );

  /* -------------------- TRUE 3/4 SIDE PROFILE RIG (Faces +X; mirrored cleanly for Left) -------------------- */
  const renderSideCharacter = () => {
    const sideBootFill =
      bootsKey === "gear_hermes_boots"
        ? P.cinnabar
        : bootsKey === "gear_spring_boots"
          ? P.steelDark
          : bootsKey === "gear_hide_boots"
            ? P.leatherLight
            : bootsKey === "gear_straw_sandals"
              ? P.linenDark
              : P.leather;

    const sideBodyFill =
      armorKey === "gear_carapace_armor"
        ? P.obsidian
        : armorKey === "gear_hydro_armor"
          ? P.steelDark
          : armorKey === "gear_splint_mail"
            ? P.wood
            : armorKey === "gear_linen_vest"
              ? P.linen
              : P.coat;

    return (
      <g transform={facing === "left" ? "translate(128, 0) scale(-1, 1)" : undefined}>
        {/* Windswept Mantle / Cape Streaming Behind */}
        <path
          d={
            cosmetics.mantle === "cos_sand_cloak"
              ? "M58 62 C44 66 34 80 28 99 L48 97 L66 95 Z"
              : cosmetics.mantle === "cos_astral_wings"
                ? "M58 64 C40 50 24 46 14 50 C22 58 28 62 34 64 C22 66 16 72 15 78 C28 79 44 76 56 73 Z"
                : cosmetics.mantle === "cos_hydro_wings"
                  ? "M58 65 L20 50 L26 62 L18 69 L30 76 L56 75 Z"
                  : "M58 63 C47 68 40 78 36 91 L56 89 Z"
          }
          fill={
            cosmetics.mantle === "cos_sand_cloak"
              ? P.linen
              : cosmetics.mantle === "cos_astral_wings"
                ? P.obsidian
                : cosmetics.mantle === "cos_hydro_wings"
                  ? P.parchment
                  : P.coatDark
          }
          stroke={cosmetics.mantle === "cos_astral_wings" ? P.obsidianRim : P.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {cosmetics.mantle === "cos_astral_wings" && (
          <path
            d="M52 66 C39 55 27 51 20 52 M49 71 C37 69 27 69 21 71"
            fill="none"
            stroke={P.cinnabarLight}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        )}

        {/* Far Arm & Off-Hand Relic */}
        {renderHeldRelic(true)}

        {/* Stride-Separated Side Boots with Walking Animation */}
        <g>
          <g>
            {isMoving && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-2.5,0; 2.5,-2; -2.5,0"
                dur="0.32s"
                repeatCount="indefinite"
              />
            )}
            <path
              d="M54 89 H61 V108 H52 C52 104 54 101 54 89 Z"
              fill={sideBootFill}
              stroke={P.ink}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </g>
          <g>
            {isMoving && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="2.5,-2; -2.5,0; 2.5,-2"
                dur="0.32s"
                repeatCount="indefinite"
              />
            )}
            <path
              d="M65 89 H72 L75 104 L79 107 C80 109 79 111 76 111 H65 Z"
              fill={sideBootFill}
              stroke={P.ink}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            {bootsKey === "gear_spring_boots" && (
              <path d="M66 101 H74 M66 104.5 H75" stroke={P.brassLight} strokeWidth="1.5" />
            )}
            {bootsKey === "gear_hermes_boots" && (
              <path
                d="M65 101 L58 96 L60 102 L57 105 L65 105 Z"
                fill={P.parchment}
                stroke={P.ink}
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            )}
          </g>
        </g>

        {/* Side-Turned Tailored Coat / Armor */}
        <path
          d="M54 63 L73 63 L77 92 L50 92 Z"
          fill={sideBodyFill}
          stroke={armorKey === "gear_carapace_armor" ? P.obsidianRim : P.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {armorKey === "gear_hydro_armor" && (
          <circle cx="67" cy="74" r="4.2" fill={P.verdigrisLight} stroke={P.ink} strokeWidth="1.3" />
        )}
        {armorKey === "gear_carapace_armor" && (
          <polygon points="67,69 71,74 67,79 63,74" fill={P.cinnabarLight} stroke={P.ink} strokeWidth="1.2" />
        )}
        {armorKey === "gear_splint_mail" && (
          <path d="M59 65 V88 M66 65 V88" stroke={P.ink} strokeWidth="1.3" />
        )}
        <rect x="52" y="80" width="23" height="4.6" rx="1.4" fill={P.leather} stroke={P.ink} strokeWidth="1.4" />
        <rect x="69" y="79.2" width="5.5" height="6.2" rx="1" fill={P.brassLight} stroke={P.ink} strokeWidth="1.3" />

        {/* Windswept Scarf Streaming Back */}
        <path
          d="M53 60 Q64 66 75 61 L74 66 Q62 69 52 65 L39 73 L36 67 Z"
          fill={P.scarf}
          stroke={P.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Near Arm + Palm-Pivot Forward Weapon */}
        <g>
          {isMoving && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-1.5,1; 1.5,-1; -1.5,1"
              dur="0.32s"
              repeatCount="indefinite"
            />
          )}
          <path d="M62 66 L74 78 L69 82 L58 71 Z" fill={P.coat} stroke={P.ink} strokeWidth="1.9" strokeLinejoin="round" />
          {renderWeapon(true)}
          <circle cx="73.5" cy="79.5" r="3.6" fill={P.skin} stroke={P.ink} strokeWidth="1.7" />
        </g>

        {/* True 3/4 Side-Turned Head */}
        <g>
          {/* Windswept Nape Hair Spikes */}
          <path
            d="M46 34 L38 41 L44 45 L39 52 L48 55 L54 61 L64 60 Z"
            fill={P.hair}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Sculpted 3/4 Profile Face */}
          <path
            d="M47 39 C47 24 55 20 67 20 C78 20 84 26 84 39 L86.5 45.5 L84 48 C83 56 76 61 65 61 C53 61 47 53 47 39 Z"
            fill={P.skin}
            stroke={P.ink}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {/* Visible Temple Ear */}
          <ellipse cx="51.5" cy="46.5" rx="3.4" ry="4.6" fill={P.skinShadow} stroke={P.ink} strokeWidth="1.7" />
          <ellipse cx="68.5" cy="50.5" rx="3.5" ry="1.9" fill={P.blush} opacity="0.5" />

          {/* Forward-Looking 3/4 Near Eye */}
          <path d="M63.5 38 Q68 36.2 72.5 38" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" />
          <ellipse cx="68.5" cy="45" rx="4" ry="4.6" fill={P.eyeWhite} stroke={P.ink} strokeWidth="1.4" />
          <ellipse cx="69.5" cy="45.4" rx="2.7" ry="3.4" fill={P.iris} />
          <ellipse cx="69.7" cy="46" rx="1.5" ry="1.9" fill={P.irisDeep} />
          <circle cx="68.2" cy="43.6" r="1.3" fill={P.eyeWhite} />
          <path d="M64 43 Q68.5 39.8 73 43" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round" />

          {/* Foreshortened 3/4 Far Eye (with Crisp Sclera + Specular Catchlight) */}
          <path d="M77.2 38.4 Q80.2 36.8 82.8 38.6" fill="none" stroke={P.ink} strokeWidth="1.7" strokeLinecap="round" />
          <ellipse cx="80.1" cy="45.1" rx="2.6" ry="4.3" fill={P.eyeWhite} stroke={P.ink} strokeWidth="1.3" />
          <ellipse cx="80.6" cy="45.5" rx="1.8" ry="3.2" fill={P.iris} />
          <ellipse cx="80.8" cy="46" rx="1" ry="1.7" fill={P.irisDeep} />
          <circle cx="79.8" cy="43.7" r="1" fill={P.eyeWhite} />
          <path d="M77.3 43.2 Q80.2 40.3 82.8 43.3" fill="none" stroke={P.ink} strokeWidth="2" strokeLinecap="round" />

          <path d="M73.5 54.8 Q77.2 56.3 79.8 54.4" fill="none" stroke={P.ink} strokeWidth="1.6" strokeLinecap="round" />

          {/* Swept Side-Profile Hair Dome & Tapered Bangs */}
          <path
            d="M44 43 C43 23 53 18 67 18 C78 18 86 23 86 36 L82 32 L78 38 L73 30 L67 39 L62 32 L57 42 L53 38 L50 45 Z"
            fill={P.hair}
            stroke={P.ink}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M52 25 Q66 21 79 25" fill="none" stroke={P.hairHighlight} strokeWidth="2.1" strokeLinecap="round" opacity="0.8" />
          {!hasCrown && (
            <path d="M49 22.5 Q66 18 81 23" fill="none" stroke={P.hairRim} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
          )}

          {renderHeadgear(3)}
        </g>
      </g>
    );
  };

  /* -------------------- TRUE BACK VIEW RIG (Facing UP) -------------------- */
  const renderBackCharacter = () => (
    <g>
      {/* Weapon & Relic Peeking Cleanly Behind Arms */}
      {renderWeapon(false)}
      {renderHeldRelic(false)}
      {renderBootPair()}

      {/* Coat Sleeves */}
      <path d="M50 64 L42 78 L47 81 L53 70 Z" fill={P.coat} stroke={P.ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M78 64 L86 78 L81 81 L75 70 Z" fill={P.coat} stroke={P.ink} strokeWidth="1.8" strokeLinejoin="round" />

      {/* Tailored Coat Back & Full Flowing Mantle */}
      <path
        d="M49 63 L79 63 L83 92 L66 92 L64 85 L62 92 L45 92 Z"
        fill={P.coat}
        stroke={P.ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {renderBackMantle()}
      {/* Back Scarf Knot & Flowing Ribbons */}
      <path d="M50 60 Q64 66 78 60 L76 66 Q64 70 52 66 Z" fill={P.scarf} stroke={P.ink} strokeWidth="1.8" />
      <path d="M61 65 L56 83 L62 84 L65 67 L69 82 L74 80 L68 65 Z" fill={P.scarf} stroke={P.ink} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Full Layered Back-of-Head Tousled Hair (Zero blank rectangles!) */}
      <g>
        <ellipse cx="42.5" cy="46" rx="3.2" ry="4.3" fill={P.skinShadow} stroke={P.ink} strokeWidth="1.6" />
        <ellipse cx="85.5" cy="46" rx="3.2" ry="4.3" fill={P.skinShadow} stroke={P.ink} strokeWidth="1.6" />
        <path
          d="M42 40 C42 23 51 18 64 18 C77 18 86 23 86 40 C86 50 83 57 78 61 L72 56 L68 62 L64 57 L60 62 L56 56 L50 61 C45 57 42 50 42 40 Z"
          fill={P.hair}
          stroke={P.ink}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path d="M49 28 Q64 23 79 28" fill="none" stroke={P.hairHighlight} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
        {!hasCrown && (
          <path d="M47 23 Q64 18 81 23" fill="none" stroke={P.hairRim} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
        )}
        <path d="M54 44 L52 54 M64 43 L64 54 M74 44 L76 54" stroke={P.hairMid} strokeWidth="1.5" strokeLinecap="round" />
        {renderHeadgear(0)}
      </g>
    </g>
  );

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 128 128"
      role="img"
      aria-label="领主角色形象"
    >
      <defs>
        <pattern
          id={hatchId}
          width="5"
          height="5"
          patternTransform="rotate(42 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--border-strong)" strokeWidth="0.8" strokeOpacity="0.18" />
        </pattern>
        <pattern
          id={sealHatchId}
          width="5"
          height="5"
          patternTransform="rotate(-38 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--seal-accent)" strokeWidth="1" strokeOpacity="0.28" />
        </pattern>
        <radialGradient id={glowId} cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor={P.parchment} stopOpacity="0.4" />
          <stop offset="68%" stopColor={P.parchment} stopOpacity="0.16" />
          <stop offset="100%" stopColor={P.parchment} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ==================== 0. BLUEPRINT DRAFTING PLATE (Profile / Stage) ==================== */}
      {isFramed ? (
        <g>
          <rect
            x="2.5"
            y="2.5"
            width="123"
            height="123"
            rx="3"
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="1.6"
          />
          <rect
            x="7"
            y="7"
            width="114"
            height="114"
            rx="2"
            fill="var(--surface-sunken)"
            fillOpacity="0.55"
            stroke="var(--border)"
            strokeWidth="0.9"
          />
          {/* Subtle Architectural Compass Ring & Drafting Crosshair */}
          <circle
            cx="64"
            cy="58"
            r="42"
            fill={`url(#${glowId})`}
            stroke={hasLegendary ? "var(--seal-accent)" : "var(--border)"}
            strokeWidth={hasLegendary ? "1.1" : "0.8"}
            strokeDasharray={hasLegendary ? "3 3" : "4 4"}
          />
          {/* Corner Caliper Ticks */}
          <path
            d="M11 18 V11 H18 M110 11 H117 V18 M11 110 V117 H18 M110 117 H117 V110"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.2"
          />
          {/* Perspective Stone Pedestal */}
          <ellipse
            cx="64"
            cy="110"
            rx="31"
            ry="7.5"
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="1.1"
            strokeOpacity="0.65"
          />
        </g>
      ) : (
        /* Token / Mini Pedestal Ring + Crisp Warm Halo for Dark Mode Map Contrast */
        <g>
          <circle cx="64" cy="60" r="46" fill={`url(#${glowId})`} />
          <ellipse
            cx="64"
            cy="110"
            rx="28"
            ry="7.5"
            fill="var(--surface)"
            stroke={hasLegendary ? "var(--seal-accent)" : "var(--border-strong)"}
            strokeWidth="1.8"
          />
          {facing === "up" && <polygon points="64,6 58,14 70,14" fill="var(--seal-accent)" />}
          {facing === "down" && <polygon points="64,122 58,114 70,114" fill="var(--seal-accent)" />}
          {facing === "left" && <polygon points="6,64 14,58 14,70" fill="var(--seal-accent)" />}
          {facing === "right" && <polygon points="122,64 114,58 114,70" fill="var(--seal-accent)" />}
        </g>
      )}

      {/* Soft Ink Ground Contact Shadow */}
      <ellipse cx="64" cy="110" rx="20" ry="4.5" fill={P.shadowWash} />

      {/* ==================== 1. BREATHING / WALKING CHARACTER BODY ==================== */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={isMoving ? "0,0; 0,-4; 0,0" : "0,0; 0,-1.8; 0,0"}
          dur={isMoving ? "0.32s" : "2.4s"}
          repeatCount="indefinite"
        />
        {isBack
          ? renderBackCharacter()
          : isSide
            ? renderSideCharacter()
            : renderFrontCharacter()}
      </g>

      {/* ==================== 2. COMPANION PET ==================== */}
      {renderCompanion()}
    </svg>
  );
}
