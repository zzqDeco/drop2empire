import type { DashboardStateResp } from "@drop2empire/api-client";
import { Compass, Hammer, Scale } from "lucide-react";
import { ICON } from "../../icons";
import { formatGold } from "../../format";
import type { WorldZoneKey } from "../macro/types";

interface ImperialTopHeaderProps {
  state: DashboardStateResp;
  activeScene: WorldZoneKey;
  setActiveScene: (scene: WorldZoneKey) => void;
  showAdvancedWorld: boolean;
  treasureUnlocked: boolean;
  onOpenAnnouncements: () => void;
  onOpenSettings: () => void;
}

export function ImperialTopHeader({
  state,
  activeScene,
  setActiveScene,
  showAdvancedWorld,
  treasureUnlocked,
  onOpenAnnouncements,
  onOpenSettings,
}: ImperialTopHeaderProps) {
  const { player } = state;

  const zoneTitleMap: Record<WorldZoneKey, string> = {
    settlement: showAdvancedWorld
      ? "◆ 帝国主城 · 领主与聚落总览 ◆"
      : "◆ 滴水成城 · 聚落 ◆",
    scout: "◆ 西北裂隙 · 荒原斥候大营 ◆",
    market: "◆ 东南商埠 · 皇家工坊与交易所 ◆",
    war: "◆ 东北前线 · 公会驻地与八城战区 ◆",
    lord: "◆ 西南秘苑 · 墨械唯一秘宝馆 ◆",
  };

  return (
    <header className="topbar imperial-crest-header">
      <div className="imperial-header-wing">
        {activeScene !== "settlement" ? (
          <button
            type="button"
            className="btn-primary btn-sm"
            data-pop="返回主城"
            onClick={() => setActiveScene("settlement")}
          >
            <Compass size={ICON.xs} />
            <span>返回领主主城</span>
          </button>
        ) : (
          <span className="imperial-zone-plaque mono-num">
            {zoneTitleMap[activeScene]}
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
            {player.populationTotal}
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

        {(player.profession !== "none" || player.activityPoints > 0) && (
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
  );
}
