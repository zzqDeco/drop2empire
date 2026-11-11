import type { CollectibleItemDTO } from "@drop2empire/api-client";
import { getRelicPalette } from "./theme/svgPalettes";

interface Props {
  item: CollectibleItemDTO;
}

export function ProceduralRelicSVG({ item }: Props) {
  const pal = getRelicPalette(item.paletteId);
  const clipId = `clip-${item.itemId}`;
  const scale = Math.max(0.65, Math.min(1.85, item.uvScale / 1000));
  const shiftX = ((item.uvOffsetX - 500) / 500) * 36;
  const shiftY = ((item.uvOffsetY - 500) / 500) * 36;
  const rot = item.uvRotation;

  return (
    <svg
      className="relic-svg"
      viewBox="0 0 220 220"
      role="img"
      aria-label={item.name}
    >
      <defs>
        <clipPath id={clipId}>
          {item.baseModelId === "relic_chalice" && (
            <path d="M58 34 H162 L148 98 C144 118 126 132 110 134 C94 132 76 118 72 98 Z M98 132 H122 V168 H98 Z M66 168 H154 L164 188 H56 Z" />
          )}
          {item.baseModelId === "astrolabe_gear" && (
            <path
              fillRule="evenodd"
              d="M110 24 L122 38 L142 32 L146 50 L166 54 L160 74 L178 86 L164 102 L178 118 L160 130 L166 150 L146 154 L142 172 L122 166 L110 180 L98 166 L78 172 L74 154 L54 150 L60 130 L42 118 L56 102 L42 86 L60 74 L54 54 L74 50 L78 32 L98 38 Z M110 78 A24 24 0 1 0 110 126 A24 24 0 1 0 110 78 Z"
            />
          )}
          {item.baseModelId === "alch_retort" && (
            <path d="M88 32 H126 V68 L168 136 C176 150 166 184 142 184 H74 C50 184 40 150 48 136 L88 68 Z" />
          )}
          {item.baseModelId !== "relic_chalice" &&
            item.baseModelId !== "astrolabe_gear" &&
            item.baseModelId !== "alch_retort" && (
              <polygon points="110,20 152,58 140,188 80,188 68,58" />
            )}
        </clipPath>
      </defs>

      {/* Blueprint Drafting Frame */}
      <rect
        x="4"
        y="4"
        width="212"
        height="212"
        fill={pal.bg}
        stroke={pal.primary}
        strokeWidth="1.5"
      />
      <rect
        x="10"
        y="10"
        width="200"
        height="200"
        fill="none"
        stroke={pal.primary}
        strokeWidth="0.6"
        strokeDasharray="3 3"
      />

      {/* Coordinate Crosshairs */}
      <line
        x1="110"
        y1="10"
        x2="110"
        y2="210"
        stroke={pal.primary}
        strokeOpacity="0.18"
        strokeWidth="0.75"
      />
      <line
        x1="10"
        y1="110"
        x2="210"
        y2="110"
        stroke={pal.primary}
        strokeOpacity="0.18"
        strokeWidth="0.75"
      />

      {/* Clipped Procedural Texture Sampling Layer */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="220" height="220" fill={pal.bg} />
        <g
          transform={`translate(${110 + shiftX}, ${110 + shiftY}) rotate(${rot}) scale(${scale}) translate(-110, -110)`}
        >
          {item.textureId === "topo_contour" &&
            [18, 32, 46, 60, 74, 88, 102, 116, 130].map((r, idx) => (
              <ellipse
                key={r}
                cx={110 + ((idx % 3) - 1) * 8}
                cy={110 + ((idx % 2) * 6 - 3)}
                rx={r}
                ry={Math.round(r * 0.72)}
                fill="none"
                stroke={idx % 3 === 0 ? pal.accent : pal.primary}
                strokeWidth={idx % 2 === 0 ? "1.4" : "0.85"}
              />
            ))}

          {item.textureId === "bauhaus_grid" &&
            [-90, -66, -42, -18, 6, 30, 54, 78, 102, 126, 150, 174, 198, 222].map(
              (pos, idx) => (
                <g key={pos}>
                  <line
                    x1={pos}
                    y1="-60"
                    x2={pos}
                    y2="280"
                    stroke={idx % 4 === 0 ? pal.accent : pal.primary}
                    strokeWidth={idx % 3 === 0 ? "1.5" : "0.75"}
                  />
                  <line
                    x1="-60"
                    y1={pos}
                    x2="280"
                    y2={pos}
                    stroke={idx % 5 === 0 ? pal.accent : pal.primary}
                    strokeWidth="0.85"
                  />
                </g>
              ),
            )}

          {item.textureId === "moire_wave" &&
            [16, 28, 40, 52, 64, 76, 88, 100, 112, 124].map((r, idx) => (
              <g key={r}>
                <circle
                  cx="88"
                  cy="96"
                  r={r}
                  fill="none"
                  stroke={pal.primary}
                  strokeWidth="0.9"
                />
                <circle
                  cx="134"
                  cy="124"
                  r={r}
                  fill="none"
                  stroke={idx % 2 === 0 ? pal.accent : pal.primary}
                  strokeWidth="0.9"
                />
              </g>
            ))}

          {item.textureId !== "topo_contour" &&
            item.textureId !== "bauhaus_grid" &&
            item.textureId !== "moire_wave" &&
            [-80, -48, -16, 16, 48, 80, 112, 144, 176, 208, 240].map(
              (offset, idx) => (
                <g key={offset}>
                  <line
                    x1={offset}
                    y1="-40"
                    x2={offset + 140}
                    y2="260"
                    stroke={idx % 3 === 0 ? pal.accent : pal.primary}
                    strokeWidth="1.1"
                  />
                  <line
                    x1={offset + 140}
                    y1="-40"
                    x2={offset}
                    y2="260"
                    stroke={pal.primary}
                    strokeWidth="0.8"
                  />
                </g>
              ),
            )}
        </g>
      </g>

      {/* Crisp Silhouette Ink Contour */}
      {item.baseModelId === "relic_chalice" && (
        <path
          d="M58 34 H162 L148 98 C144 118 126 132 110 134 C94 132 76 118 72 98 Z M98 132 H122 V168 H98 Z M66 168 H154 L164 188 H56 Z"
          fill="none"
          stroke={pal.primary}
          strokeWidth="2.2"
        />
      )}
      {item.baseModelId === "astrolabe_gear" && (
        <path
          fillRule="evenodd"
          d="M110 24 L122 38 L142 32 L146 50 L166 54 L160 74 L178 86 L164 102 L178 118 L160 130 L166 150 L146 154 L142 172 L122 166 L110 180 L98 166 L78 172 L74 154 L54 150 L60 130 L42 118 L56 102 L42 86 L60 74 L54 54 L74 50 L78 32 L98 38 Z M110 78 A24 24 0 1 0 110 126 A24 24 0 1 0 110 78 Z"
          fill="none"
          stroke={pal.primary}
          strokeWidth="2.2"
        />
      )}
      {item.baseModelId === "alch_retort" && (
        <path
          d="M88 32 H126 V68 L168 136 C176 150 166 184 142 184 H74 C50 184 40 150 48 136 L88 68 Z"
          fill="none"
          stroke={pal.primary}
          strokeWidth="2.2"
        />
      )}
      {item.baseModelId !== "relic_chalice" &&
        item.baseModelId !== "astrolabe_gear" &&
        item.baseModelId !== "alch_retort" && (
          <polygon
            points="110,20 152,58 140,188 80,188 68,58"
            fill="none"
            stroke={pal.primary}
            strokeWidth="2.2"
          />
        )}

      {/* Corner Technical Stamp */}
      <text
        x="16"
        y="24"
        fill={pal.primary}
        fontSize="11"
        fontFamily="monospace"
      >
        #{String(item.serialNumber).padStart(3, "0")}
      </text>
      <text
        x="16"
        y="202"
        fill={pal.accent}
        fontSize="11"
        fontFamily="monospace"
      >
        SEED:{item.patternSeed}
      </text>
    </svg>
  );
}
