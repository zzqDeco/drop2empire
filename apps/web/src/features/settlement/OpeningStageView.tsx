import { api } from "@drop2empire/api-client";
import { Droplets, Moon, Plus, Sun } from "lucide-react";
import { ICON } from "../../icons";
import { formatResource } from "../../format";
import type { ThemeMode } from "../../theme";
import type { ServerUpdate } from "../../serverState";
import type { WaterBurstItem } from "../../hooks/useWaterGather";
import { deriveOpeningStory } from "../../domain/settlementSelectors";

interface OpeningStageViewProps {
  handle: string;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  liveWaterMilli: number;
  hasAnyWaterYet: boolean;
  canSeeFirstRecruit: boolean;
  firstTenProgressPct: number;
  waterBursts: WaterBurstItem[];
  onGatherWater: () => void;
  onGlobalButtonPop: (e: React.MouseEvent<HTMLDivElement>) => void;
  onLogout: () => Promise<void>;
  runAction: (fn: () => Promise<ServerUpdate>, successMsg?: string) => Promise<void>;
}

export function OpeningStageView({
  handle,
  theme,
  setTheme,
  liveWaterMilli,
  hasAnyWaterYet,
  canSeeFirstRecruit,
  firstTenProgressPct,
  waterBursts,
  onGatherWater,
  onGlobalButtonPop,
  onLogout,
  runAction,
}: OpeningStageViewProps) {
  const openingStory = deriveOpeningStory(
    hasAnyWaterYet,
    liveWaterMilli,
    canSeeFirstRecruit,
  );

  return (
    <div
      className="app-shell opening-shell"
      onClickCapture={onGlobalButtonPop}
    >
      <div className="corner-utility-bar">
        <span className="tag-badge mono-num">{handle}</span>
        <button
          type="button"
          className="btn-icon"
          aria-label="切换主题"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? (
            <Moon size={ICON.sm} />
          ) : (
            <Sun size={ICON.sm} />
          )}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => void onLogout()}
        >
          退出
        </button>
      </div>

      <main className="opening-stage" aria-label="起点">
        <div className="opening-top-slot">
          <div className="opening-story-box" key={openingStory.key}>
            <div className="opening-story-kicker">
              <span className="story-beacon-dot" />
              <span>{openingStory.kicker}</span>
            </div>
            <p className="story-line-primary">{openingStory.line1}</p>
            <p className="story-line-secondary">{openingStory.line2}</p>
          </div>

          <div
            className={`opening-water-readout ${hasAnyWaterYet ? "slot-visible" : "slot-hidden"}`}
            aria-hidden={!hasAnyWaterYet}
          >
            <span className="water-label">💧 水</span>
            <strong className="water-big-num mono-num">
              {formatResource(liveWaterMilli, 0)}
            </strong>
            <div className="opening-progress-bar">
              <div
                className="opening-progress-fill"
                ref={(el) => {
                  if (el) {
                    el.style.setProperty(
                      "--progress-pct",
                      `${firstTenProgressPct}%`,
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="opening-center-slot">
          <button
            type="button"
            className="btn-water-strike btn-opening-sole"
            onClick={onGatherWater}
          >
            <Droplets size={ICON.md} />
            <span>{hasAnyWaterYet ? "打水 +1" : "打水"}</span>
            <span className="water-burst-layer" aria-hidden="true">
              {waterBursts.map((b) => (
                <span key={b.id}>
                  <span className="water-ripple-ring" />
                  <span className="water-float-pop mono-num">{b.label}</span>
                </span>
              ))}
            </span>
          </button>
        </div>

        <div className="opening-bottom-slot">
          <section
            className={`opening-recruit-card ${canSeeFirstRecruit ? "slot-visible" : "slot-hidden"}`}
            aria-label="招募居民"
            aria-hidden={!canSeeFirstRecruit}
          >
            <button
              type="button"
              className="btn-primary btn-block"
              data-pop="+1 居民"
              disabled={liveWaterMilli < 10000 || !canSeeFirstRecruit}
              onClick={() =>
                void runAction(() => api.recruitResident({ count: 1 }))
              }
            >
              <Plus size={ICON.xs} />
              <span className="mono-num">招募居民 (-10 水)</span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
