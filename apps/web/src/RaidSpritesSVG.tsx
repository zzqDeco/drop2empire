import { useEffect, useRef } from "react";
import type { RaidBuffCardDTO } from "@drop2empire/api-client";

export type RaidTileSpriteKind =
  | "empty"
  | "wall"
  | "spawn"
  | "chest_wood"
  | "chest_iron"
  | "chest_coffin"
  | "chest_abyss"
  | "enemy_raider"
  | "enemy_worm"
  | "enemy_boss"
  | "merchant"
  | "oasis"
  | "portal"
  | "extract_early"
  | "extract_deep";

/**
 * Custom Blueprint & Ink 2.5D Voxel / Architectural SVG Sprite for 2D Raid Map Tiles (Zero Emojis).
 */
export function RaidTileSpriteSVG({
  kind,
  searched = false,
  defeated = false,
  extractOpen = true,
}: {
  kind: RaidTileSpriteKind;
  searched?: boolean;
  defeated?: boolean;
  extractOpen?: boolean;
}) {
  const ink = "var(--text-strong)";
  const muted = "var(--text-muted)";
  const paper = "var(--surface)";
  const sunken = "var(--surface-sunken)";
  const seal = "var(--seal-accent)";
  const brass = "var(--warning-text)";
  const verdigris = "var(--success-text)";

  if (kind === "empty") {
    return (
      <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M18 20 H22 M20 18 V22"
          stroke={muted}
          strokeWidth="1"
          strokeOpacity="0.35"
        />
      </svg>
    );
  }

  if (kind === "wall") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        {/* 2.5D Voxel Rock Monolith */}
        <polygon
          points="6,14 14,7 34,7 26,14"
          fill={sunken}
          stroke={ink}
          strokeWidth="1.5"
        />
        <rect
          x="6"
          y="14"
          width="20"
          height="20"
          fill={sunken}
          stroke={ink}
          strokeWidth="1.6"
        />
        <polygon
          points="26,14 34,7 34,27 26,34"
          fill={ink}
          fillOpacity="0.28"
          stroke={ink}
          strokeWidth="1.5"
        />
        <path
          d="M9 20 H22 M11 26 H20"
          stroke={ink}
          strokeWidth="1.1"
          strokeOpacity="0.55"
        />
      </svg>
    );
  }

  if (kind === "spawn") {
    return (
      <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
        <polygon
          points="20,5 35,20 20,35 5,20"
          fill={paper}
          stroke={ink}
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <circle
          cx="20"
          cy="20"
          r="6"
          fill="none"
          stroke={ink}
          strokeWidth="1.4"
        />
        <circle cx="20" cy="20" r="2" fill={ink} />
      </svg>
    );
  }

  if (kind === "portal") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 20 20"
            to="360 20 20"
            dur="7s"
            repeatCount="indefinite"
          />
          <polygon
            points="20,4 34,12 34,28 20,36 6,28 6,12"
            fill={paper}
            stroke={verdigris}
            strokeWidth="1.8"
          />
          <circle
            cx="20"
            cy="20"
            r="10"
            fill="none"
            stroke={ink}
            strokeWidth="1.4"
            strokeDasharray="3 2"
          />
        </g>
        <polygon points="20,12 27,20 20,28 13,20" fill={verdigris} />
      </svg>
    );
  }

  if (kind === "extract_early" || kind === "extract_deep") {
    const activeColor = extractOpen ? verdigris : muted;
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        {/* Extraction Beacon Tower */}
        <polygon
          points="12,34 20,10 28,34"
          fill={paper}
          stroke={ink}
          strokeWidth="1.6"
        />
        <line x1="15" y1="26" x2="25" y2="26" stroke={ink} strokeWidth="1.3" />
        <circle
          cx="20"
          cy="10"
          r="5"
          fill={activeColor}
          stroke={ink}
          strokeWidth="1.5"
        />
        {extractOpen && (
          <circle
            cx="20"
            cy="10"
            r="9"
            fill="none"
            stroke={activeColor}
            strokeWidth="1.2"
          >
            <animate
              attributeName="r"
              values="5;12;5"
              dur="1.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0.1;0.9"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
    );
  }

  if (kind === "merchant") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        {/* Caravan Merchant Pavilion Tent */}
        <polygon
          points="5,28 20,8 35,28"
          fill={paper}
          stroke={ink}
          strokeWidth="1.8"
        />
        <polygon
          points="13,28 20,16 27,28"
          fill={brass}
          stroke={ink}
          strokeWidth="1.4"
        />
        <rect
          x="8"
          y="28"
          width="24"
          height="6"
          fill={sunken}
          stroke={ink}
          strokeWidth="1.5"
        />
        <polygon points="20,3 28,6 20,9" fill={seal} />
      </svg>
    );
  }

  if (kind === "oasis") {
    return (
      <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
        <ellipse
          cx="20"
          cy="24"
          rx="14"
          ry="8"
          fill={searched ? sunken : paper}
          stroke={searched ? muted : verdigris}
          strokeWidth="1.8"
        />
        {!searched && (
          <path
            d="M20 9 C15 16 14 20 20 24 C26 20 25 16 20 9 Z"
            fill={verdigris}
            stroke={ink}
            strokeWidth="1.2"
          />
        )}
      </svg>
    );
  }

  if (
    kind === "chest_wood" ||
    kind === "chest_iron" ||
    kind === "chest_coffin" ||
    kind === "chest_abyss"
  ) {
    const accent =
      kind === "chest_abyss"
        ? seal
        : kind === "chest_coffin"
          ? brass
          : kind === "chest_iron"
            ? verdigris
            : ink;
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        {/* 2.5D Voxel Chest Container */}
        {searched ? (
          <g opacity="0.55">
            <polygon
              points="7,14 13,8 33,8 27,14"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.3"
            />
            <rect
              x="7"
              y="18"
              width="20"
              height="14"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.4"
            />
          </g>
        ) : (
          <g>
            {/* Isometric Chest Top Lid */}
            <polygon
              points="7,15 13,10 33,10 27,15"
              fill={paper}
              stroke={ink}
              strokeWidth="1.6"
            />
            {/* Chest Front Face */}
            <rect
              x="7"
              y="15"
              width="20"
              height="17"
              fill={paper}
              stroke={ink}
              strokeWidth="1.8"
            />
            {/* Chest 3D Side Face */}
            <polygon
              points="27,15 33,10 33,27 27,32"
              fill={sunken}
              stroke={ink}
              strokeWidth="1.6"
            />
            {/* Chest Band & Lock Clasp */}
            <line
              x1="7"
              y1="21"
              x2="27"
              y2="21"
              stroke={ink}
              strokeWidth="1.6"
            />
            <rect
              x="14"
              y="18"
              width="6"
              height="6"
              fill={accent}
              stroke={ink}
              strokeWidth="1.3"
            />
          </g>
        )}
      </svg>
    );
  }

  // Monsters: enemy_raider, enemy_worm, enemy_boss
  if (defeated) {
    return (
      <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
        <g opacity="0.45">
          <rect
            x="12"
            y="14"
            width="16"
            height="14"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.4"
          />
          <path
            d="M15 19 L18 22 M18 19 L15 22 M22 19 L25 22 M25 19 L22 22"
            stroke={ink}
            strokeWidth="1.4"
          />
        </g>
      </svg>
    );
  }

  if (kind === "enemy_boss") {
    return (
      <svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true">
        {/* 2.5D Voxel Clockwork Obsidian Colossus Boss */}
        <polygon
          points="8,10 14,5 32,5 26,10"
          fill={ink}
          stroke={seal}
          strokeWidth="1.4"
        />
        <rect
          x="8"
          y="10"
          width="20"
          height="22"
          fill={paper}
          stroke={ink}
          strokeWidth="2"
        />
        <polygon
          points="28,10 34,5 34,27 28,32"
          fill={sunken}
          stroke={ink}
          strokeWidth="1.6"
        />
        {/* Horns */}
        <polygon points="8,12 2,5 8,8" fill={seal} />
        <polygon points="28,12 34,5 28,8" fill={seal} />
        {/* Glowing Voxel Visor */}
        <rect x="11" y="15" width="14" height="5" fill={ink} />
        <rect x="13" y="16" width="4" height="3" fill={seal} />
        <rect x="19" y="16" width="4" height="3" fill={seal} />
        {/* Core */}
        <polygon points="18,23 22,27 18,31 14,27" fill={seal} />
      </svg>
    );
  }

  if (kind === "enemy_worm") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        {/* 2.5D Voxel Armored Carapace Sandworm */}
        <rect
          x="10"
          y="18"
          width="20"
          height="14"
          fill={sunken}
          stroke={ink}
          strokeWidth="1.8"
        />
        <rect
          x="12"
          y="10"
          width="16"
          height="10"
          fill={paper}
          stroke={ink}
          strokeWidth="1.8"
        />
        {/* Mandibles & Eyes */}
        <polygon points="12,10 8,5 15,10" fill={brass} stroke={ink} strokeWidth="1.2" />
        <polygon points="28,10 32,5 25,10" fill={brass} stroke={ink} strokeWidth="1.2" />
        <rect x="15" y="13" width="3" height="3" fill={seal} />
        <rect x="22" y="13" width="3" height="3" fill={seal} />
        <line x1="10" y1="24" x2="30" y2="24" stroke={ink} strokeWidth="1.4" />
      </svg>
    );
  }

  // Default: enemy_raider (Voxel Wasteland Scavenger)
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <polygon
        points="11,13 16,8 30,8 25,13"
        fill={paper}
        stroke={ink}
        strokeWidth="1.5"
      />
      <rect
        x="11"
        y="13"
        width="16"
        height="18"
        fill={paper}
        stroke={ink}
        strokeWidth="1.8"
      />
      <rect x="11" y="13" width="16" height="5" fill={ink} />
      <rect x="14" y="20" width="4" height="3" fill={seal} />
      <rect x="21" y="20" width="4" height="3" fill={seal} />
      <line x1="6" y1="28" x2="14" y2="16" stroke={ink} strokeWidth="2" />
    </svg>
  );
}

/**
 * Custom Blueprint & Ink SVG Icon for all Loot, Blueprints, Cosmetics, Weapons, Armors, Boots & Potions (Zero Emojis).
 */
export function RaidItemIconSVG({
  itemKey,
  size = 28,
}: {
  itemKey: string;
  size?: number;
}) {
  const ink = "var(--text-strong)";
  const paper = "var(--surface)";
  const sunken = "var(--surface-sunken)";
  const seal = "var(--seal-accent)";
  const brass = "var(--warning-text)";
  const verdigris = "var(--success-text)";

  const isBlueprint = itemKey.startsWith("bp_");
  const isCosmetic = itemKey.startsWith("cos_");
  const isPotion = itemKey.startsWith("pot_");
  const isWeapon =
    itemKey.includes("spear") ||
    itemKey.includes("bow") ||
    itemKey.includes("hammer") ||
    itemKey.includes("crossbow");
  const isArmor = itemKey.includes("vest") || itemKey.includes("mail") || itemKey.includes("armor");
  const isBoots = itemKey.includes("sandals") || itemKey.includes("boots");
  const isSafe = itemKey.startsWith("safe_");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        fill={paper}
        stroke={ink}
        strokeWidth="1.5"
      />
      {isBlueprint ? (
        <g>
          <rect
            x="6"
            y="6"
            width="20"
            height="20"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.4"
          />
          <line x1="9" y1="11" x2="23" y2="11" stroke={ink} strokeWidth="1.2" />
          <line x1="9" y1="16" x2="23" y2="16" stroke={brass} strokeWidth="1.4" />
          <line x1="9" y1="21" x2="18" y2="21" stroke={ink} strokeWidth="1.2" />
          <circle cx="21" cy="21" r="2.5" fill={seal} />
        </g>
      ) : isCosmetic ? (
        <g>
          <polygon
            points="16,5 20,12 27,13 22,18 23,26 16,22 9,26 10,18 5,13 12,12"
            fill={paper}
            stroke={seal}
            strokeWidth="1.6"
          />
          <circle cx="16" cy="16" r="3" fill={seal} />
        </g>
      ) : isPotion ? (
        <g>
          <rect
            x="13"
            y="5"
            width="6"
            height="4"
            fill={ink}
          />
          <polygon
            points="12,9 20,9 25,20 23,26 9,26 7,20"
            fill={paper}
            stroke={ink}
            strokeWidth="1.6"
          />
          <polygon
            points="9,19 23,19 22,24 10,24"
            fill={verdigris}
          />
        </g>
      ) : isWeapon ? (
        <g>
          <line x1="7" y1="25" x2="24" y2="8" stroke={ink} strokeWidth="2.4" />
          <polygon
            points="25,7 25,14 18,7"
            fill={seal}
            stroke={ink}
            strokeWidth="1.2"
          />
          <line x1="10" y1="18" x2="14" y2="22" stroke={brass} strokeWidth="2" />
        </g>
      ) : isArmor ? (
        <g>
          <polygon
            points="9,7 16,5 23,7 25,13 22,26 10,26 7,13"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.6"
          />
          <polygon points="16,11 20,16 16,21 12,16" fill={brass} />
        </g>
      ) : isBoots ? (
        <g>
          <path
            d="M11 7 H19 V19 L25 22 V26 H9 V19 Z"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.6"
          />
          <line x1="9" y1="24" x2="25" y2="24" stroke={seal} strokeWidth="1.8" />
        </g>
      ) : isSafe ? (
        <g>
          <rect
            x="6"
            y="7"
            width="20"
            height="18"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.8"
          />
          <circle
            cx="16"
            cy="16"
            r="4.5"
            fill={paper}
            stroke={brass}
            strokeWidth="1.6"
          />
          <circle cx="16" cy="16" r="1.5" fill={ink} />
        </g>
      ) : itemKey === "meteor_ore" ? (
        <g>
          <polygon
            points="16,4 26,11 23,25 9,25 6,11"
            fill={paper}
            stroke={seal}
            strokeWidth="1.8"
          />
          <polygon points="16,9 21,15 16,22 11,15" fill={seal} />
        </g>
      ) : itemKey === "ancient_shard" ? (
        <g>
          <polygon
            points="16,5 25,16 16,27 7,16"
            fill={paper}
            stroke={verdigris}
            strokeWidth="1.8"
          />
          <circle cx="16" cy="16" r="3.5" fill={verdigris} />
        </g>
      ) : (
        /* Flint / Basic Resource Crystal */
        <g>
          <polygon
            points="16,6 24,18 19,26 11,25 8,16"
            fill={sunken}
            stroke={ink}
            strokeWidth="1.7"
          />
          <polygon points="16,10 20,18 15,22 12,16" fill={brass} />
        </g>
      )}
    </svg>
  );
}

/**
 * 3D Spring-Physics Etched Buff Card modeled on /Users/zhaoziqian/Documents/antigravity/fearless-bose
 * (SPRING_STIFFNESS = 120, SPRING_DAMPING = 16, MAX_TILT_DEG = 12, conic specular border, CNC etched title,
 * rotating machined emblem, zero card numbers, adapted to Blueprint & Ink).
 */
const SPRING_STIFFNESS = 120;
const SPRING_DAMPING = 16;
const MAX_TILT_DEG = 12;

export function BlueprintEtchedCard({
  card,
  index,
  replaceSlotIdx,
  equippedFull,
  onSelectCard,
}: {
  card: RaidBuffCardDTO;
  index: number;
  replaceSlotIdx: number;
  equippedFull: boolean;
  onSelectCard: (cardCode: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const physRef = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    velX: 0,
    velY: 0,
    rafId: 0,
    lastTime: 0,
  });

  useEffect(() => {
    const p = physRef.current;
    return () => {
      if (p.rafId) cancelAnimationFrame(p.rafId);
    };
  }, []);

  const startLoop = () => {
    const p = physRef.current;
    if (p.rafId) return;
    p.lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - p.lastTime) / 1000, 0.05);
      p.lastTime = now;

      const forceX =
        (p.targetX - p.currentX) * SPRING_STIFFNESS - p.velX * SPRING_DAMPING;
      const forceY =
        (p.targetY - p.currentY) * SPRING_STIFFNESS - p.velY * SPRING_DAMPING;

      p.velX += forceX * dt;
      p.velY += forceY * dt;
      p.currentX += p.velX * dt;
      p.currentY += p.velY * dt;

      const el = cardRef.current;
      if (el) {
        const rotY = p.currentX * MAX_TILT_DEG;
        const rotX = -p.currentY * MAX_TILT_DEG;
        const angleRad = Math.atan2(p.currentY, p.currentX);
        const angleDeg = angleRad * (180 / Math.PI) + 90;

        el.style.setProperty("--rot-x", `${rotX.toFixed(2)}deg`);
        el.style.setProperty("--rot-y", `${rotY.toFixed(2)}deg`);
        el.style.setProperty("--shine-deg", `${angleDeg.toFixed(1)}deg`);
        el.style.setProperty(
          "--emblem-deg",
          `${(angleDeg * 1.35).toFixed(1)}deg`,
        );
        el.style.setProperty("--etch-x", `${(-p.currentX * 1.4).toFixed(2)}px`);
        el.style.setProperty("--etch-y", `${(-p.currentY * 1.4).toFixed(2)}px`);
      }

      const settled =
        Math.abs(p.targetX - p.currentX) < 0.001 &&
        Math.abs(p.targetY - p.currentY) < 0.001 &&
        Math.abs(p.velX) < 0.001 &&
        Math.abs(p.velY) < 0.001;

      if (!settled) {
        p.rafId = requestAnimationFrame(tick);
      } else {
        p.rafId = 0;
      }
    };

    p.rafId = requestAnimationFrame(tick);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    physRef.current.targetX = Math.max(-1, Math.min(1, nx));
    physRef.current.targetY = Math.max(-1, Math.min(1, ny));
    startLoop();
  };

  const handlePointerLeave = () => {
    physRef.current.targetX = 0;
    physRef.current.targetY = 0;
    startLoop();
  };

  const categoryLabelMap: Record<string, string> = {
    time: "时限续航敕令",
    vision: "侦察测绘敕令",
    scavenge: "摸金扩容敕令",
    offense: "破甲火力敕令",
    defense: "壁垒生存敕令",
    tactical: "机动折跃敕令",
  };

  return (
    <div
      ref={cardRef}
      className={`etched-buff-card rarity-${card.rarity.toLowerCase()}`}
      style={{ animationDelay: `${index * 95}ms` }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="etched-card-border" />
      <div className="etched-card-hatch" />

      <div className="etched-card-top">
        <span className="etched-card-cat">
          {categoryLabelMap[card.category] ?? card.category}
        </span>
        <span className={`rarity-badge rarity-${card.rarity.toLowerCase()}`}>
          {card.rarity}
        </span>
      </div>

      {/* Machined Rotating Astrolabe Emblem */}
      <div className="etched-card-emblem">
        <svg width="58" height="58" viewBox="0 0 60 60" aria-hidden="true">
          <circle
            cx="30"
            cy="30"
            r="24"
            fill="none"
            stroke="var(--text-strong)"
            strokeWidth="1.4"
            strokeDasharray="4 2"
          />
          <polygon
            points="30,8 36,24 52,30 36,36 30,52 24,36 8,30 24,24"
            fill="var(--surface)"
            stroke="var(--text-strong)"
            strokeWidth="1.6"
          />
          <circle
            cx="30"
            cy="30"
            r="5"
            fill={
              card.rarity === "EPIC"
                ? "var(--seal-accent)"
                : card.rarity === "RARE"
                  ? "var(--success-text)"
                  : "var(--warning-text)"
            }
          />
        </svg>
      </div>

      {/* CNC Letterpress Etched Card Title (No 16-digit card number!) */}
      <div className="etched-card-title-wrap">
        <h3 className="etched-card-title" data-text={card.name}>
          {card.name}
        </h3>
        <p className="etched-card-effect">{card.effectSummary}</p>
      </div>

      <div className="etched-card-footer">
        <div className="bp-costs">
          {card.costs.map((c) => {
            const ok = c.currentMilli >= c.requiredMilli;
            return (
              <span
                key={c.resourceKey}
                className={`cost-chip mono-num ${ok ? "cost-ok" : "cost-lack"}`}
              >
                {c.resourceName} {Math.floor(c.currentMilli / 1000)}/
                {Math.floor(c.requiredMilli / 1000)}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          className="btn-primary btn-block"
          data-pop={`✦ 刻印 ${card.name}`}
          disabled={!card.canBuy}
          onClick={() => onSelectCard(card.cardCode)}
        >
          {equippedFull
            ? `刻印并替换槽位 ${replaceSlotIdx + 1}`
            : "加盖朱砂印 · 选定增益"}
        </button>
      </div>
    </div>
  );
}

/**
 * Evolving Civilization Silhouette SVG for Chapter Progression Pop-Up Overlay.
 * Evolves from Stone Age -> Wood/Stone Colony -> Steam Workshop -> Grand Empire High-Rise Skyline.
 */
export function CivilizationSilhouetteSVG({
  era,
}: {
  era: "stone" | "colony" | "workshop" | "empire";
}) {
  const ink = "var(--text-strong)";
  const paper = "var(--surface)";
  const sunken = "var(--surface-sunken)";
  const seal = "var(--seal-accent)";
  const brass = "var(--warning-text)";

  return (
    <svg
      width="100%"
      height="136"
      viewBox="0 0 640 136"
      role="img"
      aria-label="文明演进剪影"
      className="civ-silhouette-svg"
    >
      {/* Horizon Ground Line */}
      <line x1="0" y1="122" x2="640" y2="122" stroke={ink} strokeWidth="2.5" />
      <line
        x1="0"
        y1="127"
        x2="640"
        y2="127"
        stroke={ink}
        strokeWidth="1"
        strokeDasharray="6 4"
      />

      {/* Sun / Astrolabe Halo in Sky */}
      <circle
        cx="320"
        cy="68"
        r="52"
        fill="none"
        stroke={seal}
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />

      {era === "stone" && (
        <g>
          {/* Stone Age: Craggy Monoliths, Campfire & First Shelter */}
          <polygon
            points="80,122 130,68 185,122"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          <polygon
            points="155,122 210,54 275,122"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          {/* Campfire */}
          <polygon
            points="310,122 320,92 330,122"
            fill={seal}
            stroke={ink}
            strokeWidth="1.6"
          />
          {/* Primitive Hut */}
          <polygon
            points="380,122 425,78 470,122"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="415"
            y="100"
            width="20"
            height="22"
            fill={ink}
          />
        </g>
      )}

      {era === "colony" && (
        <g>
          {/* Colony Era: Waterwheel, Timber Watchtower & Quarry Crane */}
          <rect
            x="110"
            y="74"
            width="58"
            height="48"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <polygon
            points="102,74 139,46 176,74"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          {/* Giant Waterwheel */}
          <circle
            cx="245"
            cy="88"
            r="32"
            fill={paper}
            stroke={ink}
            strokeWidth="2.2"
          />
          <line x1="213" y1="88" x2="277" y2="88" stroke={ink} strokeWidth="1.5" />
          <line x1="245" y1="56" x2="245" y2="120" stroke={ink} strokeWidth="1.5" />
          {/* Timber Watchtower & Palisade */}
          <rect
            x="335"
            y="50"
            width="46"
            height="72"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <polygon
            points="328,50 358,26 388,50"
            fill={ink}
          />
          <polygon
            points="430,122 485,62 540,122"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
        </g>
      )}

      {era === "workshop" && (
        <g>
          {/* Steam Workshop Era: Blast Furnaces, Aqueduct Arches & Geared Domes */}
          <rect
            x="70"
            y="64"
            width="90"
            height="58"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="190"
            y="38"
            width="34"
            height="84"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="245"
            y="48"
            width="150"
            height="74"
            fill={paper}
            stroke={ink}
            strokeWidth="2.2"
          />
          <path
            d="M265 48 A55 55 0 0 1 375 48"
            fill={sunken}
            stroke={ink}
            strokeWidth="2.2"
          />
          <circle
            cx="320"
            cy="78"
            r="18"
            fill={paper}
            stroke={brass}
            strokeWidth="2"
          />
          <rect
            x="425"
            y="42"
            width="42"
            height="80"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
        </g>
      )}

      {era === "empire" && (
        <g>
          {/* Grand Empire Skyline: High-Rise Towers, Imperial Spire, Astrolabe Citadel */}
          <rect
            x="55"
            y="52"
            width="48"
            height="70"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="118"
            y="34"
            width="56"
            height="88"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="190"
            y="24"
            width="64"
            height="98"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          {/* Central Imperial Clock-Spire Skyscraper */}
          <rect
            x="274"
            y="16"
            width="92"
            height="106"
            fill={paper}
            stroke={ink}
            strokeWidth="2.4"
          />
          <polygon
            points="274,16 320,2 366,16"
            fill={seal}
            stroke={ink}
            strokeWidth="1.8"
          />
          <circle
            cx="320"
            cy="46"
            r="16"
            fill={paper}
            stroke={seal}
            strokeWidth="2"
          />
          {/* Right High-Rise Towers */}
          <rect
            x="384"
            y="28"
            width="62"
            height="94"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="462"
            y="40"
            width="54"
            height="82"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
          <rect
            x="530"
            y="58"
            width="50"
            height="64"
            fill={sunken}
            stroke={ink}
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  );
}
