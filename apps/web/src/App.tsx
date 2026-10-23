import { useEffect, useMemo, useState } from "react";
import {
  api,
  ApiError,
  type Benchmark30mResp,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import {
  Activity,
  Award,
  Box,
  Compass,
  Cpu,
  Droplets,
  FastForward,
  FlaskConical,
  Hammer,
  Layers,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Sun,
  Swords,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { ICON } from "./icons";
import { applyTheme, getInitialTheme, type ThemeMode } from "./theme";
import {
  formatClockMMSS,
  formatETA,
  formatGold,
  formatRate,
  formatResource,
} from "./format";
import { ProceduralRelicSVG } from "./ProceduralRelicSVG";
import { WarGraphMapSVG } from "./WarGraphMapSVG";

type BottomTab = "craft" | "market" | "war" | "collectibles" | "macro";

export function App() {
  const [state, setState] = useState<DashboardStateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [activeTab, setActiveTab] = useState<BottomTab>("craft");
  const [presetInput, setPresetInput] = useState("");
  const [customHandleInput, setCustomHandleInput] = useState("");
  const [showAllPanelsEarly, setShowAllPanelsEarly] = useState(false);

  // Spot market form state
  const [selectedMarketItem, setSelectedMarketItem] = useState("auto_pump");
  const [orderSide, setOrderSide] = useState<"BID" | "ASK">("BID");
  const [orderPriceGold, setOrderPriceGold] = useState("19.20");
  const [orderQtyUnits, setOrderQtyUnits] = useState("1");

  // War deployment form state
  const [selectedNodeId, setSelectedNodeId] = useState("node_north_fort");
  const [deployInf, setDeployInf] = useState(2);
  const [deployArc, setDeployArc] = useState(2);
  const [deployCav, setDeployCav] = useState(2);

  // 30m simulator benchmark modal
  const [benchmarkData, setBenchmarkData] = useState<Benchmark30mResp | null>(
    null,
  );
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);

  // Smooth visual interpolation offset (ms since last state update)
  const [lastSyncAtMs, setLastSyncAtMs] = useState<number>(() => Date.now());
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const applyServerState = (next: DashboardStateResp) => {
    setState(next);
    setLastSyncAtMs(Date.now());
    setNowTickMs(Date.now());
  };

  useEffect(() => {
    let active = true;
    api
      .getDashboard()
      .then((res) => {
        if (!active) return;
        applyServerState(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorBanner(
          err instanceof Error ? err.message : "加载游戏状态失败",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasActivePopulation = (state?.player.populationTotal ?? 0) > 0;
  const activeHandle = state?.player.handle ?? "";

  // Poll authoritative state every 2.5s when player has active production
  useEffect(() => {
    if (!hasActivePopulation) return;
    const timer = window.setInterval(() => {
      api
        .getDashboard()
        .then((res) => {
          applyServerState(res);
        })
        .catch(() => {
          // ignore transient background poll errors
        });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasActivePopulation, activeHandle]);

  // 200ms local visual interpolation tick so numbers increment smoothly without layout jitter
  useEffect(() => {
    if (!hasActivePopulation) return;
    const id = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 200);
    return () => window.clearInterval(id);
  }, [hasActivePopulation]);

  const runAction = async (
    fn: () => Promise<DashboardStateResp>,
    successMsg?: string,
  ) => {
    setErrorBanner(null);
    setBusy(true);
    try {
      const next = await fn();
      applyServerState(next);
      if (successMsg) {
        setNoticeBanner(successMsg);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorBanner(err.message);
      } else if (err instanceof Error) {
        setErrorBanner(err.message);
      } else {
        setErrorBanner("操作未完成，请检查条件");
      }
    } finally {
      setBusy(false);
    }
  };

  const interpSeconds = useMemo(() => {
    if (!state) return 0;
    const elapsedSec = Math.max(0, (nowTickMs - lastSyncAtMs) / 1000);
    return Math.min(3.0, elapsedSec) * state.player.speedMultiplier;
  }, [state, nowTickMs, lastSyncAtMs]);

  if (loading || !state) {
    return (
      <div className="loading-shell">
        <div className="loading-box">
          <Droplets size={ICON.lg} />
          <span className="mono-num">D2E · 滴水成城 // 正在同步权威世界快照...</span>
        </div>
      </div>
    );
  }

  const { player, resources, jobs, blueprints, professions } = state;
  const waterRes = resources.find((r) => r.key === "water")!;
  const liveWaterMilli =
    waterRes.amountMilli +
    Math.floor(waterRes.netRatePerSecMilli * interpSeconds);

  // Progressive disclosure flags (GDD 3.2)
  const hasReached10Water =
    liveWaterMilli >= 10000 ||
    player.populationTotal > 0 ||
    player.totalManualClicks >= 10 ||
    showAllPanelsEarly;
  const hasFirstResident =
    player.populationTotal > 0 || player.phase >= 2 || showAllPanelsEarly;
  const treasureUnlocked =
    blueprints.find((b) => b.code === "mystery_treasure")?.unlocked ?? false;
  const showProfessionChoice =
    treasureUnlocked && player.profession === "none";
  const showAdvancedSystems =
    player.profession !== "none" || treasureUnlocked || showAllPanelsEarly;

  const selectedWarNode =
    state.war.nodes.find((n) => n.nodeId === selectedNodeId) ??
    state.war.nodes[0];

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

  const adjustJobCount = (jobKey: string, delta: number) => {
    const entries = jobs.map((j) => {
      if (j.jobKey !== jobKey) {
        return { jobKey: j.jobKey, count: j.assigned };
      }
      const nextCount = Math.max(0, j.assigned + delta);
      return { jobKey: j.jobKey, count: nextCount };
    });
    void runAction(() =>
      api.allocateWorkers({ mode: "manual", entries }),
    );
  };

  const handleOpenBenchmark = async () => {
    setErrorBanner(null);
    try {
      const res = await api.runBenchmark30m();
      setBenchmarkData(res);
      setShowBenchmarkModal(true);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : "运行模拟器失败");
    }
  };

  return (
    <div className="app-shell">
      {/* Top Architectural Command Header */}
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-emblem">D2E</div>
          <div className="brand-titles">
            <div className="brand-main">
              <span>滴水成城</span>
              <span className="brand-sub">DROP TO EMPIRE // SPEC V1.0</span>
            </div>
            <div className="brand-meta">
              <span>阶段 P{player.phase}</span>
              <span>·</span>
              <span>职业：{player.professionName}</span>
              {player.artifactName && (
                <>
                  <span>·</span>
                  <span>神器：{player.artifactName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="telemetry-strip">
          <div className="metric-cell">
            <span className="metric-label">模拟时钟</span>
            <span className="metric-value mono-num">
              {formatClockMMSS(
                player.simulatedElapsedSeconds + Math.floor(interpSeconds),
              )}
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">人口 (在岗/总计)</span>
            <span className="metric-value mono-num">
              {player.populationAssigned} / {player.populationTotal}
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">流通金币 (可用/冻结)</span>
            <span className="metric-value mono-num">
              {formatGold(player.goldBasis)}
              {player.goldFrozenBasis > 0 && (
                <small className="metric-sub mono-num">
                  {" "}
                  ({formatGold(player.goldFrozenBasis)})
                </small>
              )}
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">赛季活动点</span>
            <span className="metric-value mono-num">
              {player.activityPoints} PTS
            </span>
          </div>
        </div>

        <div className="toolbar-actions">
          {/* Speed multiplier selector */}
          <div className="speed-group" role="group" aria-label="时间流速倍率">
            {[1, 10, 60, 300].map((mult) => (
              <button
                key={mult}
                type="button"
                className={`btn-chip mono-num ${player.speedMultiplier === mult ? "active" : ""}`}
                onClick={() =>
                  void runAction(() =>
                    api.controlSimulation({
                      action: "set_speed",
                      speedMultiplier: mult,
                    }),
                  )
                }
              >
                {mult}x
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-outline"
            title="快进 60 秒生产"
            onClick={() =>
              void runAction(
                () =>
                  api.controlSimulation({
                    action: "fast_forward",
                    advanceSeconds: 60,
                  }),
                "已快进 60 秒生产进度",
              )
            }
          >
            <FastForward size={ICON.xs} />
            <span className="mono-num">+60s</span>
          </button>

          {!treasureUnlocked && (
            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                void runAction(
                  () =>
                    api.controlSimulation({
                      action: "unlock_treasure_ready",
                    }),
                  "已推进至第 29 分钟里程碑，可直接开启【神秘的宝藏】！",
                )
              }
            >
              <Sparkles size={ICON.xs} />
              <span>直达宝藏节点</span>
            </button>
          )}

          <button
            type="button"
            className="btn-outline"
            onClick={() => void handleOpenBenchmark()}
          >
            <Activity size={ICON.xs} />
            <span>30m 数值验证</span>
          </button>

          {/* Account Switcher */}
          <div className="account-switcher">
            <Users size={ICON.xs} />
            <select
              aria-label="切换测试角色"
              value={player.handle}
              onChange={(e) =>
                void runAction(
                  () => api.switchAccount({ handle: e.target.value }),
                  `已切换至账号 ${e.target.value}`,
                )
              }
            >
              {state.availableHandles.map((h) => (
                <option key={h} value={h}>
                  {h === "pioneer"
                    ? "pioneer (0秒起点)"
                    : h === "archon_demo"
                      ? "archon_demo (满级科学家)"
                      : h}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-icon"
            aria-label="切换纸本/石板主题"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? (
              <Moon size={ICON.sm} />
            ) : (
              <Sun size={ICON.sm} />
            )}
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {(errorBanner || noticeBanner || player.offlineAwardSummary) && (
        <div
          className={`status-banner ${errorBanner ? "status-danger" : "status-info"}`}
          role="status"
        >
          <span>
            {errorBanner || noticeBanner || player.offlineAwardSummary}
          </span>
          <button
            type="button"
            className="banner-close"
            onClick={() => {
              setErrorBanner(null);
              setNoticeBanner(null);
            }}
          >
            关闭
          </button>
        </div>
      )}

      {/* Critical Milestone: Profession Selection Gate (GDD 4.3 & 5.2) */}
      {showProfessionChoice && (
        <section className="profession-gate-banner" aria-label="选择终身职业">
          <div className="section-head">
            <div>
              <span className="tag-badge tag-warning">阶段里程碑达成</span>
              <h2>远古宝藏已开启 · 请抉择你的终身职业（不可反悔）</h2>
              <p>
                不同职业在独占制造品、生产优化方向以及对商会战争和全球市场的供给上存在本质差异。你无法制造其他职业的专属制品，但可通过现货交易所自由互通。
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
                  <span className="tag-badge">神器：{pr.artifactName}</span>
                </div>
                <dl className="profession-specs">
                  <div>
                    <dt>独占制造</dt>
                    <dd>{pr.exclusiveOutputs.join("、")}</dd>
                  </div>
                  <div>
                    <dt>被动专长</dt>
                    <dd>{pr.passiveBonusText}</dd>
                  </div>
                  <div>
                    <dt>典型优势</dt>
                    <dd>{pr.strengthText}</dd>
                  </div>
                  <div>
                    <dt>供应链短板</dt>
                    <dd>{pr.weaknessText}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="btn-primary btn-block"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => api.chooseProfession({ profession: pr.code }),
                      `已就职为【${pr.name}】！全球市场与商会战争已解锁。`,
                    )
                  }
                >
                  <UserCheck size={ICON.sm} />
                  <span>宣誓就职 · {pr.name}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Main 3-Column Upper Dashboard (GDD 3.1) */}
      <main className="dashboard-grid">
        {/* Column 1: Resource Overview & Manual Water Action */}
        <section className="panel" aria-label="资源与总览">
          <div className="panel-header">
            <div className="panel-title">
              <Droplets size={ICON.sm} />
              <h2>01 // 资源库存与实时净产率</h2>
            </div>
            <button
              type="button"
              className="btn-link"
              onClick={() => setShowAllPanelsEarly((v) => !v)}
            >
              {showAllPanelsEarly ? "恢复渐进披露" : "预览全系统"}
            </button>
          </div>

          {/* Primary Manual Action Button (Always present from 0s) */}
          <div className="water-hero-box">
            <div className="water-readout">
              <span className="water-label">💧 原初水源库存 (WATER)</span>
              <strong className="water-big-num mono-num">
                {formatResource(liveWaterMilli, 1)}
              </strong>
              <span className="water-rate mono-num">
                净流速 {formatRate(waterRes.netRatePerSecMilli)} · 累计手点{" "}
                {player.totalManualClicks} 次
              </span>
            </div>
            <button
              type="button"
              className="btn-water-strike"
              onClick={() => void runAction(() => api.gatherWater({ clicks: 1 }))}
            >
              <Droplets size={ICON.md} />
              <span>
                手动打水 +
                {blueprints.find((b) => b.code === "first_resident")?.unlocked
                  ? "2.0"
                  : "1.0"}
              </span>
            </button>
          </div>

          {/* Resource Ledger Table */}
          <div className="table-wrap">
            <table className="ink-table">
              <thead>
                <tr>
                  <th>物资名称</th>
                  <th>层级</th>
                  <th className="num-col">库存量</th>
                  <th className="num-col">净速率</th>
                </tr>
              </thead>
              <tbody>
                {resources
                  .filter((r) => r.unlocked || showAllPanelsEarly)
                  .map((r) => {
                    const liveAmt =
                      r.amountMilli +
                      Math.floor(r.netRatePerSecMilli * interpSeconds);
                    return (
                      <tr key={r.key} title={r.description}>
                        <td className="res-name-cell">
                          <span>{r.name}</span>
                          {r.frozenMilli > 0 && (
                            <small className="frozen-tag mono-num">
                              冻:{formatResource(r.frozenMilli, 0)}
                            </small>
                          )}
                        </td>
                        <td>
                          <span className="tier-pill">{r.tier}</span>
                        </td>
                        <td className="num-col mono-num">
                          {formatResource(
                            r.tier === "basic" ? liveAmt : r.amountMilli,
                            r.tier === "basic" ? 1 : 0,
                          )}
                        </td>
                        <td
                          className={`num-col mono-num ${r.netRatePerSecMilli > 0 ? "rate-pos" : "rate-zero"}`}
                        >
                          {r.netRatePerSecMilli > 0
                            ? formatRate(r.netRatePerSecMilli)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Column 2: Production & Worker Allocation */}
        <section className="panel" aria-label="生产与人口分配">
          <div className="panel-header">
            <div className="panel-title">
              <Hammer size={ICON.sm} />
              <h2>02 // 生产岗位与劳动力分配</h2>
            </div>
            <span className="tag-badge mono-num">
              闲置人力: {player.populationIdle}
            </span>
          </div>

          {!hasFirstResident ? (
            <div className="empty-stage-hint">
              <p>
                <strong>尚未招募居民：</strong>
                先点击左侧【手动打水 +1】累计 10 滴水，在右侧招募第 1 位居民后即可开启自动产水与多岗位分工。
              </p>
            </div>
          ) : (
            <>
              <div className="quick-alloc-bar">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "auto_balanced" }),
                    )
                  }
                >
                  智能均衡分配
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "water_focus" }),
                    )
                  }
                >
                  主攻打水
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "wood_focus" }),
                    )
                  }
                >
                  主攻伐木
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    void runAction(() =>
                      api.allocateWorkers({ mode: "stone_focus" }),
                    )
                  }
                >
                  主攻采石
                </button>
              </div>

              <div className="job-list">
                {jobs.map((job) => (
                  <div
                    key={job.jobKey}
                    className={`job-row ${!job.unlocked ? "job-row-locked" : ""}`}
                  >
                    <div className="job-info">
                      <div className="job-title-line">
                        <strong>{job.name}</strong>
                        <span className="tag-badge mono-num">
                          效率 {job.efficiencyPct}%
                        </span>
                      </div>
                      <small className="job-sub">
                        {job.unlocked ? (
                          <span className="mono-num">
                            单人 {(job.effectiveRateMilli / 1000).toFixed(2)}/s ·{" "}
                            {job.inputSummary}
                          </span>
                        ) : (
                          job.unlockHint
                        )}
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
                          disabled={!job.unlocked || job.assigned < 5 || busy}
                          onClick={() => adjustJobCount(job.jobKey, -5)}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          disabled={!job.unlocked || job.assigned <= 0 || busy}
                          onClick={() => adjustJobCount(job.jobKey, -1)}
                        >
                          -1
                        </button>
                        <span className="job-count mono-num">
                          {job.assigned}人
                        </span>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          disabled={
                            !job.unlocked || player.populationIdle <= 0 || busy
                          }
                          onClick={() => adjustJobCount(job.jobKey, 1)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          disabled={
                            !job.unlocked || player.populationIdle < 5 || busy
                          }
                          onClick={() => adjustJobCount(job.jobKey, 5)}
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Saved Presets Manager */}
              <div className="preset-bar">
                <div className="preset-chips">
                  {state.presets.map((pr) => (
                    <button
                      key={pr.name}
                      type="button"
                      className="btn-chip"
                      onClick={() =>
                        void runAction(() =>
                          api.allocateWorkers({
                            mode: "preset",
                            presetName: pr.name,
                          }),
                        )
                      }
                    >
                      套用：{pr.name}
                    </button>
                  ))}
                </div>
                <form
                  className="preset-save-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!presetInput.trim()) return;
                    void runAction(
                      () =>
                        api.saveAllocationPreset({ name: presetInput.trim() }),
                      `已保存方案【${presetInput.trim()}】`,
                    );
                    setPresetInput("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="保存当前方案名..."
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                  />
                  <button type="submit" className="btn-outline">
                    保存方案
                  </button>
                </form>
              </div>
            </>
          )}
        </section>

        {/* Column 3: Resident Recruitment & Blueprint Progression */}
        <section className="panel" aria-label="解锁、制造与商店">
          <div className="panel-header">
            <div className="panel-title">
              <Compass size={ICON.sm} />
              <h2>03 // 居民招募与蓝图研发</h2>
            </div>
            <span className="tag-badge mono-num">
              已解锁 {blueprints.filter((b) => b.unlocked).length}/
              {blueprints.length}
            </span>
          </div>

          {!hasReached10Water ? (
            <div className="empty-stage-hint">
              <p>
                <strong>商店入口准备中：</strong>
                累计打满 <span className="mono-num">10.0</span> 滴水后开放居民招募与蓝图商店（当前{" "}
                <span className="mono-num">
                  {formatResource(liveWaterMilli, 1)} / 10.0
                </span>
                ）。
              </p>
            </div>
          ) : (
            <>
              {/* Resident Recruitment Card */}
              <div className="recruit-card">
                <div className="recruit-meta">
                  <div className="recruit-head">
                    <strong>招募新居民 (#{player.populationTotal + 1})</strong>
                    <span className="tag-badge mono-num">
                      预计 {formatETA(player.nextResidentEtaSeconds)}
                    </span>
                  </div>
                  <div className="recruit-cost mono-num">
                    成本：{formatResource(player.nextResidentCostWaterMilli, 1)}{" "}
                    水 · 公式 C(n)=⌈10×1.12ⁿ⌉
                  </div>
                </div>
                <div className="recruit-btns">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      liveWaterMilli < player.nextResidentCostWaterMilli || busy
                    }
                    onClick={() =>
                      void runAction(() => api.recruitResident({ count: 1 }))
                    }
                  >
                    <Plus size={ICON.xs} />
                    <span>招募 +1</span>
                  </button>
                  <button
                    type="button"
                    className="btn-outline mono-num"
                    disabled={
                      liveWaterMilli < player.nextResidentCostWaterMilli || busy
                    }
                    onClick={() =>
                      void runAction(() => api.recruitResident({ count: 5 }))
                    }
                  >
                    +5人
                  </button>
                </div>
              </div>

              {/* Blueprint Tree List */}
              <div className="blueprint-list">
                {blueprints
                  .filter((bp) => bp.visible || showAllPanelsEarly)
                  .map((bp) => (
                    <article
                      key={bp.code}
                      className={`bp-card ${bp.unlocked ? "bp-unlocked" : bp.canUnlock ? "bp-ready" : ""}`}
                    >
                      <div className="bp-top">
                        <div>
                          <strong>{bp.name}</strong>
                          <span className="bp-pop-req mono-num">
                            需 {bp.requiredPopulation} 人口
                          </span>
                        </div>
                        {bp.unlocked ? (
                          <span className="tag-badge tag-success">已掌握</span>
                        ) : (
                          <span className="tag-badge mono-num">
                            预计 {formatETA(bp.etaSeconds)}
                          </span>
                        )}
                      </div>
                      <p className="bp-desc">{bp.effectSummary}</p>
                      {!bp.unlocked && (
                        <div className="bp-footer">
                          <div className="bp-costs">
                            {bp.costs.map((c) => {
                              const ok = c.currentMilli >= c.requiredMilli;
                              return (
                                <span
                                  key={c.resourceKey}
                                  className={`cost-chip mono-num ${ok ? "cost-ok" : "cost-lack"}`}
                                >
                                  {c.resourceName}:{" "}
                                  {formatResource(c.currentMilli, 0)}/
                                  {formatResource(c.requiredMilli, 0)}
                                </span>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={!bp.canUnlock || busy}
                            onClick={() =>
                              void runAction(() =>
                                api.unlockBlueprint({ code: bp.code }),
                              )
                            }
                          >
                            研发解锁
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
              </div>
            </>
          )}
        </section>
      </main>

      {/* Lower Multi-System Workspace Tabs (GDD 3.1) */}
      <section className="lower-workspace" aria-label="帝国进阶与多人系统">
        <div className="tabs-header">
          <div className="tab-buttons" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "craft"}
              className={`tab-btn ${activeTab === "craft" ? "active" : ""}`}
              onClick={() => setActiveTab("craft")}
            >
              <Cpu size={ICON.sm} />
              <span>工坊制造与跨职业设备</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "market"}
              className={`tab-btn ${activeTab === "market" ? "active" : ""}`}
              onClick={() => setActiveTab("market")}
            >
              <TrendingUp size={ICON.sm} />
              <span>全球现货交易所</span>
              {!showAdvancedSystems && (
                <small className="lock-pill">选职业开放</small>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "war"}
              className={`tab-btn ${activeTab === "war" ? "active" : ""}`}
              onClick={() => setActiveTab("war")}
            >
              <Swords size={ICON.sm} />
              <span>七日商会战争 (D{state.war.currentDay}/7)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "collectibles"}
              className={`tab-btn ${activeTab === "collectibles" ? "active" : ""}`}
              onClick={() => setActiveTab("collectibles")}
            >
              <Award size={ICON.sm} />
              <span>赛季宝箱与程序化藏品 ({state.collectibles.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "macro"}
              className={`tab-btn ${activeTab === "macro" ? "active" : ""}`}
              onClick={() => setActiveTab("macro")}
            >
              <Scale size={ICON.sm} />
              <span>赛季预告、宏观账本与日志</span>
            </button>
          </div>

          <div className="workspace-quick-ops">
            <form
              className="new-account-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!customHandleInput.trim()) return;
                void runAction(
                  () =>
                    api.switchAccount({ handle: customHandleInput.trim() }),
                  `已创建/切换至角色 ${customHandleInput.trim()}`,
                );
                setCustomHandleInput("");
              }}
            >
              <input
                type="text"
                placeholder="新建/切换多账号ID..."
                value={customHandleInput}
                onChange={(e) => setCustomHandleInput(e.target.value)}
              />
              <button type="submit" className="btn-outline">
                切换账号
              </button>
            </form>
            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                void runAction(
                  () => api.controlSimulation({ action: "reset_player" }),
                  "已将当前账号重置回第 0 秒初始状态",
                )
              }
            >
              <RefreshCw size={ICON.xs} />
              <span>重置本号</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Workshop Crafting & Cross-Profession Equipment Slots */}
        {activeTab === "craft" && (
          <div className="tab-body split-2col">
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>
                  <Layers size={ICON.sm} />
                  <span>工坊跨职业设备插槽（可从市场采购其他职业制品加装）</span>
                </h3>
              </div>
              <div className="equip-slot-list">
                {state.installedEquipments.map((eq) => (
                  <div key={eq.itemKey} className="equip-card">
                    <div className="equip-main">
                      <div className="equip-title-row">
                        <strong>{eq.name}</strong>
                        <span className="tag-badge mono-num">
                          已装槽 {eq.installedCount} / {eq.maxStack} · 仓库存量{" "}
                          {eq.inventoryUnits}
                        </span>
                      </div>
                      <p>{eq.bonusSummary}</p>
                    </div>
                    <div className="equip-actions">
                      <button
                        type="button"
                        className="btn-outline mono-num"
                        disabled={eq.installedCount <= 0 || busy}
                        onClick={() =>
                          void runAction(() =>
                            api.installEquipment({
                              itemKey: eq.itemKey,
                              delta: -1,
                            }),
                          )
                        }
                      >
                        卸下 -1
                      </button>
                      <button
                        type="button"
                        className="btn-primary mono-num"
                        disabled={
                          eq.inventoryUnits <= 0 ||
                          eq.installedCount >= eq.maxStack ||
                          busy
                        }
                        onClick={() =>
                          void runAction(() =>
                            api.installEquipment({
                              itemKey: eq.itemKey,
                              delta: 1,
                            }),
                          )
                        }
                      >
                        加装 +1
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="subpanel">
              <div className="subpanel-head">
                <h3>
                  <FlaskConical size={ICON.sm} />
                  <span>工坊制造与职业独占配方表</span>
                </h3>
              </div>
              <div className="recipe-grid">
                {state.recipes.map((rc) => (
                  <article
                    key={rc.recipeCode}
                    className={`recipe-card ${!rc.professionMatched ? "recipe-other-prof" : ""}`}
                  >
                    <div className="recipe-head">
                      <div>
                        <strong>{rc.name}</strong>
                        <span
                          className={`tag-badge ${rc.professionMatched ? "tag-success" : ""}`}
                        >
                          {rc.professionReqName}
                        </span>
                      </div>
                      <span className="mono-num">
                        产出 +{formatResource(rc.outputAmountMilli, 0)}{" "}
                        {rc.outputName}
                      </span>
                    </div>
                    <p className="recipe-desc">{rc.effectSummary}</p>
                    <div className="recipe-footer">
                      <div className="bp-costs">
                        {rc.costs.map((c) => (
                          <span
                            key={c.resourceKey}
                            className={`cost-chip mono-num ${c.currentMilli >= c.requiredMilli ? "cost-ok" : "cost-lack"}`}
                          >
                            {c.resourceName}:{" "}
                            {formatResource(c.currentMilli, 0)}/
                            {formatResource(c.requiredMilli, 0)}
                          </span>
                        ))}
                        {rc.goldCostBasis > 0 && (
                          <span className="cost-chip mono-num">
                            工坊费: {formatGold(rc.goldCostBasis)} 金币
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!rc.canCraft || busy}
                        onClick={() =>
                          void runAction(() =>
                            api.craftItem({
                              recipeCode: rc.recipeCode,
                              batches: 1,
                            }),
                          )
                        }
                      >
                        {rc.professionMatched ? "立即制造" : "他职独占（去市场买）"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Spot Market Exchange */}
        {activeTab === "market" && (
          <div className="tab-body split-3col">
            {/* Market Ticker Table */}
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>01 // 现货行情看板（玩家与做市商撮合定价）</h3>
              </div>
              <div className="table-wrap">
                <table className="ink-table clickable-rows">
                  <thead>
                    <tr>
                      <th>标的物</th>
                      <th className="num-col">最新价</th>
                      <th className="num-col">买一 / 卖一</th>
                      <th className="num-col">成交量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.marketSummaries.map((m) => (
                      <tr
                        key={m.itemKey}
                        className={
                          m.itemKey === selectedMarketItem ? "row-selected" : ""
                        }
                        onClick={() => {
                          setSelectedMarketItem(m.itemKey);
                          const refPrice =
                            orderSide === "BID" && m.bestAskBasis > 0
                              ? m.bestAskBasis
                              : orderSide === "ASK" && m.bestBidBasis > 0
                                ? m.bestBidBasis
                                : m.lastPriceBasis;
                          setOrderPriceGold((refPrice / 10000).toFixed(2));
                        }}
                      >
                        <td>
                          <strong>{m.itemName}</strong>
                        </td>
                        <td className="num-col mono-num">
                          {formatGold(m.lastPriceBasis)}
                        </td>
                        <td className="num-col mono-num">
                          {m.bestBidBasis > 0
                            ? formatGold(m.bestBidBasis)
                            : "—"}{" "}
                          /{" "}
                          {m.bestAskBasis > 0
                            ? formatGold(m.bestAskBasis)
                            : "—"}
                        </td>
                        <td className="num-col mono-num">
                          {formatResource(m.volume24hMilli, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Order Entry & Orderbook Depth */}
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>
                  02 // 限价委托与深度簿 · {selectedMarketMeta.itemName}
                </h3>
              </div>

              <form
                className="order-ticket"
                onSubmit={(e) => {
                  e.preventDefault();
                  const priceBasis = Math.round(
                    Number(orderPriceGold) * 10000,
                  );
                  const quantityMilli = Math.round(
                    Number(orderQtyUnits) * 1000,
                  );
                  void runAction(() =>
                    api.placeMarketOrder({
                      itemKey: selectedMarketItem,
                      side: orderSide,
                      priceBasis,
                      quantityMilli,
                    }),
                  );
                }}
              >
                <div className="side-switch">
                  <button
                    type="button"
                    className={`side-btn ${orderSide === "BID" ? "active-bid" : ""}`}
                    onClick={() => setOrderSide("BID")}
                  >
                    BID · 限价买入
                  </button>
                  <button
                    type="button"
                    className={`side-btn ${orderSide === "ASK" ? "active-ask" : ""}`}
                    onClick={() => setOrderSide("ASK")}
                  >
                    ASK · 限价卖出
                  </button>
                </div>

                <div className="form-row-2">
                  <label>
                    <span>单价 (金币/单位)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="mono-num"
                      value={orderPriceGold}
                      onChange={(e) => setOrderPriceGold(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>数量 (整数单位)</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="mono-num"
                      value={orderQtyUnits}
                      onChange={(e) => setOrderQtyUnits(e.target.value)}
                    />
                  </label>
                </div>

                <div className="order-summary mono-num">
                  <span>
                    预计总额:{" "}
                    {(
                      Number(orderPriceGold || 0) * Number(orderQtyUnits || 0)
                    ).toFixed(2)}{" "}
                    金币
                  </span>
                  <span>税率 1.00% (0.50%销毁 + 0.50%财政)</span>
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-block"
                  disabled={busy || player.profession === "none"}
                >
                  {player.profession === "none"
                    ? "需先选定职业后解锁市场交易"
                    : `提交 ${orderSide === "BID" ? "买入" : "卖出"} 限价单`}
                </button>
              </form>

              <div className="orderbook-box">
                <h4>当前挂单深度 ({selectedMarketMeta.itemName})</h4>
                <div className="table-wrap">
                  <table className="ink-table">
                    <thead>
                      <tr>
                        <th>方向</th>
                        <th className="num-col">报价</th>
                        <th className="num-col">剩余量</th>
                        <th>挂单方</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.openOrders
                        .filter((o) => o.itemKey === selectedMarketItem)
                        .map((o) => (
                          <tr key={o.id}>
                            <td>
                              <span
                                className={`side-pill ${o.side === "BID" ? "pill-bid" : "pill-ask"}`}
                              >
                                {o.side}
                              </span>
                            </td>
                            <td className="num-col mono-num">
                              {formatGold(o.priceBasis)}
                            </td>
                            <td className="num-col mono-num">
                              {formatResource(o.remainingMilli, 0)}
                            </td>
                            <td>{o.makerName}</td>
                            <td>
                              {o.isOwn ? (
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() =>
                                    void runAction(() =>
                                      api.cancelMarketOrder(o.id),
                                    )
                                  }
                                >
                                  撤单
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => {
                                    setOrderSide(
                                      o.side === "ASK" ? "BID" : "ASK",
                                    );
                                    setOrderPriceGold(
                                      (o.priceBasis / 10000).toFixed(2),
                                    );
                                    setOrderQtyUnits(
                                      String(
                                        Math.max(
                                          1,
                                          Math.floor(o.remainingMilli / 1000),
                                        ),
                                      ),
                                    );
                                  }}
                                >
                                  吃单填入
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Executed Trades Tape */}
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>03 // 全服最新原子成交记录</h3>
              </div>
              <div className="table-wrap">
                <table className="ink-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>商品</th>
                      <th className="num-col">成交价</th>
                      <th className="num-col">数量</th>
                      <th className="num-col">销毁税</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.recentTrades.map((tr) => (
                      <tr
                        key={tr.id}
                        title={`买方: ${tr.buyerName} / 卖方: ${tr.sellerName}`}
                      >
                        <td className="mono-num">{tr.executedAt}</td>
                        <td>{tr.itemName}</td>
                        <td className="num-col mono-num">
                          {formatGold(tr.priceBasis)}
                        </td>
                        <td className="num-col mono-num">
                          {formatResource(tr.quantityMilli, 0)}
                        </td>
                        <td className="num-col mono-num">
                          -{formatGold(tr.taxBurnedBasis, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 7-Day Chamber War */}
        {activeTab === "war" && (
          <div className="tab-body war-layout">
            <div className="war-main-col">
              <div className="war-scoreboard">
                <div className="guild-score-block">
                  <span className="guild-tag">黑曜商会 (OBSIDIAN)</span>
                  <strong className="mono-num">
                    {state.war.obsidianTotalScore} 分
                  </strong>
                </div>
                <div className="war-day-banner">
                  <span className="tag-badge">
                    {state.war.seasonName} · 第 D{state.war.currentDay} / 7 日
                  </span>
                  <small>{state.war.nextSettlementLabel}</small>
                </div>
                <div className="guild-score-block">
                  <span className="guild-tag">白银同盟 (ARGENT)</span>
                  <strong className="mono-num">
                    {state.war.argentTotalScore} 分
                  </strong>
                </div>
              </div>

              <WarGraphMapSVG
                nodes={state.war.nodes}
                edges={state.war.edges}
                selectedNodeId={selectedWarNode.nodeId}
                onSelectNode={(id) => setSelectedNodeId(id)}
              />

              {/* Nightly Battle Settlement Replay Logs */}
              <div className="war-history-box">
                <div className="subpanel-head">
                  <h3>20:00 战区快照结算战报（确定性加权克制公式 + 伤亡损耗审计）</h3>
                </div>
                {state.war.settlementHistory.length === 0 ? (
                  <p className="muted-note">
                    今日尚未执行 20:00 结算。部署军备后可点击右侧【立即触发 20:00 战区锁定结算】查看完整战报与积分发放。
                  </p>
                ) : (
                  <div className="settlement-list">
                    {state.war.settlementHistory.map((h) => (
                      <details
                        key={`${h.dayIndex}-${h.settledAt}`}
                        className="settlement-item"
                        open
                      >
                        <summary className="mono-num">
                          D{h.dayIndex} 结算快照 ({h.settledAt}) — 黑曜 +
                          {h.obsidianScoreDelta}分 / 白银 +{h.argentScoreDelta}分
                          · 个人获得 +{h.playerPointsEarned} 活动点
                        </summary>
                        <div className="table-wrap">
                          <table className="ink-table">
                            <thead>
                              <tr>
                                <th>战略城池</th>
                                <th>归属变化</th>
                                <th className="num-col">黑曜兵力(步/弓/骑)</th>
                                <th className="num-col">白银兵力(步/弓/骑)</th>
                                <th className="num-col">有效攻/守战力</th>
                                <th>战损与结果摘要</th>
                              </tr>
                            </thead>
                            <tbody>
                              {h.nodeReports.map((nr) => (
                                <tr key={nr.nodeId}>
                                  <td>
                                    <strong>{nr.nodeName}</strong>
                                  </td>
                                  <td className="mono-num">
                                    {nr.prevOwner} → {nr.newOwner}
                                  </td>
                                  <td className="num-col mono-num">
                                    {nr.obsidianInfantry}/{nr.obsidianArcher}/
                                    {nr.obsidianCavalry}
                                  </td>
                                  <td className="num-col mono-num">
                                    {nr.argentInfantry}/{nr.argentArcher}/
                                    {nr.argentCavalry}
                                  </td>
                                  <td className="num-col mono-num">
                                    {(nr.effectiveAttackMilli / 1000).toFixed(1)}{" "}
                                    /{" "}
                                    {(nr.effectiveDefenseMilli / 1000).toFixed(1)}
                                  </td>
                                  <td>{nr.casualtySummary}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar: Selected Node Deployment & War Controls */}
            <aside className="subpanel war-side-col">
              <div className="subpanel-head">
                <h3>
                  <Shield size={ICON.sm} />
                  <span>战术指挥台 · {selectedWarNode.name}</span>
                </h3>
              </div>

              <div className="war-guild-bar">
                <span>当前效忠：{state.war.playerGuildName}</span>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    void runAction(() =>
                      api.switchGuild({
                        guildCode:
                          state.war.playerGuild === "OBSIDIAN"
                            ? "ARGENT"
                            : "OBSIDIAN",
                      }),
                    )
                  }
                >
                  切换商会阵营
                </button>
              </div>

              <div className="node-intel-card">
                <div className="intel-row">
                  <span>当前控制权</span>
                  <strong className="mono-num">
                    {selectedWarNode.ownerGuild} (城防 +
                    {selectedWarNode.defenseBonusPct}%)
                  </strong>
                </div>
                <div className="intel-row">
                  <span>驻军有效防御力</span>
                  <strong className="mono-num">
                    {(selectedWarNode.garrisonPower / 1000).toFixed(1)} (步
                    {selectedWarNode.infantryCount}/弓
                    {selectedWarNode.archerCount}/骑
                    {selectedWarNode.cavalryCount})
                  </strong>
                </div>
                <div className="intel-row">
                  <span>补给线连通判定</span>
                  <strong
                    className={
                      selectedWarNode.canDeploy ? "rate-pos" : "cost-lack"
                    }
                  >
                    {selectedWarNode.canDeploy
                      ? "✓ 补给线已连通（可出兵）"
                      : "✗ 补给线未连通（需先占领前哨）"}
                  </strong>
                </div>
                <div className="intel-row">
                  <span>今日个人军备预算上限</span>
                  <strong className="mono-num">
                    {state.war.dailyBudgetUsed} / {state.war.dailyBudgetCap} 点
                  </strong>
                </div>
                <p className="intel-note">{selectedWarNode.intelNote}</p>
              </div>

              <form
                className="deploy-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction(() =>
                    api.deployWarTroops({
                      nodeId: selectedWarNode.nodeId,
                      infantryDelta: deployInf,
                      archerDelta: deployArc,
                      cavalryDelta: deployCav,
                    }),
                  );
                }}
              >
                <h4>投入库存军备箱（胜方损耗20% / 败方损耗40%）</h4>
                <div className="form-row-3">
                  <label>
                    <span>重步兵 (克弓 1.15x)</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      className="mono-num"
                      value={deployInf}
                      onChange={(e) => setDeployInf(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>长弓兵 (克骑 1.15x)</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      className="mono-num"
                      value={deployArc}
                      onChange={(e) => setDeployArc(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>铁骑兵 (克步 1.15x)</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      className="mono-num"
                      value={deployCav}
                      onChange={(e) => setDeployCav(Number(e.target.value))}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-block"
                  disabled={
                    !selectedWarNode.canDeploy ||
                    busy ||
                    player.profession === "none"
                  }
                >
                  部署军团至【{selectedWarNode.name}】
                </button>
              </form>

              <div className="settle-trigger-box">
                <button
                  type="button"
                  className="btn-water-strike btn-block"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => api.triggerWarSettlement(),
                      `已完成第 D${state.war.currentDay} 日 20:00 商会战争结算！`,
                    )
                  }
                >
                  <Play size={ICON.sm} />
                  <span>立即执行 20:00 战区锁定结算</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* TAB 4: Season Chests & Procedural Collectibles */}
        {activeTab === "collectibles" && (
          <div className="tab-body">
            <div className="chest-console">
              <div className="chest-console-info">
                <h3>
                  <Box size={ICON.sm} />
                  <span>
                    S1 · 墨械筑城纪元典藏宝库（纯外观收藏资产 · 零数值加成 · 全球唯一序列号）
                  </span>
                </h3>
                <p>
                  每件藏品通过唯一种子 <code>pattern_seed</code> 在源纹理上进行随机{" "}
                  <code>uv_offset</code>、<code>uv_scale</code> 与{" "}
                  <code>uv_rotation</code>{" "}
                  采样。掉率公示：普通 60% / 精良 28% / 史诗 10% / 传说 2%（居中同心核或正交工程角具备额外收藏辨识度）。
                </p>
              </div>
              <div className="chest-console-actions">
                <button
                  type="button"
                  className="btn-outline mono-num"
                  disabled={player.activityPoints < 100 || busy}
                  onClick={() =>
                    void runAction(() => api.redeemSeasonChest({ count: 1 }))
                  }
                >
                  消耗 100 活动点兑换宝箱 (当前 {player.activityPoints} PTS)
                </button>
                <button
                  type="button"
                  className="btn-primary mono-num"
                  disabled={
                    (resources.find((r) => r.key === "season_chest")
                      ?.amountMilli ?? 0) < 1000 || busy
                  }
                  onClick={() =>
                    void runAction(() =>
                      api.openSeasonChest({ clientSeedHint: Date.now() }),
                    )
                  }
                >
                  <Sparkles size={ICON.sm} />
                  <span>
                    开启 S1 典藏宝箱 (库存{" "}
                    {Math.floor(
                      (resources.find((r) => r.key === "season_chest")
                        ?.amountMilli ?? 0) / 1000,
                    )}{" "}
                    个)
                  </span>
                </button>
              </div>
            </div>

            {state.collectibles.length === 0 ? (
              <div className="empty-stage-hint">
                <p>
                  尚未铸造任何赛季藏品。参与商会战争获取活动点数（或切换至预置账号{" "}
                  <code>archon_demo</code>），即可兑换并开启【S1·墨械典藏宝箱】生成程序化纹理藏品！
                </p>
              </div>
            ) : (
              <div className="collectibles-grid">
                {state.collectibles.map((item) => (
                  <article key={item.itemId} className="collectible-card">
                    <ProceduralRelicSVG item={item} />
                    <div className="collectible-meta">
                      <div className="collectible-title-row">
                        <strong>{item.name}</strong>
                        <span
                          className={`rarity-badge rarity-${item.rarityTier.toLowerCase()}`}
                        >
                          {item.rarityTier}
                        </span>
                      </div>
                      <div className="special-tag-row">{item.specialTag}</div>
                      <dl className="collectible-kv mono-num">
                        <div>
                          <dt>资产UUID</dt>
                          <dd>{item.itemId}</dd>
                        </div>
                        <div>
                          <dt>纹理/调色</dt>
                          <dd>
                            {item.textureName} · {item.paletteName}
                          </dd>
                        </div>
                        <div>
                          <dt>UV偏移/缩放</dt>
                          <dd>
                            ({item.uvOffsetX}‰, {item.uvOffsetY}‰) ·{" "}
                            {(item.uvScale / 1000).toFixed(2)}x ·{" "}
                            {item.uvRotation}°
                          </dd>
                        </div>
                        <div>
                          <dt>持有人/时间</dt>
                          <dd>
                            {item.ownerName} · {item.mintedAt}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Season Advance Notices, Macro Monetary Ledger & Event Logs */}
        {activeTab === "macro" && (
          <div className="tab-body split-3col">
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>01 // 提前一周版本轮转公告（GDD 第 8 章）</h3>
              </div>
              <div className="notice-stack">
                {state.seasonNotices.map((sn) => (
                  <article key={sn.seasonId} className="season-notice-card">
                    <div className="bp-top">
                      <strong>{sn.title}</strong>
                      <span className="tag-badge">{sn.effectiveIn}</span>
                    </div>
                    <p>{sn.summary}</p>
                    <ul>
                      {sn.demandShifts.map((ds) => (
                        <li key={ds}>{ds}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>

            <div className="subpanel">
              <div className="subpanel-head">
                <h3>02 // 全服货币存量恒等式审计（GDD 7.2）</h3>
              </div>
              <div className="ledger-audit-box mono-num">
                <div className="ledger-row">
                  <span>流通总存量 M(t)</span>
                  <strong>
                    {formatGold(state.macroLedger.totalIssuedBasis)}
                  </strong>
                </div>
                <div className="ledger-row">
                  <span>├ 玩家可用持币</span>
                  <span>{formatGold(state.macroLedger.playerHeldBasis)}</span>
                </div>
                <div className="ledger-row">
                  <span>├ 交易所买单冻结</span>
                  <span>{formatGold(state.macroLedger.escrowFrozenBasis)}</span>
                </div>
                <div className="ledger-row">
                  <span>├ 职业商会做市储备</span>
                  <span>{formatGold(state.macroLedger.npcHeldBasis)}</span>
                </div>
                <div className="ledger-row">
                  <span>└ 中央公共财政池</span>
                  <span>{formatGold(state.macroLedger.treasuryHeldBasis)}</span>
                </div>
                <hr className="ink-divider" />
                <div className="ledger-row">
                  <span>累计永久销毁 (0.5%交易税+制造回笼)</span>
                  <strong className="cost-lack">
                    -{formatGold(state.macroLedger.permanentlyBurnedBasis)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="subpanel">
              <div className="subpanel-head">
                <h3>03 // 权威事件审计流</h3>
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
        )}
      </section>

      {/* 30-Minute Progression Simulator Modal (GDD 4.4 & 21.1) */}
      {showBenchmarkModal && benchmarkData && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="前30分钟数值模拟验证器"
        >
          <div className="modal-sheet">
            <div className="modal-header">
              <div>
                <h2>前 30 分钟数值模拟器与里程碑校准对比（GDD 4.4 & 21.1）</h2>
                <p>{benchmarkData.note}</p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowBenchmarkModal(false)}
              >
                关闭窗口
              </button>
            </div>
            <div className="benchmark-grid">
              {benchmarkData.runs.map((run) => (
                <div key={run.strategyCode} className="benchmark-col">
                  <div className="benchmark-col-head">
                    <h3>{run.strategyName}</h3>
                    <span className="tag-badge mono-num">
                      总耗时 {run.formattedTotal}
                    </span>
                  </div>
                  <p className="bp-desc">{run.description}</p>
                  <table className="ink-table">
                    <thead>
                      <tr>
                        <th>里程碑节点</th>
                        <th className="num-col">人口</th>
                        <th className="num-col">达成时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.milestones.map((ms) => (
                        <tr key={ms.code}>
                          <td>{ms.name}</td>
                          <td className="num-col mono-num">{ms.population}</td>
                          <td className="num-col mono-num">
                            {ms.formattedTime}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
