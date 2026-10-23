import type { WarEdgeDTO, WarNodeDTO } from "@drop2empire/api-client";

interface Props {
  nodes: WarNodeDTO[];
  edges: WarEdgeDTO[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

function ownerLabel(owner: string): string {
  if (owner === "OBSIDIAN") return "黑曜";
  if (owner === "ARGENT") return "白银";
  return "中立";
}

export function WarGraphMapSVG({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));

  return (
    <div className="war-map-canvas">
      <svg
        className="war-map-svg"
        viewBox="0 0 1000 410"
        role="img"
        aria-label="商会战争战略拓扑图"
      >
        {/* Background drafting grid lines */}
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
          <line
            key={`gx-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="410"
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        ))}
        {[80, 160, 240, 320].map((y) => (
          <line
            key={`gy-${y}`}
            x1="0"
            y1={y}
            x2="1000"
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        ))}

        {/* Supply & marching edges */}
        {edges.map((e) => {
          const a = byId.get(e.fromNode);
          const b = byId.get(e.toNode);
          if (!a || !b) return null;
          const sameOwner =
            a.ownerGuild !== "NEUTRAL" && a.ownerGuild === b.ownerGuild;
          return (
            <line
              key={`${e.fromNode}-${e.toNode}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeOpacity={sameOwner ? "0.75" : "0.38"}
              strokeWidth={sameOwner ? "2.4" : "1.5"}
              strokeDasharray={sameOwner ? undefined : "6 4"}
            />
          );
        })}

        {/* City Nodes */}
        {nodes.map((node) => {
          const isSelected = node.nodeId === selectedNodeId;
          const r = node.isTreasureVault ? 44 : 36;
          return (
            <g
              key={node.nodeId}
              className="war-node-group"
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectNode(node.nodeId)}
            >
              {isSelected && (
                <circle
                  r={r + 8}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}
              <circle
                r={r}
                className={`war-node-circle war-owner-${node.ownerGuild.toLowerCase()}`}
                stroke="currentColor"
                strokeWidth={isSelected ? "2.8" : "1.8"}
              />
              <text
                y="-12"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="currentColor"
              >
                {node.name}
              </text>
              <text
                y="4"
                textAnchor="middle"
                fontSize="11"
                fontFamily="monospace"
                fill="currentColor"
              >
                [{ownerLabel(node.ownerGuild)}] +{node.dailyScore}分
              </text>
              <text
                y="19"
                textAnchor="middle"
                fontSize="11"
                fontFamily="monospace"
                fill="currentColor"
              >
                步{node.infantryCount}/弓{node.archerCount}/骑{node.cavalryCount}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
