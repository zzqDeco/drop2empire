import type { EquippedCosmeticsDTO } from "@drop2empire/api-client";

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
 * 2.5D Isometric Voxel (Minecraft-proportioned) Blueprint & Ink Character Renderer.
 * Supports 4-directional facing ("down" | "up" | "left" | "right"), walking limb articulation,
 * and full 3D cubic rendering of all S1 cosmetics, weapons, armors, and boots.
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
  const dim =
    size === "stage"
      ? 168
      : size === "profile"
        ? 128
        : size === "token"
          ? 48
          : 36;
  const isFramed = size === "profile" || size === "stage";
  const isBack = facing === "up";
  const isLeft = facing === "left";
  const isRight = facing === "right";

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

  // Horizontal directional shift/skew for 4-way turning feel
  const dirShiftX = isLeft ? -4 : isRight ? 4 : 0;
  const flipScaleX = isLeft ? -1 : 1;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`领主体素立绘 (${facing})`}
    >
      <defs>
        <pattern
          id="voxelSideHatch"
          width="4"
          height="4"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="4"
            stroke={ink}
            strokeWidth="1.1"
            strokeOpacity="0.32"
          />
        </pattern>
        <pattern
          id="voxelDeepHatch"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 4 L4 0 M0 0 L4 4"
            stroke={ink}
            strokeWidth="0.9"
            strokeOpacity="0.36"
          />
        </pattern>
        <pattern
          id="voxelSealHatch"
          width="4"
          height="4"
          patternTransform="rotate(-45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="4"
            stroke={seal}
            strokeWidth="1.2"
            strokeOpacity="0.38"
          />
        </pattern>
      </defs>

      {/* ==================== 0. BLUEPRINT DRAFTING PLATE (Profile / Stage) ==================== */}
      {isFramed && (
        <g>
          <rect
            x="2"
            y="2"
            width="116"
            height="116"
            fill={paper}
            stroke={ink}
            strokeWidth="1.8"
          />
          <rect
            x="6"
            y="6"
            width="108"
            height="108"
            fill={sunken}
            fillOpacity="0.45"
            stroke={ink}
            strokeWidth="0.7"
            strokeDasharray="3 3"
          />
          {/* Isometric Voxel Floor Grid */}
          <path
            d="M22 96 L60 82 L98 96 L60 110 Z"
            fill={paper}
            stroke={ink}
            strokeWidth="1"
            strokeOpacity="0.55"
          />
          <path
            d="M41 89 L79 103 M79 89 L41 103"
            stroke={ink}
            strokeWidth="0.6"
            strokeOpacity="0.28"
          />
          {/* Corner Caliper Marks */}
          <path
            d="M9 16 V9 H16 M104 9 H111 V16 M9 104 V111 H16 M104 111 H111 V104"
            fill="none"
            stroke={ink}
            strokeWidth="1.3"
          />
          <text
            x="11"
            y="16"
            fill={muted}
            fontSize="6.5"
            fontFamily="var(--font-mono)"
          >
            MC·VOXEL·{facing.toUpperCase()}
          </text>
          {hasLegendary && (
            <circle
              cx="60"
              cy="52"
              r="40"
              fill="none"
              stroke={seal}
              strokeWidth="1"
              strokeDasharray="2 4"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 52"
                to="360 60 52"
                dur="14s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      )}

      {/* Token Floor Ring when on 2D Map */}
      {!isFramed && (
        <g>
          <ellipse
            cx="60"
            cy="104"
            rx="28"
            ry="8"
            fill={paper}
            stroke={hasLegendary ? seal : ink}
            strokeWidth="1.8"
          />
          {/* Facing Direction Indicator Arrow on Floor */}
          {facing === "up" && <polygon points="60,8 54,16 66,16" fill={seal} />}
          {facing === "down" && (
            <polygon points="60,116 54,108 66,108" fill={seal} />
          )}
          {facing === "left" && (
            <polygon points="8,60 16,54 16,66" fill={seal} />
          )}
          {facing === "right" && (
            <polygon points="112,60 104,54 104,66" fill={seal} />
          )}
        </g>
      )}

      {/* Isometric Voxel Drop Shadow */}
      <polygon
        points="36,101 60,94 84,101 60,108"
        fill="url(#voxelSideHatch)"
        stroke={ink}
        strokeWidth="0.9"
      />

      {/* ==================== MAIN 2.5D MINECRAFT VOXEL RIG ==================== */}
      <g
        transform={`translate(${60 + dirShiftX}, 0) scale(${flipScaleX}, 1) translate(-60, 0)`}
      >
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={isMoving ? "0,0; 0,-5; 0,0" : "0,0; 0,-2; 0,0"}
            dur={isMoving ? "0.28s" : "2.2s"}
            repeatCount="indefinite"
          />

          {/* -------------------- 1. BACK MANTLE LAYER (Behind Body when facing down/side) -------------------- */}
          {!isBack && (
            <g>
              {cosmetics.mantle === "cos_sand_cloak" && (
                <g>
                  <polygon
                    points="34,50 86,50 92,94 28,94"
                    fill={sunken}
                    stroke={ink}
                    strokeWidth="1.8"
                  />
                  <polygon
                    points="34,50 48,50 44,94 28,94"
                    fill="url(#voxelDeepHatch)"
                  />
                </g>
              )}
              {cosmetics.mantle === "cos_hydro_wings" && (
                <g>
                  {/* Voxel Stepped Hydro Wings */}
                  <polygon
                    points="42,50 12,34 12,48 20,48 20,60 28,60 28,70 42,70"
                    fill={paper}
                    stroke={ink}
                    strokeWidth="1.7"
                  />
                  <polygon
                    points="78,50 108,34 108,48 100,48 100,60 92,60 92,70 78,70"
                    fill={paper}
                    stroke={ink}
                    strokeWidth="1.7"
                  />
                  <rect
                    x="16"
                    y="40"
                    width="18"
                    height="4"
                    fill={verdigris}
                    stroke={ink}
                    strokeWidth="0.9"
                  />
                  <rect
                    x="86"
                    y="40"
                    width="18"
                    height="4"
                    fill={verdigris}
                    stroke={ink}
                    strokeWidth="0.9"
                  />
                </g>
              )}
              {cosmetics.mantle === "cos_astral_wings" && (
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="1,1; 1.04,0.97; 1,1"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                  {/* Pixel-Stepped Astral Wings */}
                  <polygon
                    points="40,48 6,26 6,42 14,42 14,56 22,56 22,68 40,68"
                    fill="url(#voxelSealHatch)"
                    stroke={seal}
                    strokeWidth="1.8"
                  />
                  <polygon
                    points="80,48 114,26 114,42 106,42 106,56 98,56 98,68 80,68"
                    fill="url(#voxelSealHatch)"
                    stroke={seal}
                    strokeWidth="1.8"
                  />
                  <rect x="12" y="34" width="8" height="8" fill={seal} />
                  <rect x="100" y="34" width="8" height="8" fill={seal} />
                </g>
              )}
            </g>
          )}

          {/* -------------------- 2. VOXEL LEGS & BOOTS (Left & Right 3D Rectangular Prisms) -------------------- */}
          <g>
            {/* Left Voxel Leg */}
            <g>
              {isMoving && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,-3; 0,3; 0,-3"
                  dur="0.28s"
                  repeatCount="indefinite"
                />
              )}
              {/* Front Face */}
              <rect
                x="44"
                y="76"
                width="12"
                height="24"
                fill={
                  bootsKey === "gear_hermes_boots"
                    ? paper
                    : bootsKey === "gear_spring_boots"
                      ? sunken
                      : "url(#voxelSideHatch)"
                }
                stroke={ink}
                strokeWidth="1.8"
              />
              {/* 3D Side Depth Face */}
              <polygon
                points="56,76 60,73 60,97 56,100"
                fill="url(#voxelDeepHatch)"
                stroke={ink}
                strokeWidth="1.4"
              />
              {/* Voxel Boot Cuff & Sole */}
              <rect
                x="43"
                y="90"
                width="14"
                height="10"
                fill={bootsKey === "gear_hermes_boots" ? seal : ink}
                fillOpacity={bootsKey === "gear_hermes_boots" ? "0.22" : "0.85"}
                stroke={ink}
                strokeWidth="1.6"
              />
              {bootsKey === "gear_hermes_boots" && (
                <polygon
                  points="43,92 35,86 35,96 43,98"
                  fill={paper}
                  stroke={seal}
                  strokeWidth="1.4"
                />
              )}
            </g>

            {/* Right Voxel Leg */}
            <g>
              {isMoving && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,3; 0,-3; 0,3"
                  dur="0.28s"
                  repeatCount="indefinite"
                />
              )}
              {/* Front Face */}
              <rect
                x="62"
                y="76"
                width="12"
                height="24"
                fill={
                  bootsKey === "gear_hermes_boots"
                    ? paper
                    : bootsKey === "gear_spring_boots"
                      ? sunken
                      : "url(#voxelSideHatch)"
                }
                stroke={ink}
                strokeWidth="1.8"
              />
              {/* 3D Side Depth Face */}
              <polygon
                points="74,76 78,73 78,97 74,100"
                fill="url(#voxelDeepHatch)"
                stroke={ink}
                strokeWidth="1.4"
              />
              {/* Voxel Boot Cuff & Sole */}
              <rect
                x="61"
                y="90"
                width="14"
                height="10"
                fill={bootsKey === "gear_hermes_boots" ? seal : ink}
                fillOpacity={bootsKey === "gear_hermes_boots" ? "0.22" : "0.85"}
                stroke={ink}
                strokeWidth="1.6"
              />
              {bootsKey === "gear_spring_boots" && (
                <path
                  d="M62 86 H74 M62 89 H74"
                  stroke={brass}
                  strokeWidth="1.8"
                />
              )}
            </g>
          </g>

          {/* -------------------- 3. VOXEL TORSO & CUIRASS (3D Blocky Chest) -------------------- */}
          <g>
            {/* Torso Top Isometric Bevel */}
            <polygon
              points="42,48 48,43 80,43 76,48"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            {/* Torso Main Front/Back Block (34x28) */}
            <rect
              x="42"
              y="48"
              width="34"
              height="28"
              fill={paper}
              stroke={ink}
              strokeWidth="2"
            />
            {/* Torso 3D Right Depth Face */}
            <polygon
              points="76,48 82,43 82,71 76,76"
              fill="url(#voxelSideHatch)"
              stroke={ink}
              strokeWidth="1.8"
            />

            {/* Voxel Armor Plating Details */}
            {armorKey === "gear_hydro_armor" ? (
              <g>
                <rect
                  x="45"
                  y="51"
                  width="28"
                  height="20"
                  fill={sunken}
                  stroke={verdigris}
                  strokeWidth="1.6"
                />
                <rect
                  x="54"
                  y="55"
                  width="10"
                  height="10"
                  fill={paper}
                  stroke={verdigris}
                  strokeWidth="1.8"
                />
                <rect x="57" y="58" width="4" height="4" fill={verdigris} />
              </g>
            ) : armorKey === "gear_carapace_armor" ? (
              <g>
                <rect
                  x="45"
                  y="51"
                  width="28"
                  height="20"
                  fill="url(#voxelSealHatch)"
                  stroke={ink}
                  strokeWidth="1.6"
                />
                <polygon
                  points="59,53 66,61 59,69 52,61"
                  fill={paper}
                  stroke={seal}
                  strokeWidth="1.6"
                />
              </g>
            ) : (
              <g>
                {/* Pixel Belt & Chest Strap */}
                <rect
                  x="42"
                  y="70"
                  width="34"
                  height="6"
                  fill={ink}
                />
                <rect
                  x="55"
                  y="69"
                  width="8"
                  height="7"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.5"
                />
                <path
                  d="M46 52 H72 M46 58 H72"
                  stroke={ink}
                  strokeWidth="1.2"
                  strokeOpacity="0.4"
                />
                <rect
                  x="55"
                  y="54"
                  width="8"
                  height="8"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.5"
                />
                <rect x="57" y="56" width="4" height="4" fill={seal} />
              </g>
            )}
          </g>

          {/* -------------------- 4. VOXEL ARMS, WEAPON & RELIC -------------------- */}
          {/* Left Voxel Arm (Screen-Left: Weapon Arm) */}
          <g>
            {isMoving && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,3; 0,-3; 0,3"
                dur="0.28s"
                repeatCount="indefinite"
              />
            )}
            {/* Top Face of Left Shoulder Block */}
            <polygon
              points="30,49 36,44 46,44 42,49"
              fill={paper}
              stroke={ink}
              strokeWidth="1.5"
            />
            {/* Front Face of Left Arm */}
            <rect
              x="30"
              y="49"
              width="12"
              height="24"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.8"
            />
            {/* Voxel Fist */}
            <rect
              x="31"
              y="67"
              width="10"
              height="7"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />

            {/* Equipped Voxel Weapon (Pixel-Stepped Minecraft Style!) */}
            {weaponKey === "gear_titan_hammer" ? (
              <g transform="translate(10, 26)">
                <rect
                  x="22"
                  y="18"
                  width="4"
                  height="42"
                  fill={ink}
                />
                <polygon
                  points="8,8 40,8 44,4 12,4"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.6"
                />
                <rect
                  x="8"
                  y="8"
                  width="32"
                  height="16"
                  fill="url(#voxelSealHatch)"
                  stroke={ink}
                  strokeWidth="2"
                />
                <rect x="18" y="12" width="12" height="8" fill={seal} />
              </g>
            ) : weaponKey === "gear_repeat_crossbow" ? (
              <g transform="translate(8, 50)">
                <rect
                  x="6"
                  y="14"
                  width="24"
                  height="7"
                  fill={ink}
                />
                <path
                  d="M10 4 L18 14 L10 28"
                  fill="none"
                  stroke={brass}
                  strokeWidth="2.5"
                />
                <rect
                  x="14"
                  y="9"
                  width="12"
                  height="6"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.5"
                />
              </g>
            ) : weaponKey === "gear_flint_bow" ? (
              <g transform="translate(12, 42)">
                <path
                  d="M20 4 L10 14 L10 26 L20 36"
                  fill="none"
                  stroke={ink}
                  strokeWidth="2.4"
                />
                <line
                  x1="20"
                  y1="4"
                  x2="20"
                  y2="36"
                  stroke={muted}
                  strokeWidth="1.2"
                />
              </g>
            ) : (
              /* Voxel Spear / Stepped Blueprint Sword */
              <g transform="translate(18, 28)">
                <rect x="15" y="16" width="3.5" height="36" fill={ink} />
                <polygon
                  points="16.7,2 23,16 10.5,16"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <rect x="12" y="16" width="9.5" height="3.5" fill={seal} />
              </g>
            )}
          </g>

          {/* Right Voxel Arm (Screen-Right: Held Relic Arm) */}
          <g>
            {isMoving && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,-3; 0,3; 0,-3"
                dur="0.28s"
                repeatCount="indefinite"
              />
            )}
            <polygon
              points="76,49 82,44 92,44 88,49"
              fill={paper}
              stroke={ink}
              strokeWidth="1.5"
            />
            <rect
              x="76"
              y="49"
              width="12"
              height="24"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.8"
            />
            <polygon
              points="88,49 92,44 92,68 88,73"
              fill="url(#voxelDeepHatch)"
              stroke={ink}
              strokeWidth="1.5"
            />
            <rect
              x="77"
              y="67"
              width="10"
              height="7"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />

            {/* Held Relic Cosmetics */}
            {cosmetics.heldRelic === "cos_compass" && (
              <g transform="translate(86, 58)">
                <rect
                  x="0"
                  y="0"
                  width="14"
                  height="14"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <polygon points="7,2 10,7 7,12 4,7" fill={brass} />
              </g>
            )}
            {cosmetics.heldRelic === "cos_alch_lantern" && (
              <g transform="translate(86, 56)">
                <line
                  x1="0"
                  y1="10"
                  x2="10"
                  y2="4"
                  stroke={ink}
                  strokeWidth="2"
                />
                <rect
                  x="4"
                  y="6"
                  width="12"
                  height="16"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <rect x="7" y="10" width="6" height="8" fill={verdigris}>
                  <animate
                    attributeName="opacity"
                    values="1;0.45;1"
                    dur="1.1s"
                    repeatCount="indefinite"
                  />
                </rect>
              </g>
            )}
            {cosmetics.heldRelic === "cos_thunder_staff" && (
              <g transform="translate(86, 22)">
                <rect x="6" y="16" width="4" height="58" fill={ink} />
                <rect
                  x="1"
                  y="4"
                  width="14"
                  height="14"
                  fill="url(#voxelSealHatch)"
                  stroke={seal}
                  strokeWidth="1.8"
                />
                <rect x="5" y="8" width="6" height="6" fill={seal} />
              </g>
            )}
          </g>

          {/* -------------------- 5. ICONIC 3D MINECRAFT CUBIC HEAD (8x8x8 Voxel Scale) -------------------- */}
          <g>
            {/* Isometric Cube Top Face */}
            <polygon
              points="40,18 48,11 82,11 74,18"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            {/* Isometric Cube Main Front/Back Face (34x30) */}
            <rect
              x="40"
              y="18"
              width="34"
              height="30"
              fill={paper}
              stroke={ink}
              strokeWidth="2.1"
            />
            {/* Isometric Cube Right Side Depth Face */}
            <polygon
              points="74,18 82,11 82,41 74,48"
              fill="url(#voxelSideHatch)"
              stroke={ink}
              strokeWidth="1.8"
            />

            {!isBack ? (
              /* FRONT / SIDE VOXEL FACE FEATURES */
              <g>
                {/* Voxel Hair / Brow Fringe */}
                <path
                  d="M40 18 H74 V26 H66 V23 H58 V26 H48 V24 H40 Z"
                  fill={ink}
                />
                {/* Crisp Minecraft-Style Pixel Eyes (with blink) */}
                <g>
                  {/* Left Eye Block */}
                  <rect
                    x="45"
                    y="31"
                    width="8"
                    height="5"
                    fill={ink}
                  >
                    <animate
                      attributeName="height"
                      values="5;5;1;5"
                      keyTimes="0;0.9;0.95;1"
                      dur="3.6s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  <rect x="46" y="32" width="2.5" height="2.5" fill={paper} />

                  {/* Right Eye Block */}
                  <rect
                    x="61"
                    y="31"
                    width="8"
                    height="5"
                    fill={ink}
                  >
                    <animate
                      attributeName="height"
                      values="5;5;1;5"
                      keyTimes="0;0.9;0.95;1"
                      dur="3.6s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  <rect x="62" y="32" width="2.5" height="2.5" fill={paper} />
                </g>
                {/* Voxel Nose / Mouth */}
                <rect x="54" y="36" width="6" height="2.5" fill={muted} />
                <rect x="52" y="42" width="10" height="2.2" fill={ink} />
              </g>
            ) : (
              /* BACK OF CUBIC HEAD (When facing UP) */
              <g>
                <rect
                  x="40"
                  y="18"
                  width="34"
                  height="18"
                  fill="url(#voxelDeepHatch)"
                  stroke={ink}
                  strokeWidth="1.4"
                />
                <line
                  x1="40"
                  y1="36"
                  x2="74"
                  y2="36"
                  stroke={ink}
                  strokeWidth="1.8"
                />
              </g>
            )}

            {/* -------------------- 6. VOXEL HEADGEAR COSMETICS -------------------- */}
            {cosmetics.headgear === "cos_goggles" && (
              <g>
                <rect
                  x="38"
                  y="21"
                  width="38"
                  height="9"
                  fill={sunken}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <rect
                  x="43"
                  y="20"
                  width="11"
                  height="10"
                  fill={paper}
                  stroke={brass}
                  strokeWidth="2"
                />
                <rect
                  x="60"
                  y="20"
                  width="11"
                  height="10"
                  fill={paper}
                  stroke={brass}
                  strokeWidth="2"
                />
                <rect x="46" y="23" width="5" height="4" fill={verdigris} />
                <rect x="63" y="23" width="5" height="4" fill={verdigris} />
              </g>
            )}

            {cosmetics.headgear === "cos_steam_crown" && (
              <g>
                <rect
                  x="38"
                  y="12"
                  width="38"
                  height="8"
                  fill={paper}
                  stroke={ink}
                  strokeWidth="1.8"
                />
                <polygon
                  points="42,12 46,5 51,12 58,4 65,12 70,5 74,12"
                  fill={sunken}
                  stroke={ink}
                  strokeWidth="1.6"
                />
                {/* Voxel Gear Emblem */}
                <rect
                  x="53"
                  y="7"
                  width="8"
                  height="8"
                  fill={brass}
                  stroke={ink}
                  strokeWidth="1.4"
                />
              </g>
            )}

            {cosmetics.headgear === "cos_obsidian_crown" && (
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0,0; 0,-2.5; 0,0"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
                <rect
                  x="39"
                  y="8"
                  width="36"
                  height="8"
                  fill={ink}
                  stroke={seal}
                  strokeWidth="1.6"
                />
                <rect
                  x="43"
                  y="2"
                  width="6"
                  height="6"
                  fill={seal}
                  stroke={ink}
                  strokeWidth="1.2"
                />
                <rect
                  x="54"
                  y="-1"
                  width="8"
                  height="9"
                  fill={seal}
                  stroke={ink}
                  strokeWidth="1.4"
                />
                <rect
                  x="67"
                  y="2"
                  width="6"
                  height="6"
                  fill={seal}
                  stroke={ink}
                  strokeWidth="1.2"
                />
              </g>
            )}
          </g>

          {/* BACK MANTLE OVERLAY WHEN FACING UP */}
          {isBack && (
            <g>
              <rect
                x="38"
                y="48"
                width="40"
                height="42"
                fill={
                  cosmetics.mantle === "cos_astral_wings"
                    ? "url(#voxelSealHatch)"
                    : "url(#voxelDeepHatch)"
                }
                stroke={ink}
                strokeWidth="2"
              />
              <rect
                x="52"
                y="58"
                width="12"
                height="12"
                fill={paper}
                stroke={seal}
                strokeWidth="1.6"
              />
            </g>
          )}
        </g>
      </g>

      {/* ==================== 7. VOXEL COMPANION PET (随从萌宠) ==================== */}
      {cosmetics.companion === "cos_wood_frog" && (
        <g transform="translate(10, 82)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="10,82; 10,74; 10,82"
            dur="0.9s"
            repeatCount="indefinite"
          />
          <rect
            x="0"
            y="6"
            width="16"
            height="12"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <rect
            x="2"
            y="2"
            width="5"
            height="5"
            fill={verdigris}
            stroke={ink}
            strokeWidth="1.2"
          />
          <rect
            x="9"
            y="2"
            width="5"
            height="5"
            fill={verdigris}
            stroke={ink}
            strokeWidth="1.2"
          />
        </g>
      )}

      {cosmetics.companion === "cos_mech_owl" && (
        <g transform="translate(10, 18)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="10,18; 10,12; 10,18"
            dur="1.4s"
            repeatCount="indefinite"
          />
          <rect
            x="2"
            y="4"
            width="14"
            height="16"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <rect x="4" y="7" width="4" height="4" fill={brass} />
          <rect x="10" y="7" width="4" height="4" fill={brass} />
          <polygon points="0,8 2,6 2,16 0,14" fill={ink} />
          <polygon points="18,8 16,6 16,16 18,14" fill={ink} />
        </g>
      )}

      {cosmetics.companion === "cos_aether_drake" && (
        <g transform="translate(8, 14)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="8,14; 8,7; 8,14"
            dur="1.2s"
            repeatCount="indefinite"
          />
          {/* Voxel Mini-Dragon */}
          <polygon
            points="0,4 8,10 0,14"
            fill={seal}
            stroke={ink}
            strokeWidth="1.2"
          />
          <rect
            x="6"
            y="6"
            width="14"
            height="12"
            fill={paper}
            stroke={ink}
            strokeWidth="1.7"
          />
          <rect
            x="16"
            y="2"
            width="10"
            height="8"
            fill={ink}
            stroke={seal}
            strokeWidth="1.2"
          />
          <rect x="21" y="4" width="3" height="3" fill={seal} />
        </g>
      )}
    </svg>
  );
}
