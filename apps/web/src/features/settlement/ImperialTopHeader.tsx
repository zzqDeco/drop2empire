import type { DashboardStateResp } from "@drop2empire/api-client";
import { Compass, Hammer, Scale } from "lucide-react";
import { ICON } from "../../icons";
import { formatGold, formatRate, formatResource } from "../../format";
import {
  computeSceneBadges,
  type ProgressionFlags,
} from "../../domain/settlementSelectors";
import type { WorldZoneKey } from "../macro/types";

interface ImperialTopHeaderProps {
  state: DashboardStateResp;
  activeScene: WorldZoneKey;
  setActiveScene: (scene: WorldZoneKey, marketItem?: string) => void;
  flags: ProgressionFlags;
  onOpenWorldMap: () => void;
  onOpenAnnouncements: () => void;
  onOpenSettings: () => void;
}

const LOGISTICS_KEYS = [
  "water",
  "wood",
  "stone",
  "charcoal",
  "flint",
  "iron",
  "ration",
];

export function ImperialTopHeader({
  state,
  activeScene,
  setActiveScene,
  flags,
  onOpenWorldMap,
  onOpenAnnouncements,
  onOpenSettings,
}: ImperialTopHeaderProps) {
  const { player } = state;
  const {
    showAdvancedWorld,
    showScoutScene,
    showLordScene,
    treasureUnlocked,
    canNavigateWorld,
  } = flags;
  const sceneBadges = computeSceneBadges(state);

  const navItems: Array<{
    key: WorldZoneKey;
    label: string;
    unlocked: boolean;
  }> = [
    { key: "settlement", label: "领主聚落", unlocked: true },
    { key: "scout", label: "荒原斥候营", unlocked: showScoutScene },
    { key: "market", label: "工坊与交易所", unlocked: showAdvancedWorld },
    { key: "war", label: "公会与战区", unlocked: showAdvancedWorld },
    { key: "lord", label: "秘宝藏品馆", unlocked: showLordScene },
  ];
  const visibleNavItems = navItems.filter((item) => item.unlocked);

  const logisticsResources = state.resources.filter(
    (r) => r.unlocked && LOGISTICS_KEYS.includes(r.key),
  );

  return (
    <div className="imperial-header-stack">
      <header className="topbar imperial-crest-header">
        <div className="imperial-header-wing">
          {visibleNavItems.length > 1 ? (
            <nav className="header-scene-tabs" aria-label="帝国疆域直达导航">
              {visibleNavItems.map((item) => {
                const badge = sceneBadges[item.key];
                const isActive = activeScene === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`header-scene-tab ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActiveScene(item.key)}
                  >
                    <span>{item.label}</span>
                    {badge && (
                      <span className="header-tab-badge mono-num">{badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <span className="imperial-zone-plaque mono-num">
              ◆ 滴水成城 · 聚落 ◆
            </span>
          )}
        </div>

        <div className="telemetry-strip imperial-telemetry-crest">
          <span className="crest-corner-ornament" aria-hidden="true">
            ◆
          </span>
          <div className="metric-cell imperial-plaque">
            <span className="metric-label">
              {showAdvancedWorld ? "帝国人口" : "聚落人口"}
            </span>
            <span className="metric-value mono-num">
              {player.populationTotal} / {state.settlement.housingCapacity}
            </span>
          </div>

          {(treasureUnlocked ||
            player.profession !== "none" ||
            player.goldBasis > 0) && (
            <div className="metric-cell imperial-plaque">
              <span className="metric-label">皇家金币</span>
              <span className="metric-value mono-num">
                {formatGold(player.goldBasis)}
                {player.goldFrozenBasis > 0 && (
                  <small className="metric-sub mono-num">
                    {" "}
                    (冻 {formatGold(player.goldFrozenBasis)})
                  </small>
                )}
              </span>
            </div>
          )}

          {player.activityPoints > 0 && (
            <div className="metric-cell imperial-plaque">
              <span className="metric-label">战功积分</span>
              <span className="metric-value mono-num">
                {player.activityPoints}
              </span>
            </div>
          )}
          <span className="crest-corner-ornament" aria-hidden="true">
            ◆
          </span>
        </div>

        <div className="toolbar-actions imperial-header-wing">
          {canNavigateWorld && (
            <button
              type="button"
              className="btn-outline"
              onClick={onOpenWorldMap}
            >
              <Compass size={ICON.xs} />
              <span className="mono-num">舆图 [M]</span>
            </button>
          )}
          {showAdvancedWorld && (
            <button
              type="button"
              className="btn-outline"
              onClick={onOpenAnnouncements}
            >
              <Scale size={ICON.xs} />
              <span className="mono-num">
                帝国公告 ({state.seasonNotices.length})
              </span>
            </button>
          )}
          <button
            type="button"
            className="btn-outline"
            onClick={onOpenSettings}
          >
            <Hammer size={ICON.xs} />
            <span>设置</span>
          </button>
        </div>
      </header>

      {activeScene !== "settlement" && logisticsResources.length > 0 && (
        <div
          className="cross-scene-logistics-bar"
          aria-label="主城后勤物资速览"
        >
          <span className="logistics-bar-title">主城后勤储备</span>
          <div className="logistics-chip-row">
            {logisticsResources.map((r) => (
              <span key={r.key} className="logistics-res-pill mono-num">
                <strong>{r.name}</strong>
                <span>{formatResource(r.amountMilli, 0)}</span>
                {r.netRatePerSecMilli !== 0 && (
                  <small
                    className={
                      r.netRatePerSecMilli > 0 ? "rate-pos" : "cost-lack"
                    }
                  >
                    {formatRate(r.netRatePerSecMilli)}
                  </small>
                )}
              </span>
            ))}
          </div>
          {state.hydrationWarning && (
            <span className="tag-badge cost-lack">⚠️ 主城断水降效 -50%</span>
          )}
        </div>
      )}
    </div>
  );
}
