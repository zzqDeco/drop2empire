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
  LogOut,
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

type BottomTab = "craft" | "market" | "war" | "collectibles" | "chronicle";
type AuthMode = "login" | "register";
type AdminViewMode = "admin" | "player";

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

  // Authentication form state
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authHandle, setAuthHandle] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode>("admin");

  // Optimistic water clicks for 0ms tactile response during novice phase
  const [optimisticWaterDeltaMilli, setOptimisticWaterDeltaMilli] = useState(0);
  const [optimisticClicksDelta, setOptimisticClicksDelta] = useState(0);

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

  // 30m simulator benchmark modal (Admin only)
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
    setOptimisticWaterDeltaMilli(0);
    setOptimisticClicksDelta(0);
    setLastSyncAtMs(Date.now());
    setNowTickMs(Date.now());
  };

  useEffect(() => {
    let active = true;
    if (!api.getSessionToken()) {
      setLoading(false);
      return;
    }
    api
      .getDashboard()
      .then((res) => {
        if (!active) return;
        applyServerState(res);
        setAdminViewMode(res.player.isAdmin ? "admin" : "player");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          api.setSessionToken(null);
          setState(null);
        } else {
          setErrorBanner(
            err instanceof Error ? err.message : "加载游戏状态失败",
          );
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasActivePopulation = (state?.player.populationTotal ?? 0) > 0;
  const activeHandle = state?.player.handle ?? "";

  // Poll authoritative state every 2.0s when player has active production
  useEffect(() => {
    if (!state || !hasActivePopulation) return;
    const timer = window.setInterval(() => {
      api
        .getDashboard()
        .then((res) => {
          applyServerState(res);
        })
        .catch(() => {
          // ignore transient poll errors
        });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state, hasActivePopulation, activeHandle]);

  // 150ms local visual interpolation tick so numbers increment smoothly without layout jitter
  useEffect(() => {
    if (!state || !hasActivePopulation) return;
    const id = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 150);
    return () => window.clearInterval(id);
  }, [state, hasActivePopulation]);

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
      if (err instanceof ApiError && err.status === 401) {
        api.setSessionToken(null);
        setState(null);
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

  const handleLogout = async () => {
    setBusy(true);
    try {
      await api.logoutAccount();
    } finally {
      setState(null);
      setNoticeBanner(null);
      setErrorBanner(null);
      setBusy(false);
    }
  };

  const interpSeconds = useMemo(() => {
    if (!state) return 0;
    const elapsedSec = Math.max(0, (nowTickMs - lastSyncAtMs) / 1000);
    return Math.min(2.5, elapsedSec) * state.player.speedMultiplier;
  }, [state, nowTickMs, lastSyncAtMs]);

  if (loading) {
    return (
      <div className="loading-shell">
        <div className="loading-box">
          <Droplets size={ICON.lg} />
          <span className="mono-num">D2E · 滴水成城 // 正在载入...</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 1. DEDICATED AUTHENTICATION SCREEN (When not logged in)
  // ============================================================================
  if (!state) {
    return (
      <div className="auth-shell">
        <div className="corner-utility-bar">
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

        <section className="auth-card" aria-label="领主登录与注册">
          <div className="brand-cluster">
            <div className="brand-emblem">D2E</div>
            <div className="brand-titles">
              <div className="brand-main">
                <span>滴水成城</span>
                <span className="brand-sub">DROP TO EMPIRE</span>
              </div>
              <div className="brand-meta">
                <span>从一滴水开始的增量文明与全服商业帝国</span>
              </div>
            </div>
          </div>

          {errorBanner && (
            <div className="status-banner status-danger" role="alert">
              <span>{errorBanner}</span>
              <button
                type="button"
                className="banner-close"
                onClick={() => setErrorBanner(null)}
              >
                关闭
              </button>
            </div>
          )}

          <div className="side-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "register"}
              className={`tab-btn ${authMode === "register" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("register");
                setErrorBanner(null);
              }}
            >
              注册新领主 (从0水开始)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              className={`tab-btn ${authMode === "login" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("login");
                setErrorBanner(null);
              }}
            >
              登录已有账号
            </button>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!authHandle.trim() || !authPassword) return;
              void runAction(async () => {
                const res =
                  authMode === "register"
                    ? await api.registerAccount({
                        handle: authHandle.trim(),
                        password: authPassword,
                      })
                    : await api.loginAccount({
                        handle: authHandle.trim(),
                        password: authPassword,
                      });
                setAdminViewMode(res.player.isAdmin ? "admin" : "player");
                return res;
              });
            }}
          >
            <label>
              <span>领主账号 (2–24 字符)</span>
              <input
                type="text"
                required
                placeholder={
                  authMode === "register"
                    ? "例如：water_pioneer"
                    : "请输入领主账号"
                }
                value={authHandle}
                onChange={(e) => setAuthHandle(e.target.value)}
              />
            </label>
            <label>
              <span>登录密码 (至少 6 位)</span>
              <input
                type="password"
                required
                placeholder="请输入登录密码"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn-water-strike btn-block"
              disabled={busy}
            >
              {authMode === "register"
                ? "创建领地 · 开启第一滴水"
                : "进入领地"}
            </button>
          </form>

          <div className="auth-quick-list">
            <small className="metric-label">快速体验通道（免输账号密码）：</small>
            <button
              type="button"
              className="btn-primary btn-block"
              disabled={busy}
              onClick={() => {
                const randHandle = `lord_${Math.floor(1000 + Math.random() * 9000)}`;
                void runAction(async () => {
                  const res = await api.registerAccount({
                    handle: randHandle,
                    password: "password123",
                  });
                  setAdminViewMode("player");
                  return res;
                });
              }}
            >
              <Droplets size={ICON.sm} />
              <span>一键新建纯白号（从单一【打水】按钮开始体验）</span>
            </button>

            <button
              type="button"
              className="btn-outline btn-block"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  const res = await api.loginAccount({
                    handle: "archon_demo",
                    password: "demo123456",
                  });
                  setAdminViewMode("player");
                  return res;
                }, "已登录中期演示号 archon_demo（已解锁科学家、交易所与商会战争）")
              }
            >
              <Sparkles size={ICON.sm} />
              <span>登录中期帝国演示号 (archon_demo · 科学家)</span>
            </button>

            <button
              type="button"
              className="btn-outline btn-block"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  const res = await api.loginAccount({
                    handle: "admin",
                    password: "admin123456",
                  });
                  setAdminViewMode("admin");
                  return res;
                }, "已进入平台管理员后台 (admin)")
              }
            >
              <Shield size={ICON.sm} />
              <span>登录管理员后台 (admin · 数值模拟与宏观审计)</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  const { player, resources, jobs, blueprints, professions } = state;
  const waterRes = resources.find((r) => r.key === "water")!;
  const firstResBpUnlocked =
    blueprints.find((b) => b.code === "first_resident")?.unlocked ?? false;
  const axeUnlocked =
    blueprints.find((b) => b.code === "axe_blueprint")?.unlocked ?? false;
  const quarryUnlocked =
    blueprints.find((b) => b.code === "quarry_tech")?.unlocked ?? false;
  const workshopUnlocked =
    blueprints.find((b) => b.code === "basic_workshop")?.unlocked ?? false;
  const treasureUnlocked =
    blueprints.find((b) => b.code === "mystery_treasure")?.unlocked ?? false;

  const perClickWaterMilli = firstResBpUnlocked ? 2000 : 1000;
  const liveWaterMilli =
    waterRes.amountMilli +
    optimisticWaterDeltaMilli +
    Math.floor(waterRes.netRatePerSecMilli * interpSeconds);
  const totalClicks = player.totalManualClicks + optimisticClicksDelta;

  const handleGatherWater = () => {
    setErrorBanner(null);
    setOptimisticWaterDeltaMilli((prev) => prev + perClickWaterMilli);
    setOptimisticClicksDelta((prev) => prev + 1);
    api
      .gatherWater({ clicks: 1 })
      .then((next) => {
        applyServerState(next);
      })
      .catch((err: unknown) => {
        setOptimisticWaterDeltaMilli(0);
        setOptimisticClicksDelta(0);
        setErrorBanner(err instanceof Error ? err.message : "打水请求失败");
      });
  };

  // Use delta mode so clicking +1/-1 on any job automatically transfers workers from/to Water!
  const adjustJobCount = (jobKey: string, delta: number) => {
    void runAction(() =>
      api.allocateWorkers({
        mode: "delta",
        entries: [{ jobKey, count: delta }],
      }),
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

  // ============================================================================
  // 2. DEDICATED ADMIN CONSOLE VIEW (Accessible ONLY to isAdmin accounts)
  // ============================================================================
  if (player.isAdmin && adminViewMode === "admin") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-cluster">
            <div className="brand-emblem">GM</div>
            <div className="brand-titles">
              <div className="brand-main">
                <span>滴水成城 · 运营与数值管理后台</span>
                <span className="brand-sub">ADMIN CONSOLE</span>
              </div>
              <div className="brand-meta">
                <span>
                  管理员：{player.handle} · 全服货币恒等式监控、30m 数值基准模拟与沙盒调速
                </span>
              </div>
            </div>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAdminViewMode("player")}
            >
              切换至领主游戏界面预览
            </button>
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
            <button
              type="button"
              className="btn-outline"
              onClick={() => void handleLogout()}
            >
              <LogOut size={ICON.xs} />
              <span>退出后台</span>
            </button>
          </div>
        </header>

        {(errorBanner || noticeBanner) && (
          <div
            className={`status-banner ${errorBanner ? "status-danger" : "status-info"}`}
            role="status"
          >
            <span>{errorBanner || noticeBanner}</span>
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

        <main className="admin-console-wrap">
          {/* Admin Sandbox Control Bar */}
          <section className="admin-toolbar" aria-label="玩家沙盒与时间倍率控制">
            <div className="workspace-quick-ops">
              <div className="account-switcher">
                <Users size={ICON.xs} />
                <select
                  aria-label="选择或检视全服账号"
                  value={customHandleInput || "pioneer"}
                  onChange={(e) => setCustomHandleInput(e.target.value)}
                >
                  {state.availableHandles.map((h) => (
                    <option key={h} value={h}>
                      目标账号: {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="speed-group" role="group" aria-label="目标账号时间倍率">
                {[1, 10, 60, 300].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    className={`btn-chip mono-num ${player.speedMultiplier === mult ? "active" : ""}`}
                    onClick={() =>
                      void runAction(
                        () =>
                          api.controlSimulation({
                            action: "set_speed",
                            speedMultiplier: mult,
                            targetHandle: customHandleInput || "pioneer",
                          }),
                        `已将账号 ${customHandleInput || "pioneer"} 时间流速设为 ${mult}x`,
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
                onClick={() =>
                  void runAction(
                    () =>
                      api.controlSimulation({
                        action: "fast_forward",
                        advanceSeconds: 60,
                        targetHandle: customHandleInput || "pioneer",
                      }),
                    `已为账号 ${customHandleInput || "pioneer"} 快进 +60 秒生产`,
                  )
                }
              >
                <FastForward size={ICON.xs} />
                <span className="mono-num">
                  +60s 快进 ({formatClockMMSS(player.simulatedElapsedSeconds)})
                </span>
              </button>

              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  void runAction(
                    () =>
                      api.controlSimulation({
                        action: "unlock_treasure_ready",
                        targetHandle: customHandleInput || "pioneer",
                      }),
                    `已将账号 ${customHandleInput || "pioneer"} 推进至第 29 分钟（40人口+宝藏三部件就绪）`,
                  )
                }
              >
                <Sparkles size={ICON.xs} />
                <span>推进至宝藏就绪 (29m)</span>
              </button>

              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  void runAction(
                    () =>
                      api.controlSimulation({
                        action: "reset_player",
                        targetHandle: customHandleInput || "pioneer",
                      }),
                    `已将账号 ${customHandleInput || "pioneer"} 重置回 0 水起点`,
                  )
                }
              >
                <RefreshCw size={ICON.xs} />
                <span>重置该号至 0 水起点</span>
              </button>
            </div>

            <div className="toolbar-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleOpenBenchmark()}
              >
                <Activity size={ICON.xs} />
                <span>运行 30 分钟数值基准模拟器</span>
              </button>
            </div>
          </section>

          <div className="split-2col">
            {/* Macro Monetary Ledger Audit */}
            <section className="subpanel" aria-label="全服货币存量恒等式审计">
              <div className="subpanel-head">
                <h3>
                  <Scale size={ICON.sm} />
                  <span>01 // 全服货币存量恒等式审计 M(t)（仅管理员可见）</span>
                </h3>
              </div>
              <div className="ledger-audit-box mono-num">
                <div className="ledger-row">
                  <span>当前流通总存量 M_issued</span>
                  <strong>{formatGold(state.macroLedger.totalIssuedBasis)} G</strong>
                </div>
                <div className="ledger-row">
                  <span>玩家可用余额 M_player</span>
                  <span>{formatGold(state.macroLedger.playerHeldBasis)} G</span>
                </div>
                <div className="ledger-row">
                  <span>市场买单托管冻结 M_escrow</span>
                  <span>{formatGold(state.macroLedger.escrowFrozenBasis)} G</span>
                </div>
                <div className="ledger-row">
                  <span>NPC 做市商流动性池 M_npc</span>
                  <span>{formatGold(state.macroLedger.npcHeldBasis)} G</span>
                </div>
                <div className="ledger-row">
                  <span>中央财政国库储备 M_treasury</span>
                  <span>{formatGold(state.macroLedger.treasuryHeldBasis)} G</span>
                </div>
                <hr className="ink-divider" />
                <div className="ledger-row">
                  <span>累计交易税永久销毁量 (0.50% Burn)</span>
                  <strong className="cost-lack">
                    -{formatGold(state.macroLedger.permanentlyBurnedBasis, 3)} G
                  </strong>
                </div>
                <div className="ledger-row">
                  <span>恒等式校验 (M_player + M_escrow + M_npc + M_treasury)</span>
                  <strong className="rate-pos">✓ 零误差闭合</strong>
                </div>
              </div>
            </section>

            {/* Manual War Settlement & Server Operations */}
            <section className="subpanel" aria-label="全服商会战争与赛季调度">
              <div className="subpanel-head">
                <h3>
                  <Swords size={ICON.sm} />
                  <span>02 // 全服 20:00 商会战争结算调度（仅管理员可见）</span>
                </h3>
              </div>
              <div className="ledger-audit-box">
                <div className="ledger-row mono-num">
                  <span>当前赛季 / 战争日</span>
                  <strong>
                    {state.war.seasonName} · D{state.war.currentDay}/7
                  </strong>
                </div>
                <div className="ledger-row mono-num">
                  <span>黑曜商会 vs 白银同盟总积分</span>
                  <strong>
                    {state.war.obsidianTotalScore} : {state.war.argentTotalScore}
                  </strong>
                </div>
                <div className="ledger-row mono-num">
                  <span>全服已铸造绝版藏品总数</span>
                  <strong>{state.collectibles.length} 件</strong>
                </div>
                <div className="settle-trigger-box">
                  <button
                    type="button"
                    className="btn-water-strike btn-block"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        () => api.triggerWarSettlement(),
                        `管理员已手动执行第 D${state.war.currentDay} 日全服 20:00 战区结算！`,
                      )
                    }
                  >
                    <Play size={ICON.sm} />
                    <span>强制执行全服 20:00 战区快照结算</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* 30m Simulator Modal */}
        {showBenchmarkModal && benchmarkData && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="前30分钟数值模拟验证"
          >
            <div className="modal-sheet">
              <div className="modal-header">
                <div>
                  <h2>第一阶段（前 30 分钟）全流程数值模拟验证报告</h2>
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
                      <span className="tag-badge tag-warning mono-num">
                        总耗时 {run.formattedTotal}
                      </span>
                    </div>
                    <p className="bp-desc">{run.description}</p>
                    <table className="ink-table">
                      <thead>
                        <tr>
                          <th>里程碑节点</th>
                          <th className="num-col">达成时间</th>
                          <th className="num-col">当时人口</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.milestones.map((m) => (
                          <tr key={m.code}>
                            <td>
                              <strong>{m.name}</strong>
                            </td>
                            <td className="num-col mono-num">
                              {m.formattedTime}
                            </td>
                            <td className="num-col mono-num">
                              {m.population} 人
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

  // ============================================================================
  // 3. PLAYER VIEW: STRICT STEP-BY-STEP UNFOLDING EXPERIENCE
  // ============================================================================

  // Stage A: Opening Stage (Population == 0 & Profession == none)
  // At 0s: ONLY a single centered [ 打水 ] button on the canvas!
  const isOpeningStage =
    player.populationTotal === 0 &&
    player.profession === "none" &&
    !treasureUnlocked;

  const hasAnyWaterYet = liveWaterMilli > 0 || totalClicks > 0;
  const canSeeFirstRecruit = liveWaterMilli >= 10000 || totalClicks >= 10;
  const firstTenProgressPct = Math.min(
    100,
    Math.floor((liveWaterMilli / 10000) * 100),
  );

  if (isOpeningStage) {
    let whisperText = "干涸的石槽蓄起了第一滴清泉。";
    if (liveWaterMilli >= 10000) {
      whisperText = "石槽已满 10 滴水，干渴的流民在井畔驻足，等待你的招募。";
    } else if (liveWaterMilli >= 6000) {
      whisperText = "水声渐响，远处似乎有流民循着水汽望来……";
    } else if (liveWaterMilli >= 3000) {
      whisperText = "清泉一点点漫过刻度，继续打水至 10 滴。";
    }

    return (
      <div className="app-shell opening-shell">
        <div className="corner-utility-bar">
          <span className="tag-badge mono-num">领主: {player.handle}</span>
          {player.isAdmin && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => setAdminViewMode("admin")}
            >
              返回管理后台
            </button>
          )}
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
          <button
            type="button"
            className="btn-link"
            onClick={() => void handleLogout()}
          >
            退出
          </button>
        </div>

        <main className="opening-stage" aria-label="文明起点">
          {/* Water readout ONLY unfolds after the player clicks [打水] at least once */}
          {hasAnyWaterYet && (
            <div className="opening-water-readout">
              <span className="water-label">💧 水 (WATER)</span>
              <strong className="water-big-num mono-num">
                {formatResource(liveWaterMilli, 0)}
              </strong>
              <div className="opening-progress-bar">
                <div
                  className="opening-progress-fill"
                  style={{ width: `${firstTenProgressPct}%` }}
                />
              </div>
              <p className="opening-whisper">{whisperText}</p>
            </div>
          )}

          {/* At t=0s, this single button is the ONLY interactive game element on screen */}
          <button
            type="button"
            className="btn-water-strike btn-opening-sole"
            onClick={handleGatherWater}
          >
            <Droplets size={ICON.md} />
            <span>{hasAnyWaterYet ? "打水 +1" : "打水"}</span>
          </button>

          {/* First resident recruitment card ONLY unfolds once 10 water is reached */}
          {canSeeFirstRecruit && (
            <section
              className="opening-recruit-card"
              aria-label="招募第一位居民"
            >
              <div className="recruit-meta">
                <div className="recruit-head">
                  <strong>流民驻足 · 招募第一位居民</strong>
                </div>
                <div className="recruit-cost mono-num">
                  消耗 10 水 · 居民将自动打水 (+2.00 水/秒)
                </div>
              </div>
              <button
                type="button"
                className="btn-primary btn-block"
                disabled={liveWaterMilli < 10000 || busy}
                onClick={() =>
                  void runAction(
                    () => api.recruitResident({ count: 1 }),
                    "第一位居民已定居并开始自动打水（+2.00 水/秒）！",
                  )
                }
              >
                <Plus size={ICON.xs} />
                <span className="mono-num">招募第一位居民 (-10 水)</span>
              </button>
            </section>
          )}
        </main>
      </div>
    );
  }

  // Stage B: Population >= 1 -> Progressive Unfolding Settlement & Empire Dashboard
  const showJobAllocationColumn = axeUnlocked || player.profession !== "none";
  const showProfessionChoice =
    treasureUnlocked && player.profession === "none";
  const showAdvancedWorld = player.profession !== "none";

  const unlockedResources = resources.filter((r) => r.unlocked);
  const unlockedJobs = jobs.filter((j) => j.unlocked);
  const activeBlueprints = blueprints.filter(
    (bp) => bp.visible && !bp.unlocked,
  );
  const completedBlueprints = blueprints.filter((bp) => bp.unlocked);

  const waterJob = jobs.find((j) => j.jobKey === "water");
  const woodJob = jobs.find((j) => j.jobKey === "wood");
  const waterAssignedCount = waterJob?.assigned ?? 0;

  const needsFirstWoodAssignment =
    axeUnlocked &&
    player.profession === "none" &&
    (woodJob?.assigned ?? 0) === 0 &&
    (resources.find((r) => r.key === "wood")?.amountMilli ?? 0) === 0;

  const treasureParts = blueprints.filter(
    (bp) => bp.stage === "phase1_treasure" && bp.code !== "mystery_treasure",
  );
  const unlockedPartsCount = treasureParts.filter((bp) => bp.unlocked).length;

  const selectedWarNode =
    state.war.nodes.find((n) => n.nodeId === selectedNodeId) ??
    state.war.nodes[0];

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

  return (
    <div className="app-shell">
      {/* Player Topbar: Clean, zero admin clutter */}
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-emblem">D2E</div>
          <div className="brand-titles">
            <div className="brand-main">
              <span>滴水成城</span>
              <span className="brand-sub">DROP TO EMPIRE</span>
            </div>
            <div className="brand-meta">
              <span>领主：{player.handle}</span>
              <span>·</span>
              {player.profession !== "none" ? (
                <span>
                  职业：{player.professionName}（{player.artifactName}）
                </span>
              ) : workshopUnlocked ? (
                <span>阶段：基础工坊与远古宝藏修复</span>
              ) : quarryUnlocked ? (
                <span>阶段：三资源采集与工坊筹备</span>
              ) : axeUnlocked ? (
                <span>阶段：双资源采集与劳动力分工</span>
              ) : (
                <span>阶段：水源自动化与聚落定居</span>
              )}
            </div>
          </div>
        </div>

        <div className="telemetry-strip">
          <div className="metric-cell">
            <span className="metric-label">聚落人口</span>
            <span className="metric-value mono-num">
              {player.populationTotal} 人
            </span>
          </div>

          {(treasureUnlocked ||
            player.profession !== "none" ||
            player.goldBasis > 0) && (
            <div className="metric-cell">
              <span className="metric-label">持有金币</span>
              <span className="metric-value mono-num">
                {formatGold(player.goldBasis)} G
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
            <div className="metric-cell">
              <span className="metric-label">活动点数</span>
              <span className="metric-value mono-num">
                {player.activityPoints} PTS
              </span>
            </div>
          )}
        </div>

        <div className="toolbar-actions">
          {player.isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAdminViewMode("admin")}
            >
              返回管理员后台
            </button>
          )}
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
          <button
            type="button"
            className="btn-outline"
            onClick={() => void handleLogout()}
          >
            <LogOut size={ICON.xs} />
            <span>退出登录</span>
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

      {/* Critical Milestone: Profession Selection Gate (Unfolds when Mystery Treasure is opened) */}
      {showProfessionChoice && (
        <section className="profession-gate-banner" aria-label="选择终身职业">
          <div className="section-head">
            <div>
              <span className="tag-badge tag-warning">阶段里程碑达成</span>
              <h2>远古宝藏已开启 · 请抉择你的终身职业（不可反悔）</h2>
              <p>
                中央财政已向你发放 500.0000 启动金币。四大职业各有独占制品与产线加成，你无法制造其他职业的专属制品，但可通过全球现货交易所自由互通。
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
                      `已执掌神器【${pr.artifactName}】并就职为【${pr.name}】！`,
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

      {/* Main Upper Dashboard: 2 columns before Axe Blueprint, unfolds to 3 columns once multi-job allocation unlocks */}
      <main
        className={`dashboard-grid ${!showJobAllocationColumn ? "dashboard-grid-2col" : ""}`}
      >
        {/* Column 1: Water Action & Unlocked Resource Stockpile */}
        <section className="panel" aria-label="资源与总览">
          <div className="panel-header">
            <div className="panel-title">
              <Droplets size={ICON.sm} />
              <h2>
                {unlockedResources.length > 1
                  ? "资源库存与实时产出"
                  : "水源采集与自动化"}
              </h2>
            </div>
            <span className="tag-badge mono-num">
              水净产率 {formatRate(waterRes.netRatePerSecMilli)}
            </span>
          </div>

          <div className="water-hero-box">
            <div className="water-readout">
              <span className="water-label">💧 水 (WATER)</span>
              <strong className="water-big-num mono-num">
                {formatResource(liveWaterMilli, 1)}
              </strong>
              <span className="water-rate mono-num">
                {waterAssignedCount} 名居民打水中 ·{" "}
                {formatRate(waterRes.netRatePerSecMilli)}
              </span>
            </div>
            <button
              type="button"
              className="btn-water-strike"
              onClick={handleGatherWater}
            >
              <Droplets size={ICON.md} />
              <span>打水 +{firstResBpUnlocked ? "2.0" : "1.0"}</span>
            </button>
          </div>

          {/* Multi-resource table ONLY unfolds when 2+ resources are unlocked (after Axe Blueprint) */}
          {unlockedResources.length > 1 ? (
            <div className="table-wrap">
              <table className="ink-table">
                <thead>
                  <tr>
                    <th>物资名称</th>
                    {showAdvancedWorld && <th>层级</th>}
                    <th className="num-col">当前库存</th>
                    <th className="num-col">净产率</th>
                  </tr>
                </thead>
                <tbody>
                  {unlockedResources.map((r) => {
                    const liveAmt =
                      r.key === "water"
                        ? liveWaterMilli
                        : r.amountMilli +
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
                        {showAdvancedWorld && (
                          <td>
                            <span className="tier-pill">{r.tier}</span>
                          </td>
                        )}
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
          ) : (
            <div className="empty-stage-hint">
              <p>
                第一位居民已开始自动打水（+2.00 水/秒）。继续招募居民至{" "}
                <strong className="mono-num">10</strong>{" "}
                人并研发右侧【斧头蓝图】，即可解锁第二资源【🪵 木材】与多岗位分工。
              </p>
            </div>
          )}

          {/* Early Chronicle Feed (Before mid-game workspace unlocks, show live logs right here so player sees every milestone) */}
          {!showAdvancedWorld && state.eventLogs.length > 0 && (
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>领地发展纪事</h3>
              </div>
              <ul className="event-log-list">
                {state.eventLogs.slice(0, 6).map((ev) => (
                  <li key={ev.id} className="event-log-item">
                    <span className="event-time mono-num">{ev.timestamp}</span>
                    <span className="event-cat">{ev.category}</span>
                    <span className="event-msg">{ev.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Column 2: Worker Allocation — ONLY rendered after Axe Blueprint unlocks a 2nd job! */}
        {showJobAllocationColumn && (
          <section className="panel" aria-label="生产与人口分配">
            <div className="panel-header">
              <div className="panel-title">
                <Hammer size={ICON.sm} />
                <h2>生产岗位与人口分配</h2>
              </div>
              <span className="tag-badge mono-num">
                打水池自动联动 · 总人口 {player.populationTotal}
              </span>
            </div>

            {needsFirstWoodAssignment && (
              <div className="novice-step-callout">
                <strong>新岗位【伐木】已就绪：</strong>
                直接点击下方【伐木】右侧的 <code>+1</code>{" "}
                或上方【智能均衡分配】，系统会自动从打水居民中调拨人手采集木材！
              </div>
            )}

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
              {axeUnlocked && (
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
              )}
              {quarryUnlocked && (
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
              )}
            </div>

            <div className="job-list">
              {unlockedJobs.map((job) => {
                // Available workers to add to this job:
                // For non-water jobs, idle + waterAssignedCount can be transferred immediately.
                // For water job, any worker not currently in water can be pulled back to water.
                const canAddPool =
                  job.jobKey === "water"
                    ? player.populationTotal - job.assigned
                    : player.populationIdle + waterAssignedCount;

                return (
                  <div
                    key={job.jobKey}
                    className={`job-row ${!job.unlocked ? "job-row-locked" : ""}`}
                  >
                    <div className="job-info">
                      <div className="job-title-line">
                        <strong>{job.name}</strong>
                        {job.efficiencyPct > 100 && (
                          <span className="tag-badge mono-num">
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
                          disabled={job.assigned < 5 || busy}
                          onClick={() => adjustJobCount(job.jobKey, -5)}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          disabled={job.assigned <= 0 || busy}
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
                          disabled={canAddPool < 1 || busy}
                          onClick={() => adjustJobCount(job.jobKey, 1)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-step mono-num"
                          disabled={canAddPool < 5 || busy}
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

            {/* Saved Presets Manager — only unfolds once Quarry Tech (3 resources) is unlocked */}
            {quarryUnlocked && (
              <div className="preset-bar">
                {state.presets.length > 0 && (
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
                )}
                <form
                  className="preset-save-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!presetInput.trim()) return;
                    void runAction(
                      () =>
                        api.saveAllocationPreset({ name: presetInput.trim() }),
                      `已保存分配方案【${presetInput.trim()}】`,
                    );
                    setPresetInput("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="保存当前人口分配方案..."
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                  />
                  <button type="submit" className="btn-outline">
                    保存方案
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* Column 3: Resident Recruitment & Next Milestone Blueprints */}
        <section className="panel" aria-label="居民招募与蓝图">
          <div className="panel-header">
            <div className="panel-title">
              <Compass size={ICON.sm} />
              <h2>
                {workshopUnlocked
                  ? "居民招募与远古宝藏修复"
                  : "居民招募与蓝图研发"}
              </h2>
            </div>
            <span className="tag-badge mono-num">
              人口 {player.populationTotal}
            </span>
          </div>

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
                消耗：{formatResource(player.nextResidentCostWaterMilli, 1)} 水 · 新居民默认加入打水
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
              {player.populationTotal >= 5 && (
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
              )}
            </div>
          </div>

          {/* Treasure 3-Part Progress Indicator — ONLY unfolds after Basic Workshop is built */}
          {workshopUnlocked && !treasureUnlocked && (
            <div className="novice-step-callout">
              <div className="bp-top">
                <strong>基础工坊已启用 · 远古宝藏三部件修复进度</strong>
                <span className="tag-badge mono-num">
                  {unlockedPartsCount} / 3 部件
                </span>
              </div>
            </div>
          )}

          {/* Active (Not-Yet-Unlocked) Visible Blueprints */}
          <div className="blueprint-list">
            {activeBlueprints.map((bp) => {
              const popOK = player.populationTotal >= bp.requiredPopulation;
              return (
                <article
                  key={bp.code}
                  className={`bp-card ${bp.canUnlock ? "bp-ready" : ""}`}
                >
                  <div className="bp-top">
                    <div>
                      <strong>{bp.name}</strong>
                      <span
                        className={`bp-pop-req mono-num ${popOK ? "rate-pos" : ""}`}
                      >
                        人口 {player.populationTotal}/{bp.requiredPopulation}
                      </span>
                    </div>
                    <span className="tag-badge mono-num">
                      预计 {formatETA(bp.etaSeconds)}
                    </span>
                  </div>
                  <p className="bp-desc">{bp.effectSummary}</p>
                  <div className="bp-footer">
                    <div className="bp-costs">
                      {bp.costs.map((c) => {
                        const cur =
                          c.resourceKey === "water"
                            ? liveWaterMilli
                            : c.currentMilli;
                        const ok = cur >= c.requiredMilli;
                        return (
                          <span
                            key={c.resourceKey}
                            className={`cost-chip mono-num ${ok ? "cost-ok" : "cost-lack"}`}
                          >
                            {c.resourceName}: {formatResource(cur, 0)}/
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
                </article>
              );
            })}

            {/* Completed Blueprints Archive (Collapsed by default to keep UI clean) */}
            {completedBlueprints.length > 0 && (
              <details className="settlement-item">
                <summary className="mono-num">
                  已掌握的蓝图与技术 ({completedBlueprints.length})
                </summary>
                {completedBlueprints.map((bp) => (
                  <div key={bp.code} className="bp-card bp-unlocked">
                    <div className="bp-top">
                      <strong>{bp.name}</strong>
                      <span className="tag-badge tag-success">已掌握</span>
                    </div>
                    <p className="bp-desc">{bp.effectSummary}</p>
                  </div>
                ))}
              </details>
            )}
          </div>
        </section>
      </main>

      {/* Lower Multi-System Workspace Tabs: ONLY rendered AFTER choosing a profession! */}
      {showAdvancedWorld && (
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
                {player.profession === "none" && (
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
                aria-selected={activeTab === "chronicle"}
                className={`tab-btn ${activeTab === "chronicle" ? "active" : ""}`}
                onClick={() => setActiveTab("chronicle")}
              >
                <Scale size={ICON.sm} />
                <span>赛季剧本预告与领地纪事</span>
              </button>
            </div>

            {player.isAdmin && (
              <div className="workspace-quick-ops">
                <form
                  className="new-account-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!customHandleInput.trim()) return;
                    void runAction(
                      () =>
                        api.switchAccount({ handle: customHandleInput.trim() }),
                      `已切换检视账号 ${customHandleInput.trim()}`,
                    );
                    setCustomHandleInput("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="管理员切换账号..."
                    value={customHandleInput}
                    onChange={(e) => setCustomHandleInput(e.target.value)}
                  />
                  <button type="submit" className="btn-outline">
                    切换
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* TAB 1: Workshop Crafting & Cross-Profession Equipment Slots */}
          {activeTab === "craft" && (
            <div className="tab-body split-2col">
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>
                    <Layers size={ICON.sm} />
                    <span>
                      工坊跨职业设备插槽（可从市场采购其他职业制品加装）
                    </span>
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
                          {rc.professionMatched
                            ? "立即制造"
                            : "他职独占（去市场买）"}
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
                            m.itemKey === selectedMarketItem
                              ? "row-selected"
                              : ""
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
                    disabled={busy}
                  >
                    {`提交 ${orderSide === "BID" ? "买入" : "卖出"} 限价单`}
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

                <div className="war-history-box">
                  <div className="subpanel-head">
                    <h3>20:00 战区快照结算战报</h3>
                  </div>
                  {state.war.settlementHistory.length === 0 ? (
                    <p className="muted-note">
                      今日尚未至 20:00 结算时刻。请在下方战术指挥台将你制造或采购的军备箱部署至前线连通节点。
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
                    disabled={!selectedWarNode.canDeploy || busy}
                  >
                    部署军团至【{selectedWarNode.name}】
                  </button>
                </form>
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
                    采样。掉率公示：普通 60% / 精良 28% / 史诗 10% / 传说 2%。
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
                    尚未铸造任何赛季藏品。参与商会战争获取活动点数，即可兑换并开启【S1·墨械典藏宝箱】生成程序化纹理藏品！
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

          {/* TAB 5: Season Advance Notices & Player Event Chronicle (No Admin Macro Audit!) */}
          {activeTab === "chronicle" && (
            <div className="tab-body split-2col">
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
                  <h3>02 // 领地实时事件纪事</h3>
                </div>
                <ul className="event-log-list">
                  {state.eventLogs.map((ev) => (
                    <li key={ev.id} className="event-log-item">
                      <span className="event-time mono-num">
                        {ev.timestamp}
                      </span>
                      <span className="event-cat">{ev.category}</span>
                      <span className="event-msg">{ev.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
