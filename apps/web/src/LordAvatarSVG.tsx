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
  const dim = size === "profile" ? 112 : size === "token" ? 44 : 32;
  const hasLegendary =
    cosmetics.headgear === "cos_obsidian_crown" ||
    cosmetics.mantle === "cos_astral_wings" ||
    cosmetics.heldRelic === "cos_thunder_staff" ||
    cosmetics.companion === "cos_aether_drake";

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 120 120"
      aria-label="领主动态卡通形象"
    >
      <defs>
        <radialGradient id="auraLeg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
          <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wingAstral" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="wingHydro" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      {/* Legendary Aura Background */}
      {hasLegendary && (
        <circle cx="60" cy="62" r="52" fill="url(#auraLeg)">
          <animate
            attributeName="r"
            values="48;54;48"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Ground Shadow */}
      <ellipse cx="60" cy="108" rx="28" ry="6" fill="rgba(15,23,42,0.22)">
        <animate
          attributeName="rx"
          values="28;24;28"
          dur={isMoving ? "0.4s" : "2.2s"}
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Main Character Breathing / Walking Group */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={isMoving ? "0,0; 0,-5; 0,0" : "0,0; 0,-3; 0,0"}
          dur={isMoving ? "0.35s" : "2.2s"}
          repeatCount="indefinite"
        />

        {/* ==================== 1. MANTLE / WINGS (背饰) ==================== */}
        {cosmetics.mantle === "cos_sand_cloak" && (
          <path
            d="M36 52 Q22 76 26 98 L94 98 Q98 76 84 52 Z"
            fill="#b45309"
            stroke="#78350f"
            strokeWidth="2.5"
          />
        )}

        {cosmetics.mantle === "cos_hydro_wings" && (
          <g>
            <path
              d="M42 56 L14 40 L20 72 L42 74 Z"
              fill="url(#wingHydro)"
              stroke="#0369a1"
              strokeWidth="2"
            />
            <path
              d="M78 56 L106 40 L100 72 L78 74 Z"
              fill="url(#wingHydro)"
              stroke="#0369a1"
              strokeWidth="2"
            />
            <circle cx="18" cy="78" r="3" fill="#38bdf8">
              <animate
                attributeName="cy"
                values="74;92"
                dur="0.9s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.9;0"
                dur="0.9s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="102" cy="78" r="3" fill="#38bdf8">
              <animate
                attributeName="cy"
                values="74;92"
                dur="0.9s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.9;0"
                dur="0.9s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {cosmetics.mantle === "cos_astral_wings" && (
          <g>
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-4 60 60; 5 60 60; -4 60 60"
                dur="1.4s"
                repeatCount="indefinite"
              />
              <path
                d="M44 56 Q10 24 8 54 Q14 74 42 78 Z"
                fill="url(#wingAstral)"
                stroke="#fde047"
                strokeWidth="2"
              />
              <path
                d="M76 56 Q110 24 112 54 Q106 74 78 78 Z"
                fill="url(#wingAstral)"
                stroke="#fde047"
                strokeWidth="2"
              />
            </g>
          </g>
        )}

        {/* ==================== 2. BOOTS (战靴) ==================== */}
        <g>
          <rect
            x="44"
            y="92"
            width="12"
            height="13"
            rx="4"
            fill={
              bootsKey === "gear_hermes_boots"
                ? "#0284c7"
                : bootsKey === "gear_spring_boots"
                  ? "#d97706"
                  : "#475569"
            }
            stroke="#0f172a"
            strokeWidth="2"
          />
          <rect
            x="64"
            y="92"
            width="12"
            height="13"
            rx="4"
            fill={
              bootsKey === "gear_hermes_boots"
                ? "#0284c7"
                : bootsKey === "gear_spring_boots"
                  ? "#d97706"
                  : "#475569"
            }
            stroke="#0f172a"
            strokeWidth="2"
          />
          {bootsKey === "gear_hermes_boots" && (
            <>
              <path d="M42 94 L34 88 L36 98 Z" fill="#fde047" />
              <path d="M78 94 L86 88 L84 98 Z" fill="#fde047" />
            </>
          )}
        </g>

        {/* ==================== 3. TORSO & ARMOR (身体与护甲) ==================== */}
        <rect
          x="39"
          y="55"
          width="42"
          height="39"
          rx="12"
          fill={
            armorKey === "gear_hydro_armor"
              ? "#0369a1"
              : armorKey === "gear_carapace_armor"
                ? "#7c2d12"
                : armorKey === "gear_splint_mail"
                  ? "#92400e"
                  : "#334155"
          }
          stroke="#0f172a"
          strokeWidth="2.5"
        />
        {/* Belt & Core Emblem */}
        <rect x="39" y="78" width="42" height="6" fill="#1e293b" />
        <circle
          cx="60"
          cy="69"
          r="6"
          fill={armorKey === "gear_hydro_armor" ? "#38bdf8" : "#f59e0b"}
          stroke="#0f172a"
          strokeWidth="1.8"
        />

        {/* ==================== 4. CARTOON HEAD & BLINKING EYES (头部与表情) ==================== */}
        <circle
          cx="60"
          cy="38"
          r="21"
          fill="#fde68a"
          stroke="#0f172a"
          strokeWidth="2.5"
        />
        {/* Cheeks */}
        <ellipse cx="47" cy="43" rx="3.5" ry="2" fill="#fca5a5" />
        <ellipse cx="73" cy="43" rx="3.5" ry="2" fill="#fca5a5" />
        {/* Blinking Eyes */}
        <ellipse cx="52" cy="38" rx="2.8" ry="3.4" fill="#0f172a">
          <animate
            attributeName="ry"
            values="3.4;3.4;0.3;3.4;3.4"
            keyTimes="0;0.45;0.48;0.52;1"
            dur="3.6s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="68" cy="38" rx="2.8" ry="3.4" fill="#0f172a">
          <animate
            attributeName="ry"
            values="3.4;3.4;0.3;3.4;3.4"
            keyTimes="0;0.45;0.48;0.52;1"
            dur="3.6s"
            repeatCount="indefinite"
          />
        </ellipse>
        {/* Confident Cartoon Smile */}
        <path
          d="M55 46 Q60 50 65 46"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* ==================== 5. HEADGEAR (头饰) ==================== */}
        {!cosmetics.headgear && (
          <path
            d="M40 30 Q60 14 80 30 L76 22 Q60 12 44 22 Z"
            fill="#1e293b"
          />
        )}

        {cosmetics.headgear === "cos_goggles" && (
          <g>
            <rect
              x="41"
              y="22"
              width="38"
              height="10"
              rx="4"
              fill="#78350f"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <circle
              cx="51"
              cy="27"
              r="5"
              fill="#38bdf8"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            <circle
              cx="69"
              cy="27"
              r="5"
              fill="#38bdf8"
              stroke="#fbbf24"
              strokeWidth="2"
            />
          </g>
        )}

        {cosmetics.headgear === "cos_steam_crown" && (
          <g>
            <path
              d="M40 24 L45 12 L55 19 L60 9 L65 19 L75 12 L80 24 Z"
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <circle
              cx="60"
              cy="18"
              r="5"
              fill="#fbbf24"
              stroke="#78350f"
              strokeWidth="2"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 18"
                to="360 60 18"
                dur="4s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {cosmetics.headgear === "cos_obsidian_crown" && (
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-3; 0,0"
              dur="1.6s"
              repeatCount="indefinite"
            />
            <polygon
              points="38,22 46,6 55,17 60,3 65,17 74,6 82,22"
              fill="#1e1b4b"
              stroke="#fde047"
              strokeWidth="2.2"
            />
            <circle cx="60" cy="12" r="4" fill="#38bdf8" />
          </g>
        )}

        {/* ==================== 6. HELD RELIC & WEAPON (手持圣物与武器) ==================== */}
        {/* Left Hand: Weapon */}
        {weaponKey !== "" && (
          <g>
            <line
              x1="28"
              y1="82"
              x2="18"
              y2="46"
              stroke={weaponKey === "gear_titan_hammer" ? "#f59e0b" : "#78350f"}
              strokeWidth="4"
              strokeLinecap="round"
            />
            {weaponKey === "gear_titan_hammer" ? (
              <rect
                x="10"
                y="38"
                width="18"
                height="11"
                rx="2"
                fill="#334155"
                stroke="#fde047"
                strokeWidth="2"
              />
            ) : (
              <polygon points="18,40 13,50 23,50" fill="#94a3b8" />
            )}
          </g>
        )}

        {/* Right Hand: Cosmetic Held Relic */}
        {cosmetics.heldRelic === "cos_compass" && (
          <circle
            cx="90"
            cy="70"
            r="8"
            fill="#f59e0b"
            stroke="#0f172a"
            strokeWidth="2"
          />
        )}

        {cosmetics.heldRelic === "cos_alch_lantern" && (
          <g>
            <rect
              x="85"
              y="62"
              width="12"
              height="16"
              rx="3"
              fill="#065f46"
              stroke="#34d399"
              strokeWidth="2"
            />
            <circle cx="91" cy="70" r="4" fill="#34d399">
              <animate
                attributeName="r"
                values="3;5;3"
                dur="1.1s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {cosmetics.heldRelic === "cos_thunder_staff" && (
          <g>
            <line
              x1="92"
              y1="96"
              x2="96"
              y2="38"
              stroke="#fbbf24"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle
              cx="96"
              cy="34"
              r="7"
              fill="#38bdf8"
              stroke="#fde047"
              strokeWidth="2"
            >
              <animate
                attributeName="r"
                values="6;8.5;6"
                dur="0.9s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}
      </g>

      {/* ==================== 7. COMPANION PET (随从萌宠) ==================== */}
      {cosmetics.companion === "cos_wood_frog" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-7; 0,0"
            dur="0.9s"
            repeatCount="indefinite"
          />
          <ellipse
            cx="22"
            cy="98"
            rx="9"
            ry="7"
            fill="#16a34a"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <circle cx="19" cy="91" r="2.2" fill="#fde047" />
          <circle cx="25" cy="91" r="2.2" fill="#fde047" />
        </g>
      )}

      {cosmetics.companion === "cos_mech_owl" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-6; 0,0"
            dur="1.3s"
            repeatCount="indefinite"
          />
          <circle
            cx="22"
            cy="30"
            r="9"
            fill="#d97706"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <circle cx="19" cy="29" r="2.5" fill="#fef08a" />
          <circle cx="25" cy="29" r="2.5" fill="#fef08a" />
        </g>
      )}

      {cosmetics.companion === "cos_aether_drake" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 4,-8; 0,0"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <path
            d="M12 28 Q22 14 32 28 Q22 36 12 28 Z"
            fill="#818cf8"
            stroke="#fde047"
            strokeWidth="2"
          />
          <circle cx="26" cy="25" r="2" fill="#fde047" />
          <circle cx="35" cy="26" r="2.8" fill="#38bdf8">
            <animate
              attributeName="opacity"
              values="1;0.2;1"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}
    </svg>
  );
}
