import { useState } from "react";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { Droplets, Hammer, UserCheck } from "lucide-react";
import { ICON } from "../../icons";
import { formatRate, formatResource } from "../../format";
import { SettlementPanel } from "../../SettlementPanel";
import { LordProfileWardrobeBar } from "../raid/LordProfileWardrobeBar";
import type { ServerUpdate } from "../../serverState";
import type { WaterBurstItem } from "../../hooks/useWaterGather";
import type { ProgressionFlags } from "../../domain/settlementSelectors";

type ResourceDTO = DashboardStateResp["resources"][number];

interface SettlementDashboardViewProps {
  state: DashboardStateResp;
  busy: boolean;
  flags: ProgressionFlags;
  waterRes: ResourceDTO;
  liveWaterMilli: number;
  interpSeconds: number;
  waterBursts: WaterBurstItem[];
  storyChapter: { key: string; tag: string; text: string };
  onGatherWater: () => void;
  runAction: (fn: () => Promise<ServerUpdate>, successMsg?: string) => Promise<void>;
}

export function SettlementDashboardView({
  state,
  busy,
  flags,
  waterRes,
  liveWaterMilli,
  interpSeconds,
  waterBursts,
  storyChapter,
  onGatherWater,
  runAction,
}: SettlementDashboardViewProps) {
  const [presetInput, setPresetInput] = useState("");
  const { player, resources, jobs, professions } = state;
  const {
    firstResBpUnlocked,
    axeUnlocked,
    quarryUnlocked,
    showJobAllocationColumn,
    showProfessionChoice,
    showScoutScene,
  } = flags;

  const unlockedResources = resources.filter((r) => r.unlocked);
  const unlockedJobs = jobs.filter((j) => j.unlocked);
  const unlockedEdicts = (state.edicts ?? []).filter((e) => e.unlocked);
  const waterJob = jobs.find((j) => j.jobKey === "water");
  const waterAssignedCount = waterJob?.assigned ?? 0;

  const adjustJobCount = (jobKey: string, delta: number) => {
    void runAction(() =>
      api.allocateWorkers({
        mode: "delta",
        entries: [{ jobKey, count: delta }],
      }),
    );
  };

  return (
    <div>
      <div className="status-banner status-info" aria-label="聚落进展">
        <div>
          <strong>{storyChapter.tag}</strong>
          <p>{storyChapter.text}</p>
        </div>
      </div>

      {showProfessionChoice && (
        <section className="profession-gate-banner" aria-label="选择职业">
          <div className="section-head">
            <div>
              <span className="tag-badge tag-warning">神秘的宝藏</span>
              <h2>选择终身职业（解锁工坊市场与公会战区）</h2>
              <p>
                选定后本赛季不可更改，不同职业享有专属工坊制造配方与聚落加成。
              </p>
            </div>
          </div>
          <div className="profession-grid">
            {professions.map((pr) => (
              <article key={pr.code} className="profession-card">
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
                </dl>
                <button
                  type="button"
                  className="btn-primary btn-block"
                  data-pop={`★ 就职 ${pr.name}`}
                  onClick={() =>
                    void runAction(() =>
                      api.chooseProfession({ profession: pr.code }),
                    )
                  }
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
        {/* Column 1: Integrated Personal Lord Profile + Resources */}
        <div className="settlement-left-col">
          {showScoutScene && (
            <LordProfileWardrobeBar state={state} runAction={runAction} />
          )}

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
                      waterRes.drainRatePerSecMilli > 0
                        ? "cost-lack"
                        : "rate-zero"
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
                      <span className="water-float-pop mono-num">
                        {b.label}
                      </span>
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
                      return (
                        <tr key={r.key} className="res-row-enter">
                          <td className="res-name-cell">
                            <span>{r.name}</span>
                            {r.frozenMilli > 0 && (
                              <small className="frozen-tag mono-num">
                                冻:{formatResource(r.frozenMilli, 0)}
                              </small>
                            )}
                          </td>
                          <td className="num-col mono-num">
                            {formatResource(
                              isContinuous ? liveAmt : r.amountMilli,
                              1,
                            )}
                            {r.capacityMilli > 0 && (
                              <small className="metric-sub mono-num">
                                {" "}
                                / {formatResource(r.capacityMilli, 0)}
                              </small>
                            )}
                          </td>
                          <td
                            className={`num-col mono-num ${
                              r.grossRatePerSecMilli > 0
                                ? "rate-pos"
                                : "rate-zero"
                            }`}
                          >
                            {r.grossRatePerSecMilli > 0
                              ? `+${formatResource(r.grossRatePerSecMilli, 2)}/s`
                              : "—"}
                          </td>
                          <td
                            className={`num-col mono-num ${
                              r.drainRatePerSecMilli > 0
                                ? "cost-lack"
                                : "rate-zero"
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

          <details className="panel">
            <summary>聚落纪事</summary>
            <ul className="event-log-list">
              {state.eventLogs.slice(0, 5).map((ev) => (
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
              <span className="tag-badge mono-num">
                {player.populationAssigned} / {player.populationTotal}
              </span>
            </div>

            <div className="quick-alloc-bar">
              <button
                type="button"
                className="btn-outline"
                data-pop="✓ 均衡调配"
                disabled={busy}
                onClick={() =>
                  void runAction(() =>
                    api.allocateWorkers({ mode: "auto_balanced" }),
                  )
                }
              >
                均衡
              </button>
              <button
                type="button"
                className="btn-outline"
                data-pop="💧 打水优先"
                disabled={busy}
                onClick={() =>
                  void runAction(() =>
                    api.allocateWorkers({ mode: "water_focus" }),
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
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "wood_focus" }),
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
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "stone_focus" }),
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
                          <span className="tag-badge mono-num">
                            {job.efficiencyPct}%
                          </span>
                        )}
                      </div>
                      <small className="job-sub mono-num">
                        {(job.effectiveRateMilli / 1000).toFixed(2)}/s ·{" "}
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
                          disabled={busy || job.assigned < 5}
                          onClick={() => adjustJobCount(job.jobKey, -5)}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`-1 ${job.name}`}
                          disabled={busy || job.assigned <= 0}
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
                          disabled={busy || canAddPool < 1}
                          onClick={() => adjustJobCount(job.jobKey, 1)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          data-pop={`+5 ${job.name}`}
                          disabled={busy || canAddPool < 5}
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
              <div className="blueprint-list">
                <hr className="ink-divider" />
                {unlockedEdicts.map((ed) => (
                  <article
                    key={ed.code}
                    className={`bp-card ${ed.active ? "bp-ready" : ""}`}
                  >
                    <div className="bp-top">
                      <div>
                        <strong>{ed.name}</strong>
                        <span
                          className={`tag-badge ${ed.active ? "tag-success" : ""}`}
                        >
                          {ed.active ? "已启用" : "待命"}
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
                        disabled={busy}
                        onClick={() =>
                          void runAction(() =>
                            api.toggleEdict({ code: ed.code }),
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
                ))}
              </div>
            )}

            {quarryUnlocked && (
              <div className="preset-bar">
                {state.presets.length > 0 && (
                  <div className="preset-chips">
                    {state.presets.map((pr) => (
                      <button
                        key={pr.name}
                        type="button"
                        className="btn-chip"
                        data-pop={`套用 ${pr.name}`}
                        disabled={busy}
                        onClick={() =>
                          void runAction(() =>
                            api.allocateWorkers({
                              mode: "preset",
                              presetName: pr.name,
                            }),
                          )
                        }
                      >
                        {pr.name}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="preset-save-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!presetInput.trim()) return;
                    void runAction(() =>
                      api.saveAllocationPreset({
                        name: presetInput.trim(),
                      }),
                    );
                    setPresetInput("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="方案名..."
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn-outline"
                    data-pop="✓ 保存方案"
                    disabled={busy}
                  >
                    保存
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        <SettlementPanel state={state} busy={busy} runAction={runAction} />
      </main>
    </div>
  );
}
