import type { DashboardStateResp } from "@drop2empire/api-client";
import { Award, Compass, LogOut, Moon, Scale, Sun } from "lucide-react";
import { ICON } from "../../icons";
import { formatGold } from "../../format";
import { CivilizationSilhouetteSVG } from "../../RaidSpritesSVG";
import type { ThemeMode } from "../../theme";

/**
 * Imperial Announcement Modal (帝国公告 · 赛季动向与宏观账本)
 */
export function ImperialAnnouncementModal({
  state,
  onClose,
}: {
  state: DashboardStateResp;
  onClose: () => void;
}) {
  const { macroLedger, currentSeason } = state;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="帝国枢密院公告与赛季动向"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <div>
            <h2>帝国枢密院公告 · 赛季动向与跨季契约</h2>
            <p>
              当前赛季：{currentSeason?.title ?? "S1 · 黑曜苏醒"} · 共{" "}
              {state.seasonNotices.length} 份昭告
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={onClose}>
            关闭公告
          </button>
        </div>

        <div className="tab-body split-2col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Scale size={ICON.sm} />
                <span>帝国官方公告与赛季物价动向</span>
              </h3>
            </div>
            <div className="notice-stack">
              {state.seasonNotices.map((sn) => (
                <article key={sn.seasonId} className="season-notice-card">
                  <div className="bp-top">
                    <strong>{sn.title}</strong>
                    <span className="tag-badge tag-warning">
                      {sn.effectiveIn}
                    </span>
                  </div>
                  <p>{sn.summary}</p>
                  {sn.demandShifts.length > 0 && (
                    <ul>
                      {sn.demandShifts.map((ds) => (
                        <li key={ds}>{ds}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Award size={ICON.sm} />
                <span>跨季契约与帝国央行账本</span>
              </h3>
            </div>

            {currentSeason && (
              <article className="season-notice-card">
                <div className="bp-top">
                  <strong>跨赛季继承与重置规则</strong>
                  <span className="tag-badge tag-success">永久契约</span>
                </div>
                <p>{currentSeason.subtitle}</p>
                <ul>
                  {currentSeason.retentionRules.map((r) => (
                    <li key={r}>✓ 永久保留：{r}</li>
                  ))}
                  {currentSeason.resetRules.map((r) => (
                    <li key={r}>↻ 赛季重置：{r}</li>
                  ))}
                </ul>
              </article>
            )}

            <div className="ledger-audit-box mono-num">
              <div className="ledger-row">
                <span>央行总发行 (M_issued)</span>
                <strong>{formatGold(macroLedger.totalIssuedBasis)} G</strong>
              </div>
              <div className="ledger-row">
                <span>玩家流通 + 挂单托管</span>
                <span>
                  {formatGold(
                    macroLedger.playerHeldBasis + macroLedger.escrowFrozenBasis,
                  )}{" "}
                  G
                </span>
              </div>
              <div className="ledger-row">
                <span>NPC 做市商 + 国库储备</span>
                <span>
                  {formatGold(
                    macroLedger.npcHeldBasis + macroLedger.treasuryHeldBasis,
                  )}{" "}
                  G
                </span>
              </div>
              <div className="ledger-row">
                <span>累计通缩销毁</span>
                <span>{formatGold(macroLedger.permanentlyBurnedBasis)} G</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings, Civilization Chapter Guide & Chronicle Modal
 */
export function SettingsChronicleModal({
  state,
  theme,
  storyChapter,
  civEra,
  onToggleTheme,
  onLogout,
  onClose,
}: {
  state: DashboardStateResp;
  theme: ThemeMode;
  storyChapter: { key: string; tag: string; text: string };
  civEra: "stone" | "colony" | "workshop" | "empire";
  onToggleTheme: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const { player, currentSeason } = state;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="设置与聚落纪事"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <div>
            <h2>系统设置 · 文明演进与聚落编年纪事</h2>
            <p>
              领主账号：{player.handle}（{player.professionName}） · 当前赛季：
              {currentSeason?.title ?? "S1 · 黑曜苏醒"}
            </p>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-outline"
              data-pop={theme === "light" ? "曜石夜间" : "纸墨日间"}
              onClick={onToggleTheme}
            >
              {theme === "light" ? (
                <Moon size={ICON.xs} />
              ) : (
                <Sun size={ICON.xs} />
              )}
              <span>{theme === "light" ? "切换曜石夜间" : "切换纸墨日间"}</span>
            </button>
            <button type="button" className="btn-outline" onClick={onLogout}>
              <LogOut size={ICON.xs} />
              <span>退出登录</span>
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="tab-body split-2col">
          {/* Left Column: Current Civilization Chapter Silhouette & Preferences */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Compass size={ICON.sm} />
                <span>当前文明演进章节（{storyChapter.tag}）</span>
              </h3>
            </div>

            <div className="civ-popup-silhouette-wrap">
              <CivilizationSilhouetteSVG era={civEra} />
            </div>

            <article className="season-notice-card">
              <div className="bp-top">
                <strong>{storyChapter.tag}</strong>
                <span className="tag-badge tag-warning">当前章节</span>
              </div>
              <p>{storyChapter.text}</p>
            </article>

            <div className="ledger-audit-box">
              <div className="ledger-row">
                <span>界面主题模式</span>
                <strong>
                  {theme === "light"
                    ? "纸墨日间 (Blueprint Light)"
                    : "曜石夜间 (Obsidian Dark)"}
                </strong>
              </div>
              <div className="ledger-row mono-num">
                <span>累计手动打水次数</span>
                <strong>{player.totalManualClicks} 次</strong>
              </div>
              <div className="ledger-row mono-num">
                <span>操作快捷键</span>
                <span>[M] 世界舆图 · [B/Tab] 局内背囊 · [WASD] 移动</span>
              </div>
            </div>
          </div>

          {/* Right Column: Settlement & Empire Chronicle */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>聚落编年纪事 ({state.eventLogs.length})</h3>
            </div>
            <ul className="event-log-list">
              {state.eventLogs.map((ev) => (
                <li key={ev.id} className="event-log-item">
                  <span className="event-time mono-num">{ev.timestamp}</span>
                  <span className="event-cat">{ev.category}</span>
                  <span className="event-msg">{ev.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
