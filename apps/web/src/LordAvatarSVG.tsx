import type { EquippedCosmeticsDTO } from "@drop2empire/api-client";

interface LordAvatarSVGProps {
  cosmetics: EquippedCosmeticsDTO;
  weaponKey?: string;
  armorKey?: string;
  bootsKey?: string;
  size?: "profile" | "token" | "mini";
  isMoving?: boolean;
}

export function LordAvatarSVG({
  cosmetics,
  weaponKey = "",
  armorKey = "",
  bootsKey = "",
  size = "profile",
  isMoving = false,
}: LordAvatarSVGProps) {
  const dim = size === "profile" ? 124 : size === "token" ? 44 : 34;
  const isProfile = size === "profile";
  const hasLegendary =
    cosmetics.headgear === "cos_obsidian_crown" ||
    cosmetics.mantle === "cos_astral_wings" ||
    cosmetics.heldRelic === "cos_thunder_staff" ||
    cosmetics.companion === "cos_aether_drake";

  const ink = "var(--text-strong)";
  const muted = "var(--text-muted)";
  const paper = "var(--surface)";
  const sunken = "var(--surface-sunken)";
  const seal = "var(--seal-accent)";
  const brass = "var(--warning-text)";
  const verdigris = "var(--success-text)";

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 120 120"
      role="img"
      aria-label="领主纸墨工程蚀刻立绘"
    >
      <defs>
        {/* 45-degree fine pen-and-ink hatching */}
        <pattern
          id="lordInkHatch"
          width="5"
          height="5"
          patternTransform="rotate(42 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="5"
            stroke={ink}
            strokeWidth="0.9"
            strokeOpacity="0.28"
          />
        </pattern>

        {/* Dense architectural cross-hatching for deep cloak & pauldron shadows */}
        <pattern
          id="lordCrossHatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 6 L6 0 M-1 1 L1 -1 M5 7 L7 5"
            stroke={ink}
            strokeWidth="0.85"
            strokeOpacity="0.32"
          />
          <path
            d="M0 0 L6 6 M-1 5 L1 7 M5 -1 L7 1"
            stroke={ink}
            strokeWidth="0.7"
            strokeOpacity="0.22"
          />
        </pattern>

        {/* Cinnabar & Brass etching hatch for legendary/relic accents */}
        <pattern
          id="lordSealHatch"
          width="5"
          height="5"
          patternTransform="rotate(-35 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="5"
            stroke={seal}
            strokeWidth="1.1"
            strokeOpacity="0.35"
          />
        </pattern>
      </defs>

      {/* ==================== 0. BLUEPRINT DRAFTING PLATE (Profile View) ==================== */}
      {isProfile && (
        <g>
          <rect
            x="2"
            y="2"
            width="116"
            height="116"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <rect
            x="6"
            y="6"
            width="108"
            height="108"
            fill={sunken}
            fillOpacity="0.45"
            stroke={ink}
            strokeWidth="0.65"
            strokeDasharray="2.5 2.5"
          />
          {/* Orthogonal Blueprint Crosshairs */}
          <line
            x1="60"
            y1="6"
            x2="60"
            y2="114"
            stroke={ink}
            strokeOpacity="0.14"
            strokeWidth="0.65"
          />
          <line
            x1="6"
            y1="56"
            x2="114"
            y2="56"
            stroke={ink}
            strokeOpacity="0.14"
            strokeWidth="0.65"
          />
          {/* Corner Caliper Registration Marks */}
          <path
            d="M9 16 V9 H16 M104 9 H111 V16 M9 104 V111 H16 M104 111 H111 V104"
            fill="none"
            stroke={ink}
            strokeWidth="1.2"
          />
          {/* Technical Drafting Stamp */}
          <text
            x="11"
            y="16"
            fill={muted}
            fontSize="6.5"
            fontFamily="var(--font-mono)"
            letterSpacing="0.04em"
          >
            FIG.01·LORD
          </text>
          {/* Cinnabar Ink Seal Stamp */}
          <g transform="translate(97, 97)">
            <rect
              x="0"
              y="0"
              width="12"
              height="12"
              fill="none"
              stroke={seal}
              strokeWidth="1.1"
            />
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              fill={seal}
              fillOpacity="0.16"
            />
            <path
              d="M4 4 H8 M6 4 V8 M4 8 H8"
              stroke={seal}
              strokeWidth="1"
            />
          </g>
        </g>
      )}

      {/* ==================== ASTROLABE COMPASS HALO ==================== */}
      <g>
        <circle
          cx="60"
          cy="50"
          r={isProfile ? "38" : "42"}
          fill={isProfile ? "none" : paper}
          fillOpacity={isProfile ? "0" : "0.9"}
          stroke={ink}
          strokeWidth={isProfile ? "0.9" : "1.4"}
          strokeOpacity={isProfile ? "0.45" : "0.85"}
        />
        <circle
          cx="60"
          cy="50"
          r="32"
          fill="none"
          stroke={hasLegendary ? seal : ink}
          strokeWidth="0.9"
          strokeDasharray="4 2.5"
          strokeOpacity="0.65"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 50"
            to="360 60 50"
            dur="18s"
            repeatCount="indefinite"
          />
        </circle>
        {hasLegendary && (
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 60 50"
              to="0 60 50"
              dur="12s"
              repeatCount="indefinite"
            />
            <circle
              cx="60"
              cy="50"
              r="42"
              fill="none"
              stroke={seal}
              strokeWidth="1.1"
              strokeDasharray="1.5 4.5"
            />
            <polygon points="60,6 62.5,11 57.5,11" fill={seal} />
            <polygon points="60,94 62.5,89 57.5,89" fill={seal} />
            <polygon points="16,50 21,47.5 21,52.5" fill={seal} />
            <polygon points="104,50 99,47.5 99,52.5" fill={seal} />
          </g>
        )}
      </g>

      {/* Drafting Plinth / Shadow Base */}
      <g>
        <ellipse
          cx="60"
          cy="106"
          rx="26"
          ry="4.5"
          fill="url(#lordInkHatch)"
          stroke={ink}
          strokeWidth="1"
        >
          <animate
            attributeName="rx"
            values="26;23;26"
            dur={isMoving ? "0.38s" : "2.4s"}
            repeatCount="indefinite"
          />
        </ellipse>
      </g>

      {/* ==================== MAIN ARTICULATED LORD FIGURE ==================== */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={isMoving ? "0,0; 0,-4.5; 0,0" : "0,0; 0,-2.2; 0,0"}
          dur={isMoving ? "0.36s" : "2.4s"}
          repeatCount="indefinite"
        />

        {/* -------------------- 1. MANTLE / BACK APPARATUS (背饰) -------------------- */}
        {/* Default Surveyor Capelet */}
        {!cosmetics.mantle && (
          <path
            d="M38 50 L29 88 L44 86 L46 54 Z M82 50 L91 88 L76 86 L74 54 Z"
            fill="url(#lordInkHatch)"
            stroke={ink}
            strokeWidth="1.4"
          />
        )}

        {/* Sandstorm Field Cloak */}
        {cosmetics.mantle === "cos_sand_cloak" && (
          <g>
            <path
              d="M36 48 C22 64 20 84 23 102 L40 99 L46 103 L60 98 L74 103 L80 99 L97 102 C100 84 98 64 84 48 Z"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.8"
            />
            <path
              d="M36 48 C24 64 22 84 25 100 L42 97 L60 96 L78 97 L95 100 C98 84 96 64 84 48 Z"
              fill="url(#lordCrossHatch)"
            />
            {/* Cloak Fold Pleats */}
            <path
              d="M39 54 L31 98 M81 54 L89 98 M46 58 L41 97 M74 58 L79 97"
              stroke={ink}
              strokeWidth="1"
              strokeOpacity="0.65"
            />
          </g>
        )}

        {/* Da Vinci Hydraulic Condenser Wings */}
        {cosmetics.mantle === "cos_hydro_wings" && (
          <g>
            {/* Left Condenser Wing */}
            <path
              d="M42 52 L11 36 L14 54 L22 64 L18 74 L42 72 Z"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            <path
              d="M42 52 L11 36 L22 64 L42 72 Z"
              fill="url(#lordInkHatch)"
            />
            <line
              x1="40"
              y1="56"
              x2="14"
              y2="46"
              stroke={verdigris}
              strokeWidth="1.6"
            />
            <line
              x1="40"
              y1="62"
              x2="20"
              y2="62"
              stroke={verdigris}
              strokeWidth="1.3"
            />
            {/* Right Condenser Wing */}
            <path
              d="M78 52 L109 36 L106 54 L98 64 L102 74 L78 72 Z"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            <path
              d="M78 52 L109 36 L98 64 L78 72 Z"
              fill="url(#lordInkHatch)"
            />
            <line
              x1="80"
              y1="56"
              x2="106"
              y2="46"
              stroke={verdigris}
              strokeWidth="1.6"
            />
            <line
              x1="80"
              y1="62"
              x2="100"
              y2="62"
              stroke={verdigris}
              strokeWidth="1.3"
            />
            {/* Dripping Ink-Hydro Condensates */}
            <polygon
              points="18,78 15.5,83 18,86 20.5,83"
              fill={verdigris}
              stroke={ink}
              strokeWidth="0.8"
            >
              <animate
                attributeName="transform"
                type="translate"
                values="0,0; 0,14"
                dur="1.1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0"
                dur="1.1s"
                repeatCount="indefinite"
              />
            </polygon>
            <polygon
              points="102,78 99.5,83 102,86 104.5,83"
              fill={verdigris}
              stroke={ink}
              strokeWidth="0.8"
            >
              <animate
                attributeName="transform"
                type="translate"
                values="0,0; 0,14"
                dur="1.1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0"
                dur="1.1s"
                repeatCount="indefinite"
              />
            </polygon>
          </g>
        )}

        {/* Legendary Celestial Astrolabe Pinion Wings */}
        {cosmetics.mantle === "cos_astral_wings" && (
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-2.5 60 58; 2.5 60 58; -2.5 60 58"
              dur="1.8s"
              repeatCount="indefinite"
            />
            {/* Left Multi-Blade Pinion */}
            <polygon
              points="42,52 7,26 15,44 42,58"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            <polygon
              points="42,58 6,48 14,62 42,65"
              fill="url(#lordSealHatch)"
              stroke={ink}
              strokeWidth="1.5"
            />
            <polygon
              points="42,65 12,68 20,80 42,72"
              fill={paper}
              stroke={ink}
              strokeWidth="1.4"
            />
            {/* Right Multi-Blade Pinion */}
            <polygon
              points="78,52 113,26 105,44 78,58"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            <polygon
              points="78,58 114,48 106,62 78,65"
              fill="url(#lordSealHatch)"
              stroke={ink}
              strokeWidth="1.5"
            />
            <polygon
              points="78,65 108,68 100,80 78,72"
              fill={paper}
              stroke={ink}
              strokeWidth="1.4"
            />
            {/* Astrolabe Wing Arcs */}
            <path
              d="M20 34 A32 32 0 0 0 22 76 M100 34 A32 32 0 0 1 98 76"
              fill="none"
              stroke={seal}
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
          </g>
        )}

        {/* -------------------- 2. ARTICULATED GREAVES & BOOTS (战靴) -------------------- */}
        <g>
          {/* Left & Right Mechanical Greaves */}
          <path
            d="M46 84 H56 L55 103 H44 Z"
            fill={
              bootsKey === "gear_hermes_boots"
                ? paper
                : bootsKey === "gear_spring_boots"
                  ? sunken
                  : "url(#lordInkHatch)"
            }
            stroke={ink}
            strokeWidth="1.7"
          />
          <path
            d="M64 84 H74 L76 103 H65 Z"
            fill={
              bootsKey === "gear_hermes_boots"
                ? paper
                : bootsKey === "gear_spring_boots"
                  ? sunken
                  : "url(#lordInkHatch)"
            }
            stroke={ink}
            strokeWidth="1.7"
          />
          {/* Knee Rivet Joints */}
          <circle
            cx="51"
            cy="88"
            r="2.2"
            fill={paper}
            stroke={ink}
            strokeWidth="1.3"
          />
          <circle
            cx="69"
            cy="88"
            r="2.2"
            fill={paper}
            stroke={ink}
            strokeWidth="1.3"
          />
          {/* Boot Soles */}
          <rect x="43" y="101" width="13" height="3.5" fill={ink} />
          <rect x="64" y="101" width="13" height="3.5" fill={ink} />

          {/* Spring Boots Coils */}
          {bootsKey === "gear_spring_boots" && (
            <path
              d="M41 90 L44 92 L41 95 L44 97 L41 100 M79 90 L76 92 L79 95 L76 97 L79 100"
              fill="none"
              stroke={brass}
              strokeWidth="1.6"
            />
          )}

          {/* Hermes Pinion Finlets */}
          {bootsKey === "gear_hermes_boots" && (
            <g>
              <polygon
                points="44,95 34,88 37,96 34,100 44,100"
                fill={paper}
                stroke={seal}
                strokeWidth="1.3"
              />
              <polygon
                points="76,95 86,88 83,96 86,100 76,100"
                fill={paper}
                stroke={seal}
                strokeWidth="1.3"
              />
            </g>
          )}
        </g>

        {/* -------------------- 3. ARCHITECTURAL CUIRASS & PAULDRONS (护甲与躯干) -------------------- */}
        <g>
          {/* Base Armored Coat Skirt */}
          <polygon
            points="42,78 78,78 82,91 64,91 60,84 56,91 38,91"
            fill="url(#lordCrossHatch)"
            stroke={ink}
            strokeWidth="1.6"
          />

          {/* Main Sculpted Breastplate */}
          <polygon
            points="39,50 49,45 71,45 81,50 77,80 43,80"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          {/* Left Shadow Facet on Cuirass */}
          <polygon points="39,50 49,45 53,80 43,80" fill="url(#lordInkHatch)" />

          {/* Left & Right Drafted Pauldrons (Shoulder Plates) */}
          <polygon
            points="32,53 43,45 48,54 36,60"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.8"
          />
          <polygon
            points="88,53 77,45 72,54 84,60"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.8"
          />

          {/* Armor Variant Details */}
          {armorKey === "gear_carapace_armor" && (
            <g>
              <path
                d="M46 54 L60 49 L74 54 M45 62 L60 57 L75 62 M46 70 L60 65 L74 70"
                fill="none"
                stroke={ink}
                strokeWidth="1.3"
              />
              <polygon
                points="60,55 66,62 60,69 54,62"
                fill="url(#lordSealHatch)"
                stroke={seal}
                strokeWidth="1.5"
              />
            </g>
          )}

          {armorKey === "gear_hydro_armor" && (
            <g>
              <circle
                cx="51"
                cy="58"
                r="3.2"
                fill={paper}
                stroke={verdigris}
                strokeWidth="1.3"
              />
              <circle
                cx="69"
                cy="58"
                r="3.2"
                fill={paper}
                stroke={verdigris}
                strokeWidth="1.3"
              />
              <circle
                cx="60"
                cy="65"
                r="5.5"
                fill={paper}
                stroke={verdigris}
                strokeWidth="1.8"
              />
              <path
                d="M57 65 H63 M60 62 V68"
                stroke={verdigris}
                strokeWidth="1.4"
              />
            </g>
          )}

          {armorKey !== "gear_carapace_armor" &&
            armorKey !== "gear_hydro_armor" && (
              <g>
                {/* Standard / Splint Drafting Seam & Chronometer Core */}
                <line
                  x1="60"
                  y1="46"
                  x2="60"
                  y2="78"
                  stroke={ink}
                  strokeWidth="1.2"
                />
                <line
                  x1="44"
                  y1="57"
                  x2="76"
                  y2="57"
                  stroke={ink}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx="60"
                  cy="63"
                  r="5"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.6"
                />
                <circle cx="60" cy="63" r="2" fill={seal} />
              </g>
            )}

          {/* Utility Surveyor Belt */}
          <rect
            x="42"
            y="76"
            width="36"
            height="4.5"
            fill={ink}
            stroke={ink}
            strokeWidth="1"
          />
          <rect
            x="56.5"
            y="75"
            width="7"
            height="6.5"
            fill={paper}
            stroke={ink}
            strokeWidth="1.4"
          />
        </g>

        {/* -------------------- 4. CHISELED PORCELAIN-INK HEAD & VISOR (头部与面甲) -------------------- */}
        <g>
          {/* High Surveyor Collar */}
          <polygon
            points="44,47 39,36 50,41 60,44 70,41 81,36 76,47"
            fill={ink}
          />
          {/* Sculpted Hexagonal Mask / Visage */}
          <polygon
            points="46,25 60,20 74,25 73,41 60,48 47,41"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          {/* Left Face Etched Shadow Plane */}
          <polygon
            points="46,25 54,22 54,44 47,41"
            fill="url(#lordInkHatch)"
          />
          {/* Center Nose-Bridge & Chin Plumb Line */}
          <line
            x1="60"
            y1="23"
            x2="60"
            y2="40"
            stroke={ink}
            strokeWidth="1"
            strokeOpacity="0.55"
          />
          {/* Brow Bar */}
          <path
            d="M48 32 L57 34 M72 32 L63 34"
            stroke={ink}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Sharp Mechanical Optical Eyes (with shutter blink) */}
          <g>
            <polygon points="50,35 57,36 56,38.5 50,37.8" fill={ink}>
              <animate
                attributeName="points"
                values="50,35 57,36 56,38.5 50,37.8; 50,35 57,36 56,38.5 50,37.8; 50,36.8 57,36.8 56,37.2 50,37.2; 50,35 57,36 56,38.5 50,37.8"
                keyTimes="0;0.46;0.5;1"
                dur="3.8s"
                repeatCount="indefinite"
              />
            </polygon>
            <polygon points="70,35 63,36 64,38.5 70,37.8" fill={ink}>
              <animate
                attributeName="points"
                values="70,35 63,36 64,38.5 70,37.8; 70,35 63,36 64,38.5 70,37.8; 70,36.8 63,36.8 64,37.2 70,37.2; 70,35 63,36 64,38.5 70,37.8"
                keyTimes="0;0.46;0.5;1"
                dur="3.8s"
                repeatCount="indefinite"
              />
            </polygon>
            {/* Pinpoint Optical Glint */}
            <circle cx="53.5" cy="36.6" r="0.9" fill={paper} />
            <circle cx="66.5" cy="36.6" r="0.9" fill={paper} />
          </g>
          {/* respirator / stern mouth line */}
          <path d="M56 42.5 H64" stroke={ink} strokeWidth="1.5" />
        </g>

        {/* -------------------- 5. HEADGEAR (头饰) -------------------- */}
        {/* Default Draftsman Tricorn Crest & Quill */}
        {!cosmetics.headgear && (
          <g>
            <polygon
              points="41,27 60,15 79,27 73,28 60,21 47,28"
              fill={ink}
              stroke={ink}
              strokeWidth="1.2"
            />
            {/* Surveyor Quill Plume */}
            <path
              d="M71 22 C77 14 84 11 86 15 C82 18 77 22 72 24 Z"
              fill={paper}
              stroke={ink}
              strokeWidth="1.3"
            />
          </g>
        )}

        {/* Brass & Verdigris Surveyor Goggles */}
        {cosmetics.headgear === "cos_goggles" && (
          <g>
            <polygon
              points="43,27 60,18 77,27 43,27"
              fill="url(#lordCrossHatch)"
              stroke={ink}
              strokeWidth="1.5"
            />
            <rect
              x="43"
              y="22"
              width="34"
              height="8"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.6"
            />
            <circle
              cx="52"
              cy="26"
              r="5"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            <circle
              cx="68"
              cy="26"
              r="5"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            {/* Reticle Crosshairs Inside Lenses */}
            <path
              d="M49 26 H55 M52 23 V29 M65 26 H71 M68 23 V29"
              stroke={verdigris}
              strokeWidth="1.1"
            />
          </g>
        )}

        {/* Clockwork Escapement Steam Crown */}
        {cosmetics.headgear === "cos_steam_crown" && (
          <g>
            <polygon
              points="42,26 45,14 53,21 60,10 67,21 75,14 78,26"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            <polygon
              points="44,25 46,16 53,22 60,12 60,25"
              fill="url(#lordInkHatch)"
            />
            {/* Rotating Central Escapement Gear */}
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 20"
                to="360 60 20"
                dur="5s"
                repeatCount="indefinite"
              />
              <circle
                cx="60"
                cy="20"
                r="4.5"
                fill={paper}
                stroke={brass}
                strokeWidth="1.6"
              />
              <path
                d="M60 13.5 V26.5 M53.5 20 H66.5 M55.5 15.5 L64.5 24.5 M64.5 15.5 L55.5 24.5"
                stroke={ink}
                strokeWidth="1.2"
              />
              <circle cx="60" cy="20" r="1.6" fill={seal} />
            </g>
          </g>
        )}

        {/* Legendary Fractured Obsidian Monolith Crown */}
        {cosmetics.headgear === "cos_obsidian_crown" && (
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-2.5; 0,0"
              dur="1.8s"
              repeatCount="indefinite"
            />
            <polygon
              points="40,25 45,9 53,20 60,4 67,20 75,9 80,25"
              fill={ink}
              stroke={seal}
              strokeWidth="1.6"
            />
            {/* Levitating Cinnabar Keystone */}
            <polygon
              points="60,8 63.5,14 60,20 56.5,14"
              fill={paper}
              stroke={seal}
              strokeWidth="1.4"
            />
            <circle cx="60" cy="14" r="1.5" fill={seal} />
          </g>
        )}

        {/* -------------------- 6. LEFT-HAND TACTICAL WEAPON (左持武器) -------------------- */}
        {weaponKey !== "" && (
          <g>
            {/* Shaft */}
            <line
              x1="31"
              y1="96"
              x2="21"
              y2="34"
              stroke={ink}
              strokeWidth="2.4"
              strokeLinecap="square"
            />
            {weaponKey === "gear_titan_hammer" ? (
              <g transform="rotate(-10 21 38)">
                <rect
                  x="11"
                  y="32"
                  width="20"
                  height="11"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <rect
                  x="11"
                  y="32"
                  width="10"
                  height="11"
                  fill="url(#lordCrossHatch)"
                />
                <line
                  x1="11"
                  y1="37.5"
                  x2="31"
                  y2="37.5"
                  stroke={seal}
                  strokeWidth="1.4"
                />
              </g>
            ) : weaponKey === "gear_iron_crossbow" ? (
              <g>
                <path
                  d="M11 46 Q22 34 33 44"
                  fill="none"
                  stroke={ink}
                  strokeWidth="2"
                />
                <line
                  x1="11"
                  y1="46"
                  x2="33"
                  y2="44"
                  stroke={ink}
                  strokeWidth="0.9"
                  strokeDasharray="1.5 1.5"
                />
              </g>
            ) : (
              /* Flint Surveyor Halberd Spearhead */
              <g>
                <polygon
                  points="19,22 14,37 21,34 26,36"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.7"
                />
                <polygon points="19,22 14,37 21,34" fill="url(#lordInkHatch)" />
              </g>
            )}
          </g>
        )}

        {/* -------------------- 7. RIGHT-HAND HELD RELIC (右持圣物) -------------------- */}
        {/* Surveyor's Astrolabe Compass */}
        {cosmetics.heldRelic === "cos_compass" && (
          <g>
            <line
              x1="84"
              y1="58"
              x2="92"
              y2="68"
              stroke={ink}
              strokeWidth="1.5"
            />
            <circle
              cx="92"
              cy="75"
              r="8.5"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            <circle
              cx="92"
              cy="75"
              r="6"
              fill="none"
              stroke={ink}
              strokeWidth="0.7"
              strokeDasharray="1.5 1.5"
            />
            <polygon points="92,69 94,75 92,81 90,75" fill={seal}>
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-25 92 75; 25 92 75; -25 92 75"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </polygon>
          </g>
        )}

        {/* Octagonal Alchemical Verdigris Lantern */}
        {cosmetics.heldRelic === "cos_alch_lantern" && (
          <g>
            <path
              d="M83 56 L93 56 L93 62"
              fill="none"
              stroke={ink}
              strokeWidth="1.5"
            />
            <polygon
              points="89,62 97,62 100,67 100,76 97,81 89,81 86,76 86,67"
              fill={paper}
              stroke={ink}
              strokeWidth="1.7"
            />
            <line
              x1="93"
              y1="62"
              x2="93"
              y2="81"
              stroke={ink}
              strokeWidth="0.9"
            />
            <polygon
              points="93,66 96.5,72 93,77 89.5,72"
              fill={verdigris}
              stroke={ink}
              strokeWidth="0.9"
            >
              <animate
                attributeName="opacity"
                values="1;0.45;1"
                dur="1.3s"
                repeatCount="indefinite"
              />
            </polygon>
          </g>
        )}

        {/* Legendary Clockwork Gyroscope Thunder Staff */}
        {cosmetics.heldRelic === "cos_thunder_staff" && (
          <g>
            <line
              x1="91"
              y1="98"
              x2="95"
              y2="34"
              stroke={ink}
              strokeWidth="2.4"
            />
            {/* Graduated Ruler Ticks on Staff */}
            <path
              d="M90 50 H94 M90 60 H94 M90 70 H94 M90 80 H94"
              stroke={ink}
              strokeWidth="1"
            />
            {/* Spinning Gyroscope Head */}
            <circle
              cx="95"
              cy="28"
              r="9"
              fill={paper}
              stroke={ink}
              strokeWidth="1.7"
            />
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 95 28"
                to="360 95 28"
                dur="3.2s"
                repeatCount="indefinite"
              />
              <ellipse
                cx="95"
                cy="28"
                rx="8"
                ry="3.5"
                fill="none"
                stroke={seal}
                strokeWidth="1.3"
              />
              <ellipse
                cx="95"
                cy="28"
                rx="3.5"
                ry="8"
                fill="none"
                stroke={ink}
                strokeWidth="1.2"
              />
            </g>
            <circle cx="95" cy="28" r="2.2" fill={seal} />
          </g>
        )}
      </g>

      {/* ==================== 8. AUTOMATON COMPANION (机关随从) ==================== */}
      {/* Origami / Woodcut Clockwork Frog */}
      {cosmetics.companion === "cos_wood_frog" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-5; 0,0"
            dur="1.1s"
            repeatCount="indefinite"
          />
          <polygon
            points="13,98 18,89 27,89 31,98 25,102 16,102"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <polygon
            points="13,98 18,89 22,98"
            fill="url(#lordInkHatch)"
          />
          {/* Wind-up Key */}
          <path
            d="M16 89 L13 84 M11 85 A2.5 2.5 0 1 1 15 83"
            fill="none"
            stroke={brass}
            strokeWidth="1.3"
          />
          <circle cx="25" cy="92" r="1.4" fill={ink} />
        </g>
      )}

      {/* Da Vinci Clockwork Owl */}
      {cosmetics.companion === "cos_mech_owl" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-4.5; 0,0"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <polygon
            points="15,24 22,19 29,24 27,37 22,40 17,37"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <polygon
            points="15,24 22,19 22,40 17,37"
            fill="url(#lordInkHatch)"
          />
          {/* Twin Optical Loupe Eyes */}
          <circle
            cx="19"
            cy="27"
            r="2.8"
            fill={paper}
            stroke={ink}
            strokeWidth="1.4"
          />
          <circle
            cx="25"
            cy="27"
            r="2.8"
            fill={paper}
            stroke={ink}
            strokeWidth="1.4"
          />
          <circle cx="19" cy="27" r="1" fill={seal} />
          <circle cx="25" cy="27" r="1" fill={seal} />
          <polygon points="22,29 20.5,32 23.5,32" fill={ink} />
        </g>
      )}

      {/* Legendary Articulated Celestial Clockwork Wyrm (Aether Drake) */}
      {cosmetics.companion === "cos_aether_drake" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 2.5,-5; 0,0"
            dur="1.7s"
            repeatCount="indefinite"
          />
          {/* Segmented Mechanical Spine & Fin */}
          <path
            d="M11 36 C12 22 24 16 33 24 C27 29 20 28 16 38 Z"
            fill={paper}
            stroke={ink}
            strokeWidth="1.7"
          />
          <path
            d="M12 34 C14 23 23 19 31 24"
            fill="url(#lordSealHatch)"
          />
          {/* Drafting Vertebrae Ticks */}
          <path
            d="M15 24 L12 20 M20 20 L19 15 M26 20 L27 15"
            stroke={ink}
            strokeWidth="1.3"
          />
          {/* Orbiting Cinnabar Astrolabe Pearl */}
          <circle
            cx="35"
            cy="27"
            r="2.6"
            fill={paper}
            stroke={seal}
            strokeWidth="1.5"
          />
          <circle cx="35" cy="27" r="1" fill={seal} />
        </g>
      )}
    </svg>
  );
}
