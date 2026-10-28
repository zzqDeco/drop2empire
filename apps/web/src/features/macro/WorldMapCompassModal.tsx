import type { DashboardStateResp } from "@drop2empire/api-client";
import type { WorldZoneKey } from "./types";

/**
 * World Map Compass Modal (右下角【世界舆图】点击展开的帝国疆域导航图)
 */
export function WorldMapCompassModal({
  state,
  activeScene,
  showScoutScene,
  showAdvancedWorld,
  showLordScene,
  onSelectZone,
  onClose,
}: {
  state: DashboardStateResp;
  activeScene: WorldZoneKey;
  showScoutScene: boolean;
  showAdvancedWorld: boolean;
  showLordScene: boolean;
  onSelectZone: (zone: WorldZoneKey) => void;
  onClose: () => void;
}) {
  const zones: Array<{
    key: WorldZoneKey;
    title: string;
    subtitle: string;
    coord: string;
    unlocked: boolean;
    lockHint: string;
    badge: string;
  }> = [
    {
      key: "settlement",
      title: "领主主城 · 聚落与个人档案",
      subtitle:
        "完整个人视角：领主披挂形象衣橱、汲水与资源总账、居民调配、技术研究与设施建设。",
      coord: "N 00° · E 00° (中央主城)",
      unlocked: true,
      lockHint: "",
      badge: `人口 ${state.player.populationTotal}`,
    },
    {
      key: "scout",
      title: "荒原裂隙斥候营",
      subtitle:
        "三幕式探索撤离：行前整备与保险箱 → 敕令增益卡抽取 → 全屏裂隙搜打撤与局内游商营帐。",
      coord: "N 18° · W 42° (西北裂隙)",
      unlocked: showScoutScene,
      lockHint: "需研究烧炭技术并建造【荒原斥候营】",
      badge: showScoutScene ? "可出征" : "未解锁",
    },
    {
      key: "market",
      title: "皇家工坊与全球交易所",
      subtitle:
        "跨职业增产设备装槽、四大职业独占配方制造，以及帝国中央交易所现货、蓝图与外观买卖。",
      coord: "S 12° · E 28° (东南商埠)",
      unlocked: showAdvancedWorld,
      lockHint: "需开启【神秘的宝藏】并择定终身职业后开放",
      badge: `${state.openOrders.length} 笔挂单`,
    },
    {
      key: "war",
      title: "公会驻地与八城战区",
      subtitle:
        "创立或加入全服公会、捐献军需集结目标，并在八城战略沙盘上派兵参与每晚 20:00 城池会战。",
      coord: "N 34° · E 36° (东北前线)",
      unlocked: showAdvancedWorld,
      lockHint: "需开启【神秘的宝藏】并择定终身职业后开放",
      badge: `战役日 D${state.war.currentDay}/7`,
    },
    {
      key: "lord",
      title: "墨械唯一秘宝陈列馆",
      subtitle:
        "消耗战争活动积分兑换并开启赛季典藏宝箱，铸造全服唯一编号与传世墨金纹样的永久秘宝。",
      coord: "S 24° · W 19° (西南秘苑)",
      unlocked: showLordScene,
      lockHint: "需解锁荒原斥候营或获得首件藏品后开放",
      badge: `藏品 ${state.collectibles.length} 件`,
    },
  ];

  const accentGold = "var(--warning-text)";
  const riverBlue = "var(--info-text)";
  const nodeBaseBg = "var(--brand)";
  const nodeFg = "var(--on-brand)";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="世界舆图导航"
    >
      <div className="modal-sheet world-map-modal-sheet">
        <div className="modal-header">
          <div>
            <h2>帝国疆域世界舆图 · 场景前往</h2>
            <p>
              选择舆图上的疆域据点即可立即前往对应功能区（快捷键：M）
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            收起舆图
          </button>
        </div>

        {/* Interactive Blueprint & Ink World Map SVG */}
        <div className="world-map-svg-wrap">
          <svg
            viewBox="0 0 760 220"
            className="world-map-svg"
            role="img"
            aria-label="帝国疆域蓝图航线"
          >
            <defs>
              <pattern
                id="wm-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  opacity="0.14"
                />
              </pattern>
            </defs>
            <rect width="760" height="220" fill="url(#wm-grid)" />
            {/* Topographic Contours & Imperial River */}
            <path
              d="M 0 148 Q 180 120 340 150 T 760 95"
              fill="none"
              stroke={riverBlue}
              strokeWidth="3.5"
              opacity="0.22"
            />
            <path
              d="M 0 148 Q 180 120 340 150 T 760 95"
              fill="none"
              stroke={riverBlue}
              strokeWidth="1"
              strokeDasharray="6 4"
              opacity="0.55"
            />
            <path
              d="M 40 34 Q 145 14 250 42 M 480 28 Q 590 12 700 44 M 70 196 Q 190 175 290 202"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.22"
            />
            {/* Compass rose */}
            <g transform="translate(704, 46)" opacity="0.65">
              <circle
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <circle
                r="18"
                fill="none"
                stroke={accentGold}
                strokeWidth="0.8"
                opacity="0.6"
              />
              <polygon points="0,-24 5,-5 0,-10 -5,-5" fill={accentGold} />
              <polygon
                points="0,24 4,5 0,10 -4,5"
                fill="currentColor"
                opacity="0.45"
              />
              <line
                x1="-22"
                y1="0"
                x2="22"
                y2="0"
                stroke="currentColor"
                strokeWidth="1"
              />
            </g>
            {/* Route lines from Central Citadel (380, 112) */}
            <g
              stroke={accentGold}
              strokeWidth="1.8"
              strokeDasharray="5 4"
              opacity="0.8"
            >
              {showScoutScene && <line x1="380" y1="112" x2="145" y2="56" />}
              {showAdvancedWorld && <line x1="380" y1="112" x2="595" y2="56" />}
              {showLordScene && <line x1="380" y1="112" x2="165" y2="172" />}
              {showAdvancedWorld && <line x1="380" y1="112" x2="585" y2="170" />}
            </g>
            {/* Node 1: Scout Camp (NW) */}
            {showScoutScene && (
              <g
                transform="translate(145, 56)"
                className="compass-node-group"
                onClick={() => {
                  onSelectZone("scout");
                  onClose();
                }}
              >
                <circle
                  r="22"
                  fill={activeScene === "scout" ? accentGold : nodeBaseBg}
                  stroke={accentGold}
                  strokeWidth="2"
                />
                <polygon
                  points="0,-10 10,8 -10,8"
                  fill={nodeFg}
                />
                <text
                  y="36"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                  fontWeight="700"
                >
                  荒原斥候营
                </text>
              </g>
            )}
            {/* Node 2: Guild & War Zone (NE) */}
            {showAdvancedWorld && (
              <g
                transform="translate(595, 56)"
                className="compass-node-group"
                onClick={() => {
                  onSelectZone("war");
                  onClose();
                }}
              >
                <circle
                  r="22"
                  fill={activeScene === "war" ? accentGold : nodeBaseBg}
                  stroke={accentGold}
                  strokeWidth="2"
                />
                <path
                  d="M-8,-8 L-8,8 L8,8 L8,-8 L4,-3 L0,-9 L-4,-3 Z"
                  fill={nodeFg}
                />
                <text
                  y="36"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                  fontWeight="700"
                >
                  公会与战区
                </text>
              </g>
            )}
            {/* Node 3: Central Settlement & Personal Profile (Center) */}
            <g
              transform="translate(380, 112)"
              className="compass-node-group"
              onClick={() => {
                onSelectZone("settlement");
                onClose();
              }}
            >
              <circle
                r="32"
                fill="none"
                stroke={accentGold}
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <circle
                r="26"
                fill={activeScene === "settlement" ? accentGold : riverBlue}
                stroke={nodeFg}
                strokeWidth="2.5"
              />
              <polygon
                points="0,-13 11,-2 7,-2 7,10 -7,10 -7,-2 -11,-2"
                fill={nodeFg}
              />
              <text
                y="45"
                textAnchor="middle"
                fill="currentColor"
                fontSize="13"
                fontWeight="700"
              >
                ★ 领主主城 (个人与生产)
              </text>
            </g>
            {/* Node 4: Relic Vault (SW) */}
            {showLordScene && (
              <g
                transform="translate(165, 172)"
                className="compass-node-group"
                onClick={() => {
                  onSelectZone("lord");
                  onClose();
                }}
              >
                <circle
                  r="20"
                  fill={activeScene === "lord" ? accentGold : nodeBaseBg}
                  stroke={accentGold}
                  strokeWidth="2"
                />
                <polygon
                  points="0,-10 9,0 0,10 -9,0"
                  fill={nodeFg}
                />
                <text
                  y="34"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                  fontWeight="700"
                >
                  墨械秘宝馆
                </text>
              </g>
            )}
            {/* Node 5: Workshop & Spot Market (SE) */}
            {showAdvancedWorld && (
              <g
                transform="translate(585, 170)"
                className="compass-node-group"
                onClick={() => {
                  onSelectZone("market");
                  onClose();
                }}
              >
                <circle
                  r="22"
                  fill={activeScene === "market" ? accentGold : nodeBaseBg}
                  stroke={accentGold}
                  strokeWidth="2"
                />
                <circle
                  r="7"
                  fill={nodeFg}
                />
                <text
                  y="36"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                  fontWeight="700"
                >
                  工坊与交易所
                </text>
              </g>
            )}
          </svg>
        </div>

        <div className="world-map-zone-grid">
          {zones
            .filter((z) => z.unlocked)
            .map((z) => {
              const isCurrent = activeScene === z.key;
              const isCitadel = z.key === "settlement";
              return (
                <article
                  key={z.key}
                  className={`world-map-zone-card ${isCitadel ? "world-map-zone-card-citadel" : ""} ${isCurrent ? "zone-active" : ""} ${!z.unlocked ? "zone-locked" : ""}`}
                >
                  <div className="bp-top">
                    <div>
                      <strong>{z.title}</strong>
                      <span className="bp-pop-req mono-num">{z.coord}</span>
                    </div>
                    <span
                      className={`tag-badge mono-num ${isCurrent ? "tag-warning" : z.unlocked ? "tag-success" : ""}`}
                    >
                      {isCurrent ? "当前所在" : z.badge}
                    </span>
                  </div>
                  <p className="bp-desc">
                    {z.unlocked ? z.subtitle : `🔒 ${z.lockHint}`}
                  </p>
                  <div className="bp-footer">
                    <span className="cost-chip mono-num">
                      {z.unlocked ? "航道畅通" : z.lockHint}
                    </span>
                    <button
                      type="button"
                      className={
                        isCurrent ? "btn-outline btn-sm" : "btn-primary btn-sm"
                      }
                      data-pop={`➔ 前往 ${z.title.split(" · ")[0]}`}
                      disabled={!z.unlocked}
                      onClick={() => {
                        onSelectZone(z.key);
                        onClose();
                      }}
                    >
                      {isCurrent ? "返回此场景" : "立即前往 ➔"}
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}
