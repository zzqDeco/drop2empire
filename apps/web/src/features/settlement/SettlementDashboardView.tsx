import { useState } from "react";
import {
  api,
  type DashboardStateResp,
  type ProfessionSpecDTO,
} from "@drop2empire/api-client";
import { Droplets, Hammer, UserCheck } from "lucide-react";
import { ICON } from "../../icons";
import { formatRate, formatResource } from "../../format";
import { SettlementPanel } from "../../SettlementPanel";
import { LordProfileWardrobeBar } from "../raid/LordProfileWardrobeBar";
import { ConfirmActionModal } from "../../components/ModalShell";
import { EDICT_UPKEEP_THRESHOLDS_MILLI } from "../../config/gameConfig";
import { useLiveInterpolation } from "../../hooks/useLiveInterpolation";
import {
  computeLiveWaterMetrics,
  type ProgressionFlags,
} from "../../domain/settlementSelectors";
import type { ServerUpdate } from "../../serverState";
import type { WaterBurstItem } from "../../hooks/useWaterGather";
import type { WorldZoneKey } from "../macro/types";

interface SettlementResourceLedgerProps {
  state: DashboardStateResp;
  firstResBpUnlocked: boolean;
  inFlightClicks: number;
  lastSyncAtMs: number;
  waterBursts: WaterBurstItem[];
  onGatherWater: () => void;
}

function SettlementResourceLedger({
  state,
  firstResBpUnlocked,
  inFlightClicks,
  lastSyncAtMs,
  waterBursts,
  onGatherWater,
}: SettlementResourceLedgerProps) {
  const interpSeconds = useLiveInterpolation(
    lastSyncAtMs,
    state.player.speedMultiplier,
    true,
  );
  const { waterRes, liveWaterMilli } = computeLiveWaterMetrics(
    state,
    firstResBpUnlocked,
    inFlightClicks,
    interpSeconds,
  );
  const unlockedResources = state.resources.filter(
    (r) =>
      r.unlocked &&
      (r.capacityMilli > 0 || r.amountMilli > 0 || r.frozenMilli > 0),
  );

  return (
    <section className="panel" aria-label="资源">
      <div className="panel-header">
        <div className="panel-title">
          <Droplets size={ICON.sm} />
          <h2>资源账本</h2>
        </div>
        <span className="tag-badge mono-num">
          净速 {formatRate(waterRes.netRatePerSecMilli)}
        </span>
      </div>

      {state.hydrationWarning && (
        <div className="status-banner status-danger" role="alert">
          <span>⚠️ 聚落断水：非汲水岗位效率 -50%</span>
        </div>
      )}

      <div className="water-hero-box">
        <div className="water-readout">
          <span className="water-label">💧 聚落储水</span>
          <strong className="water-big-num mono-num">
            {formatResource(liveWaterMilli, 1)}
            {waterRes.capacityMilli > 0 && (
              <small className="metric-sub mono-num">
                {" "}
                / {formatResource(waterRes.capacityMilli, 0)}
              </small>
            )}
          </strong>
          <span className="water-rate mono-num">
            <span className="rate-pos">
              增速 +{formatResource(waterRes.grossRatePerSecMilli, 2)}/s
            </span>
            {" · "}
            <span
              className={
                waterRes.drainRatePerSecMilli > 0 ? "cost-lack" : "rate-zero"
              }
            >
              消耗 -{formatResource(waterRes.drainRatePerSecMilli, 2)}/s
            </span>
            {" · "}
            <span>净速 {formatRate(waterRes.netRatePerSecMilli)}</span>
          </span>
        </div>
        <button
          type="button"
          className="btn-water-strike"
          onClick={onGatherWater}
        >
          <Droplets size={ICON.md} />
          <span>打水 +{firstResBpUnlocked ? "2" : "1"}</span>
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

      {unlockedResources.length > 1 && (
        <div className="table-wrap">
          <table className="ink-table">
            <thead>
              <tr>
                <th>物资</th>
                <th className="num-col">库存 / 上限</th>
                <th className="num-col">增速</th>
                <th className="num-col">消耗</th>
                <th className="num-col">净速</th>
              </tr>
            </thead>
            <tbody>
              {unlockedResources.map((r) => {
                const rawLive =
                  r.key === "water"
                    ? liveWaterMilli
                    : r.amountMilli +
                      Math.floor(r.netRatePerSecMilli * interpSeconds);
                const liveAmt = Math.max(
                  0,
                  r.capacityMilli > 0
                    ? Math.min(r.capacityMilli, rawLive)
                    : rawLive,
                );
                const isContinuous =
                  r.tier === "basic" ||
                  r.key === "charcoal" ||
                  r.key === "flint" ||
                  r.key === "ancient_shard";
                const shownAmt = isContinuous ? liveAmt : r.amountMilli;
                const isStorageFull =
                  r.capacityMilli > 0 && shownAmt >= r.capacityMilli;
                return (
                  <tr key={r.key} className="res-row-enter">
                    <td className="res-name-cell">
                      <div>
                        <span>{r.name}</span>
                        {r.frozenMilli > 0 && (
                          <small className="frozen-tag mono-num">
                            冻:{formatResource(r.frozenMilli, 0)}
                          </small>
                        )}
                        {isStorageFull && (
                          <small className="frozen-tag">满仓</small>
                        )}
                      </div>
                      {r.description && (
                        <small className="res-desc-sub">{r.description}</small>
                      )}
                    </td>
                    <td className="num-col mono-num">
                      {formatResource(shownAmt, 1)}
                      {r.capacityMilli > 0 && (
                        <small className="metric-sub mono-num">
                          {" "}
                          / {formatResource(r.capacityMilli, 0)}
                        </small>
                      )}
                    </td>
                    <td
                      className={`num-col mono-num ${
                        r.grossRatePerSecMilli > 0 ? "rate-pos" : "rate-zero"
                      }`}
                    >
                      {r.grossRatePerSecMilli > 0
                        ? `+${formatResource(r.grossRatePerSecMilli, 2)}/s`
                        : "—"}
                    </td>
                    <td
                      className={`num-col mono-num ${
                        r.drainRatePerSecMilli > 0 ? "cost-lack" : "rate-zero"
                      }`}
                    >
                      {r.drainRatePerSecMilli > 0
                        ? `-${formatResource(r.drainRatePerSecMilli, 2)}/s`
                        : "—"}
                    </td>
                    <td
                      className={`num-col mono-num ${
                        r.netRatePerSecMilli > 0
                          ? "rate-pos"
                          : r.netRatePerSecMilli < 0
                            ? "cost-lack"
                            : "rate-zero"
                      }`}
                    >
                      {r.netRatePerSecMilli !== 0
                        ? formatRate(r.netRatePerSecMilli)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface SettlementDashboardViewProps {
  state: DashboardStateResp;
  busy: boolean;
  isScopeBusy: (scope: string) => boolean;
  flags: ProgressionFlags;
  inFlightClicks: number;
  lastSyncAtMs: number;
  waterBursts: WaterBurstItem[];
  storyChapter: { key: string; tag: string; text: string };
  onGatherWater: () => void;
  onNavigateScene: (scene: WorldZoneKey, marketItem?: string) => void;
  runAction: (
    fn: () => Promise<ServerUpdate>,
    successMsg?: string,
    scope?: string,
  ) => Promise<void>;
}

export function SettlementDashboardView({
  state,
  busy,
  isScopeBusy,
  flags,
  inFlightClicks,
  lastSyncAtMs,
  waterBursts,
  storyChapter,
  onGatherWater,
  onNavigateScene,
  runAction,
}: SettlementDashboardViewProps) {
  const [presetInput, setPresetInput] = useState("");
  const [pendingProfession, setPendingProfession] =
    useState<ProfessionSpecDTO | null>(null);

  const { player, resources, jobs, professions } = state;
  const {
    firstResBpUnlocked,
    axeUnlocked,
    quarryUnlocked,
    showJobAllocationColumn,
    showProfessionChoice,
    showScoutScene,
  } = flags;

  const unlockedJobs = jobs.filter((j) => j.unlocked);
  const unlockedEdicts = (state.edicts ?? []).filter((e) => e.unlocked);
  const waterJob = jobs.find((j) => j.jobKey === "water");
  const waterAssignedCount = waterJob?.assigned ?? 0;
  const workerBusy = isScopeBusy("worker");
  const edictBusy = isScopeBusy("edict");

  const jobNameMap = new Map(jobs.map((j) => [j.jobKey, j.name]));

  const adjustJobCount = (jobKey: string, delta: number) => {
    void runAction(
      () =>
        api.allocateWorkers({
          mode: "delta",
          entries: [{ jobKey, count: delta }],
        }),
      undefined,
      "worker",
    );
  };

  return (
    <div>
      {!flags.showAdvancedWorld && (
        <div className="settlement-guide-banner" aria-label="聚落进展">
          <div className="settlement-guide-inner">
            <span className="story-chapter-tag">{storyChapter.tag}</span>
            <p>{storyChapter.text}</p>
          </div>
        </div>
      )}

      {showProfessionChoice && (
        <section className="profession-gate-banner" aria-label="选择职业">
          <div className="section-head">
            <div>
              <span className="tag-badge tag-warning">神秘的宝藏</span>
              <h2>选择本赛季终身职业（解锁工坊市场与公会战区）</h2>
              <p>
                选定后本赛季内不可更改，四大职业形成互补产业链，在中央交易所互通有无。
              </p>
            </div>
          </div>
          <div className="profession-grid">
            {professions.map((pr) => (
              <article key={pr.code} className="profession-card">
                <div>
                  <div className="profession-card-top">
                    <div>
                      <h3>{pr.name}</h3>
                      <span className="profession-subtitle">{pr.title}</span>
                    </div>
                    <span className="tag-badge">{pr.artifactName}</span>
                  </div>
                  <dl className="profession-specs">
                    <div>
                      <dt>独占制品</dt>
                      <dd>{pr.exclusiveOutputs.join("、")}</dd>
                    </div>
                    <div>
                      <dt>职业加成</dt>
                      <dd>{pr.passiveBonusText}</dd>
                    </div>
                    {pr.strengthText && (
                      <div>
                        <dt>核心优势</dt>
                        <dd>{pr.strengthText}</dd>
                      </div>
                    )}
                    {pr.weaknessText && (
                      <div>
                        <dt>协同依赖</dt>
                        <dd>{pr.weaknessText}</dd>
                      </div>
                    )}
                    {pr.marketRoleText && (
                      <div>
                        <dt>市场定位</dt>
                        <dd>{pr.marketRoleText}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <button
                  type="button"
                  className="btn-primary btn-block"
                  data-pop={`★ 就职 ${pr.name}`}
                  disabled={busy}
                  onClick={() => setPendingProfession(pr)}
                >
                  <UserCheck size={ICON.sm} />
                  <span>就职 {pr.name}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <main
        className={`dashboard-grid ${!showJobAllocationColumn ? "dashboard-grid-2col" : ""}`}
      >
        {/* Column 1: Integrated Personal Lord Profile + Live Resources */}
        <div className="settlement-left-col">
          {showScoutScene && (
            <LordProfileWardrobeBar
              state={state}
              onNavigateMarketItem={(itemKey) =>
                onNavigateScene("market", itemKey)
              }
              runAction={runAction}
            />
          )}

          <SettlementResourceLedger
            state={state}
            firstResBpUnlocked={firstResBpUnlocked}
            inFlightClicks={inFlightClicks}
            lastSyncAtMs={lastSyncAtMs}
            waterBursts={waterBursts}
            onGatherWater={onGatherWater}
          />

          <details className="panel">
            <summary className="panel-summary-trigger">聚落纪事</summary>
            <ul className="event-log-list">
              {state.eventLogs.slice(0, 8).map((ev) => (
                <li key={ev.id} className="event-log-item">
                  <span className="event-time mono-num">{ev.timestamp}</span>
                  <span className="event-msg mono-num">{ev.message}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        {/* Column 2: Worker Allocation & Colony Edicts */}
        {showJobAllocationColumn && (
          <section className="panel" aria-label="岗位">
            <div className="panel-header">
              <div className="panel-title">
                <Hammer size={ICON.sm} />
                <h2>岗位与法令</h2>
              </div>
              <div className="batch-pill-group">
                <span className="tag-badge mono-num">
                  在岗 {player.populationAssigned} / {player.populationTotal}
                </span>
                <span className="cost-chip mono-num">
                  闲置 {player.populationIdle} · 汲水池可调 {waterAssignedCount}
                </span>
              </div>
            </div>

            <div className="quick-alloc-bar">
              <button
                type="button"
                className="btn-outline"
                data-pop="✓ 均衡调配"
                disabled={workerBusy}
                onClick={() =>
                  void runAction(
                    () => api.allocateWorkers({ mode: "auto_balanced" }),
                    undefined,
                    "worker",
                  )
                }
              >
                均衡
              </button>
              <button
                type="button"
                className="btn-outline"
                data-pop="💧 打水优先"
                disabled={workerBusy}
                onClick={() =>
                  void runAction(
                    () => api.allocateWorkers({ mode: "water_focus" }),
                    undefined,
                    "worker",
                  )
                }
              >
                打水优先
              </button>
              {axeUnlocked && (
                <button
                  type="button"
                  className="btn-outline"
                  data-pop="🪵 伐木优先"
                  disabled={workerBusy}
                  onClick={() =>
                    void runAction(
                      () => api.allocateWorkers({ mode: "wood_focus" }),
                      undefined,
                      "worker",
                    )
                  }
                >
                  伐木优先
                </button>
              )}
              {quarryUnlocked && (
                <button
                  type="button"
                  className="btn-outline"
                  data-pop="🪨 采石优先"
                  disabled={workerBusy}
                  onClick={() =>
                    void runAction(
                      () => api.allocateWorkers({ mode: "stone_focus" }),
                      undefined,
                      "worker",
                    )
                  }
                >
                  采石优先
                </button>
              )}
            </div>

            <div className="job-list">
              {unlockedJobs.map((job) => {
                const availableResidents =
                  job.jobKey === "water"
                    ? player.populationTotal - job.assigned
                    : player.populationIdle + waterAssignedCount;
                const canAddPool = Math.min(
                  availableResidents,
                  job.capacity - job.assigned,
                );

                return (
                  <div
                    key={job.jobKey}
                    className={`job-row ${!job.unlocked ? "job-row-locked" : ""}`}
                  >
                    <div className="job-info">
                      <div className="job-title-line">
                        <strong>{job.name}</strong>
                        {job.efficiencyPct !== 100 && (
                          <span
                            className={`tag-badge mono-num ${job.efficiencyPct < 100 ? "cost-lack" : "tag-success"}`}
                          >
                            效率 {job.efficiencyPct}%
                          </span>
                        )}
                      </div>
                      <small className="job-sub mono-num">
                        单人 {(job.effectiveRateMilli / 1000).toFixed(2)}/s ·{" "}
                        {job.inputSummary}
                      </small>
                    </div>

                    <div className="job-controls">
                      <div className="job-rate-box mono-num">
                        {formatRate(job.totalOutputPerSecMilli)}
                      </div>
                      <div className="stepper-group">
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`-5 ${job.name}`}
                          disabled={workerBusy || job.assigned < 5}
                          onClick={() => adjustJobCount(job.jobKey, -5)}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`-1 ${job.name}`}
                          disabled={workerBusy || job.assigned <= 0}
                          onClick={() => adjustJobCount(job.jobKey, -1)}
                        >
                          -1
                        </button>
                        <span className="job-count mono-num">
                          {job.assigned}/{job.capacity}
                        </span>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`+1 ${job.name}`}
                          disabled={workerBusy || canAddPool < 1}
                          onClick={() => adjustJobCount(job.jobKey, 1)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`+5 ${job.name}`}
                          disabled={workerBusy || canAddPool < 5}
                          onClick={() => adjustJobCount(job.jobKey, 5)}
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {unlockedEdicts.length > 0 && (
              <div id="settlement-edicts-anchor" className="blueprint-list">
                <hr className="ink-divider" />
                {unlockedEdicts.map((ed) => {
                  const upkeepRule = EDICT_UPKEEP_THRESHOLDS_MILLI[ed.code];
                  const upkeepRes = upkeepRule
                    ? resources.find((r) => r.key === upkeepRule.resourceKey)
                    : undefined;
                  const upkeepStarved =
                    ed.active &&
                    Boolean(upkeepRule) &&
                    (upkeepRes?.amountMilli ?? 0) <
                      (upkeepRule?.minMilli ?? 0);

                  return (
                    <article
                      key={ed.code}
                      className={`bp-card ${ed.active ? "bp-ready" : ""}`}
                    >
                      <div className="bp-top">
                        <div className="batch-pill-group">
                          <strong>{ed.name}</strong>
                          <span
                            className={`tag-badge ${
                              upkeepStarved
                                ? "cost-lack"
                                : ed.active
                                  ? "tag-success"
                                  : ""
                            }`}
                          >
                            {upkeepStarved
                              ? `已启用 · 缺${upkeepRule?.resourceName}暂停`
                              : ed.active
                                ? "已启用"
                                : "待命"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={
                            ed.active
                              ? "btn-outline btn-sm"
                              : "btn-primary btn-sm"
                          }
                          data-pop={
                            ed.active ? `关闭 ${ed.name}` : `✓ 开启 ${ed.name}`
                          }
                          disabled={edictBusy}
                          onClick={() =>
                            void runAction(
                              () => api.toggleEdict({ code: ed.code }),
                              undefined,
                              "edict",
                            )
                          }
                        >
                          {ed.active ? "关闭" : "开启"}
                        </button>
                      </div>
                      <p className="bp-desc">
                        {ed.effectSummary}（{ed.drawbackSummary}）
                      </p>
                    </article>
                  );
                })}
              </div>
            )}

            {quarryUnlocked && (
              <div className="preset-bar">
                {state.presets.length > 0 && (
                  <div className="preset-chips">
                    {state.presets.map((pr) => {
                      const summary = pr.entries
                        .filter((e) => e.count > 0)
                        .map(
                          (e) =>
                            `${(jobNameMap.get(e.jobKey) ?? e.jobKey).slice(0, 1)}${e.count}`,
                        )
                        .join("·");
                      return (
                        <button
                          key={pr.name}
                          type="button"
                          className="btn-chip mono-num"
                          data-pop={`套用 ${pr.name}`}
                          disabled={workerBusy}
                          onClick={() =>
                            void runAction(
                              () =>
                                api.allocateWorkers({
                                  mode: "preset",
                                  presetName: pr.name,
                                }),
                              undefined,
                              "worker",
                            )
                          }
                        >
                          {pr.name}
                          {summary ? ` (${summary})` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
                <form
                  className="preset-save-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!presetInput.trim()) return;
                    void runAction(
                      () =>
                        api.saveAllocationPreset({
                          name: presetInput.trim(),
                        }),
                      `已保存岗位编组「${presetInput.trim()}」（同名保存可覆盖更新）`,
                      "worker",
                    );
                    setPresetInput("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="保存当前配比方案名（同名可覆盖）..."
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn-outline"
                    data-pop="✓ 保存方案"
                    disabled={workerBusy}
                  >
                    保存
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        <SettlementPanel
          state={state}
          busy={busy}
          onOpenIndustry={() => onNavigateScene("market")}
          onNavigateScene={(scene) => onNavigateScene(scene)}
          runAction={runAction}
        />
      </main>

      {pendingProfession && (
        <ConfirmActionModal
          title={`确认宣誓就职「${pendingProfession.name}」`}
          subtitle={`${pendingProfession.title} · 圣物：${pendingProfession.artifactName}`}
          severity="warning"
          consequences={[
            "本赛季内职业一经择定不可更改，直到跨赛季轮回重置。",
            `解锁专属配方产出：${pendingProfession.exclusiveOutputs.join("、")}。`,
            `获得聚落永久被动：${pendingProfession.passiveBonusText}。`,
            "立即开放东南【皇家工坊与全球交易所】与东北【公会驻地与八城战区】。",
          ]}
          confirmLabel={`确认宣誓 · 就职${pendingProfession.name}`}
          busy={busy}
          onCancel={() => setPendingProfession(null)}
          onConfirm={() => {
            const code = pendingProfession.code;
            const name = pendingProfession.name;
            setPendingProfession(null);
            void runAction(
              () => api.chooseProfession({ profession: code }),
              `已宣誓就职【${name}】，工坊交易所与战区已向您敞开！`,
            );
          }}
        />
      )}
    </div>
  );
}
