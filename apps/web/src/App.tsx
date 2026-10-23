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

export function App() {
  const isAdminRoute = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin") ||
        window.location.hash.startsWith("#/admin")),
    [],
  );

  const [state, setState] = useState<DashboardStateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [activeTab, setActiveTab] = useState<BottomTab>("craft");
  const [presetInput, setPresetInput] = useState("");
  const [customHandleInput, setCustomHandleInput] = useState("pioneer");

  // Authentication form state
  const initialInviteCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search).get("invite")?.trim() ?? ""
    );
  }, []);
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    initialInviteCode ? "register" : "login",
  );
  const [authHandle, setAuthHandle] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState(initialInviteCode);

  // In-flight water clicks & tactile burst particles (monotonic, zero flicker)
  const [inFlightClicks, setInFlightClicks] = useState(0);
  const [waterBursts, setWaterBursts] = useState<
    Array<{ id: number; label: string }>
  >([]);

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

  // 30m simulator benchmark modal (Admin route only)
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
    if (!api.getSessionToken()) {
      setLoading(false);
      return;
    }
    api
      .getDashboard()
      .then((res) => {
        if (!active) return;
        applyServerState(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          api.setSessionToken(null);
          setState(null);
        } else {
          setErrorBanner(err instanceof Error ? err.message : "加载失败");
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasActivePopulation = (state?.player.populationTotal ?? 0) > 0;
  const activeHandle = state?.player.handle ?? "";

  useEffect(() => {
    if (!state || !hasActivePopulation) return;
    const timer = window.setInterval(() => {
      api
        .getDashboard()
        .then((res) => {
          applyServerState(res);
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state, hasActivePopulation, activeHandle]);

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
        setErrorBanner("操作未完成");
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
          <span className="mono-num">滴水成城</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ISOLATED ADMIN ROUTE (/admin) — Never shown on normal player route (/)
  // ============================================================================
  if (isAdminRoute) {
    if (!state || !state.player.isAdmin) {
      return (
        <div className="auth-shell">
          <section className="auth-card" aria-label="管理员登录">
            <div className="brand-cluster">
              <div className="brand-emblem">GM</div>
              <div className="brand-titles">
                <div className="brand-main">
                  <span>后台登录</span>
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
                  ×
                </button>
              </div>
            )}

            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!authHandle.trim() || !authPassword) return;
                void runAction(() =>
                  api.loginAccount({
                    handle: authHandle.trim(),
                    password: authPassword,
                  }),
                );
              }}
            >
              <label>
                <span>管理员账号</span>
                <input
                  type="text"
                  required
                  value={authHandle}
                  onChange={(e) => setAuthHandle(e.target.value)}
                />
              </label>
              <label>
                <span>密码</span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={busy}
              >
                登录后台
              </button>
            </form>
          </section>
        </div>
      );
    }

    const handleOpenBenchmark = async () => {
      setErrorBanner(null);
      try {
        const res = await api.runBenchmark30m();
        setBenchmarkData(res);
        setShowBenchmarkModal(true);
      } catch (err: unknown) {
        setErrorBanner(err instanceof Error ? err.message : "模拟失败");
      }
    };

    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-cluster">
            <div className="brand-emblem">GM</div>
            <div className="brand-titles">
              <div className="brand-main">
                <span>管理后台</span>
                <span className="brand-sub">ADMIN</span>
              </div>
            </div>
          </div>

          <div className="toolbar-actions">
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
              className="btn-outline"
              onClick={() => void handleLogout()}
            >
              <LogOut size={ICON.xs} />
              <span>退出</span>
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
              ×
            </button>
          </div>
        )}

        <main className="admin-console-wrap">
          <section className="admin-toolbar" aria-label="沙盒控制">
            <div className="workspace-quick-ops">
              <div className="account-switcher">
                <Users size={ICON.xs} />
                <select
                  aria-label="目标账号"
                  value={customHandleInput}
                  onChange={(e) => setCustomHandleInput(e.target.value)}
                >
                  {state.availableHandles.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <form
                className="new-account-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customHandleInput.trim()) return;
                  void runAction(() =>
                    api.switchAccount({ handle: customHandleInput.trim() }),
                  );
                }}
              >
                <input
                  type="text"
                  placeholder="账号名..."
                  value={customHandleInput}
                  onChange={(e) => setCustomHandleInput(e.target.value)}
                />
                <button type="submit" className="btn-outline">
                  切换
                </button>
              </form>

              <div className="speed-group" role="group" aria-label="倍速">
                {[1, 10, 60, 300].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    className={`btn-chip mono-num ${state.player.speedMultiplier === mult ? "active" : ""}`}
                    onClick={() =>
                      void runAction(() =>
                        api.controlSimulation({
                          action: "set_speed",
                          speedMultiplier: mult,
                          targetHandle: customHandleInput,
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
                onClick={() =>
                  void runAction(() =>
                    api.controlSimulation({
                      action: "fast_forward",
                      advanceSeconds: 60,
                      targetHandle: customHandleInput,
                    }),
                  )
                }
              >
                <FastForward size={ICON.xs} />
                <span className="mono-num">
                  +60s ({formatClockMMSS(state.player.simulatedElapsedSeconds)})
                </span>
              </button>

              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  void runAction(() =>
                    api.controlSimulation({
                      action: "unlock_treasure_ready",
                      targetHandle: customHandleInput,
                    }),
                  )
                }
              >
                <Sparkles size={ICON.xs} />
                <span>直达宝藏</span>
              </button>

              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  void runAction(() =>
                    api.controlSimulation({
                      action: "reset_player",
                      targetHandle: customHandleInput,
                    }),
                  )
                }
              >
                <RefreshCw size={ICON.xs} />
                <span>重置账号</span>
              </button>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleOpenBenchmark()}
            >
              <Activity size={ICON.xs} />
              <span>30m 数值模拟</span>
            </button>
          </section>

          <section className="subpanel" aria-label="邀请码管理">
            <div className="subpanel-head">
              <h3>
                <UserCheck size={ICON.sm} />
                <span>注册邀请码（一码一用 · 7 天有效）</span>
              </h3>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => api.createInvite(),
                    "已生成新邀请码（仅展示一次，请立即复制）",
                  )
                }
              >
                <Plus size={ICON.xs} />
                <span>生成邀请码</span>
              </button>
            </div>

            {state.createdInviteCode && (
              <div className="status-banner status-info">
                <span>
                  新生成邀请码：
                  <strong className="mono-num">
                    {" "}
                    {state.createdInviteCode}
                  </strong>
                </span>
              </div>
            )}

            <div className="table-scroll">
              <table className="ink-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>掩码</th>
                    <th>状态</th>
                    <th>使用者</th>
                    <th>过期时间</th>
                    <th className="num-col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.invites ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        暂无邀请码，点击右上角生成
                      </td>
                    </tr>
                  ) : (
                    (state.invites ?? []).map((inv) => {
                      const isUsed = Boolean(inv.usedAt);
                      const isRevoked = Boolean(inv.revokedAt);
                      return (
                        <tr key={inv.id}>
                          <td className="mono-num">{inv.id}</td>
                          <td className="mono-num">{inv.codePreview}</td>
                          <td>
                            <span
                              className={`tag-badge ${
                                isUsed
                                  ? "tag-success"
                                  : isRevoked
                                    ? "tag-warning"
                                    : ""
                              }`}
                            >
                              {isUsed
                                ? "已使用"
                                : isRevoked
                                  ? "已吊销"
                                  : "可使用"}
                            </span>
                          </td>
                          <td className="mono-num">{inv.usedBy ?? "-"}</td>
                          <td className="mono-num">
                            {inv.expiresAt.slice(0, 10)}
                          </td>
                          <td className="num-col">
                            {!isUsed && !isRevoked ? (
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(() =>
                                    api.revokeInvite(inv.id),
                                  )
                                }
                              >
                                吊销
                              </button>
                            ) : (
                              <span className="mono-num">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="split-2col">
            <section className="subpanel" aria-label="货币审计">
              <div className="subpanel-head">
                <h3>
                  <Scale size={ICON.sm} />
                  <span>货币存量 M(t)</span>
                </h3>
              </div>
              <div className="ledger-audit-box mono-num">
                <div className="ledger-row">
                  <span>发行总量 M_issued</span>
                  <strong>
                    {formatGold(state.macroLedger.totalIssuedBasis)} G
                  </strong>
                </div>
                <div className="ledger-row">
                  <span>玩家持有 M_player</span>
                  <span>{formatGold(state.macroLedger.playerHeldBasis)} G</span>
                </div>
                <div className="ledger-row">
                  <span>挂单冻结 M_escrow</span>
                  <span>
                    {formatGold(state.macroLedger.escrowFrozenBasis)} G
                  </span>
                </div>
                <div className="ledger-row">
                  <span>做市商池 M_npc</span>
                  <span>{formatGold(state.macroLedger.npcHeldBasis)} G</span>
                </div>
                <div className="ledger-row">
                  <span>中央国库 M_treasury</span>
                  <span>
                    {formatGold(state.macroLedger.treasuryHeldBasis)} G
                  </span>
                </div>
                <hr className="ink-divider" />
                <div className="ledger-row">
                  <span>累计销毁税</span>
                  <strong className="cost-lack">
                    -{formatGold(state.macroLedger.permanentlyBurnedBasis, 3)} G
                  </strong>
                </div>
              </div>
            </section>

            <section className="subpanel" aria-label="战争结算">
              <div className="subpanel-head">
                <h3>
                  <Swords size={ICON.sm} />
                  <span>商会战争结算</span>
                </h3>
              </div>
              <div className="ledger-audit-box">
                <div className="ledger-row mono-num">
                  <span>当前进度</span>
                  <strong>D{state.war.currentDay} / 7</strong>
                </div>
                <div className="ledger-row mono-num">
                  <span>黑曜 : 白银</span>
                  <strong>
                    {state.war.obsidianTotalScore} :{" "}
                    {state.war.argentTotalScore}
                  </strong>
                </div>
                <div className="settle-trigger-box">
                  <button
                    type="button"
                    className="btn-water-strike btn-block"
                    disabled={busy}
                    onClick={() =>
                      void runAction(() => api.triggerWarSettlement())
                    }
                  >
                    <Play size={ICON.sm} />
                    <span>执行 20:00 结算</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>

        {showBenchmarkModal && benchmarkData && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-sheet">
              <div className="modal-header">
                <div>
                  <h2>30m 数值模拟</h2>
                  <p>{benchmarkData.note}</p>
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowBenchmarkModal(false)}
                >
                  关闭
                </button>
              </div>
              <div className="benchmark-grid">
                {benchmarkData.runs.map((run) => (
                  <div key={run.strategyCode} className="benchmark-col">
                    <div className="benchmark-col-head">
                      <h3>{run.strategyName}</h3>
                      <span className="tag-badge tag-warning mono-num">
                        {run.formattedTotal}
                      </span>
                    </div>
                    <p className="bp-desc">{run.description}</p>
                    <table className="ink-table">
                      <thead>
                        <tr>
                          <th>节点</th>
                          <th className="num-col">时间</th>
                          <th className="num-col">人口</th>
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
                            <td className="num-col mono-num">{m.population}</td>
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
  // PLAYER AUTHENTICATION SCREEN (/) — Clean, zero admin or demo clutter
  // ============================================================================
  if (!state) {
    return (
      <div className="auth-shell">
        <div className="corner-utility-bar">
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
        </div>

        <section className="auth-card" aria-label="登录或注册">
          <div className="brand-cluster">
            <div className="brand-emblem">D2E</div>
            <div className="brand-titles">
              <div className="brand-main">
                <span>滴水成城</span>
                <span className="brand-sub">DROP TO EMPIRE</span>
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
                ×
              </button>
            </div>
          )}

          <div className="side-switch" role="tablist">
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
              登录
            </button>
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
              注册
            </button>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!authHandle.trim() || !authPassword) return;
              if (authMode === "register" && !authInviteCode.trim()) return;
              void runAction(() =>
                authMode === "register"
                  ? api.registerAccount({
                      handle: authHandle.trim(),
                      password: authPassword,
                      inviteCode: authInviteCode.trim(),
                    })
                  : api.loginAccount({
                      handle: authHandle.trim(),
                      password: authPassword,
                    }),
              );
            }}
          >
            <label>
              <span>账号</span>
              <input
                type="text"
                required
                value={authHandle}
                onChange={(e) => setAuthHandle(e.target.value)}
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </label>
            {authMode === "register" && (
              <label>
                <span>邀请码</span>
                <input
                  type="text"
                  required
                  className="mono-num"
                  placeholder="d2e-inv-xxxx-xxxx-xxxx"
                  value={authInviteCode}
                  onChange={(e) => setAuthInviteCode(e.target.value)}
                />
              </label>
            )}
            <button
              type="submit"
              className="btn-water-strike btn-block"
              disabled={busy}
            >
              {authMode === "register" ? "注册并进入" : "进入"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  // ============================================================================
  // PLAYER GAME VIEW: Minimalist, progressive unfolding
  // ============================================================================
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
    inFlightClicks * perClickWaterMilli +
    Math.floor(waterRes.netRatePerSecMilli * interpSeconds);
  const totalClicks = player.totalManualClicks + inFlightClicks;

  const handleGatherWater = () => {
    setErrorBanner(null);
    const burstId = Date.now() + Math.random();
    const label = `+${firstResBpUnlocked ? 2 : 1}`;
    setWaterBursts((prev) => [...prev.slice(-5), { id: burstId, label }]);
    window.setTimeout(() => {
      setWaterBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 660);

    setInFlightClicks((prev) => prev + 1);
    api
      .gatherWater({ clicks: 1 })
      .then((next) => {
        setInFlightClicks((prev) => Math.max(0, prev - 1));
        applyServerState(next);
      })
      .catch((err: unknown) => {
        setInFlightClicks((prev) => Math.max(0, prev - 1));
        setErrorBanner(err instanceof Error ? err.message : "请求失败");
      });
  };

  const adjustJobCount = (jobKey: string, delta: number) => {
    void runAction(() =>
      api.allocateWorkers({
        mode: "delta",
        entries: [{ jobKey, count: delta }],
      }),
    );
  };

  // Stage A: Opening Stage (Population == 0)
  // Uses a fixed-anchor 3-slot grid so the [打水] button NEVER shifts or teleports!
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

  const openingStory = !hasAnyWaterYet
    ? {
        key: "prologue-0",
        kicker: "序章 · 干涸荒原",
        line1: "干涸的荒原，万籁俱寂。",
        line2: "唯有岩缝深处，尚存一缕微弱的水脉。",
      }
    : liveWaterMilli < 4000
      ? {
          key: "prologue-1",
          kicker: "序章 · 微光初现",
          line1: "清冽的水滴汇入石凹，荒原泛起生机。",
          line2: "积满 10 滴水，便能留住路过的流民。",
        }
      : !canSeeFirstRecruit
        ? {
            key: "prologue-2",
            kicker: "序章 · 旅人驻足",
            line1: "远处的流民循着水汽向此聚拢……",
            line2: "再掬起几捧清泉，即可招募第一位居民。",
          }
        : {
            key: "prologue-3",
            kicker: "序章 · 聚落起点",
            line1: "石凹蓄满清泉，一位疲惫的旅人停下脚步。",
            line2: "招募他留居于此，开启昼夜不息的自动汲水。",
          };

  if (isOpeningStage) {
    return (
      <div className="app-shell opening-shell">
        <div className="corner-utility-bar">
          <span className="tag-badge mono-num">{player.handle}</span>
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
            onClick={() => void handleLogout()}
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
                  style={{ width: `${firstTenProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="opening-center-slot">
            <button
              type="button"
              className="btn-water-strike btn-opening-sole"
              onClick={handleGatherWater}
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
                disabled={liveWaterMilli < 10000 || busy || !canSeeFirstRecruit}
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

  // Stage B: Population >= 1 -> Progressive Unfolding Dashboard
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
  const waterAssignedCount = waterJob?.assigned ?? 0;
  const woodAssignedCount = jobs.find((j) => j.jobKey === "wood")?.assigned ?? 0;
  const stoneAssignedCount =
    jobs.find((j) => j.jobKey === "stone")?.assigned ?? 0;

  const storyChapter = !firstResBpUnlocked
    ? {
        key: "ch1-water",
        tag: "第一章 · 初立营火",
        text: "第一位居民已拎起木桶自动汲水（+2.0/秒）。继续积攒 30 滴水，在右侧解锁【最初的居所】。",
      }
    : !axeUnlocked
      ? {
          key: "ch2-axe",
          tag: "第二章 · 居所生根",
          text: "居所立起屋檐，手点打水翻倍（+2/次）。招募满 3 名居民，解锁【斧头蓝图】向枯木林进发。",
        }
      : woodAssignedCount === 0
        ? {
            key: "ch3-wood",
            tag: "第三章 · 伐木开林",
            text: "石斧已铸成！【岗位】面板已展开，点击【伐木 +1】调派居民采集木材。",
          }
        : !quarryUnlocked
          ? {
              key: "ch4-quarry",
              tag: "第四章 · 水木并进",
              text: "林间响起伐木声。建造【一号引水轮】提升水力，并扩充至 8 人口研发【采石技术】。",
            }
          : stoneAssignedCount === 0
            ? {
                key: "ch5-stone",
                tag: "第五章 · 破岩采石",
                text: "山麓岩脉已探明！在【岗位】面板点击【采石 +1】，调派居民开采筑城石料。",
              }
            : !workshopUnlocked
              ? {
                  key: "ch6-workshop",
                  tag: "第六章 · 工坊奠基",
                  text: "水、木、石三脉齐备。升级【石刃锯台】，集齐物资建造【基础工坊】。",
                }
              : !treasureUnlocked
                ? {
                    key: "ch7-treasure",
                    tag: "第七章 · 远古遗物",
                    text: "工坊炉火彻夜不息。锻造【高压铜阀】【承重横梁】【古文明石板】，开启【神秘的宝藏】。",
                  }
                : player.profession === "none"
                  ? {
                      key: "ch8-prof",
                      tag: "第八章 · 圣坛择业",
                      text: "远古宝藏轰然开启！择定你的终身职业，步入跨职业贸易与商会战争纪元。",
                    }
                  : {
                      key: "ch9-empire",
                      tag: "第九章 · 滴水成城",
                      text: "聚落已蜕变为帝国重镇。在下方工坊制造专属制品、挂单贸易，率军争夺黑曜与白银城池。",
                    };

  const selectedWarNode =
    state.war.nodes.find((n) => n.nodeId === selectedNodeId) ??
    state.war.nodes[0];

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-emblem">D2E</div>
          <div className="brand-titles">
            <div className="brand-main">
              <span>滴水成城</span>
            </div>
            <div className="brand-meta">
              <span>{player.handle}</span>
              {player.profession !== "none" && (
                <>
                  <span>·</span>
                  <span>{player.professionName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="telemetry-strip">
          <div className="metric-cell">
            <span className="metric-label">人口</span>
            <span className="metric-value mono-num">
              {player.populationTotal}
            </span>
          </div>

          {(treasureUnlocked ||
            player.profession !== "none" ||
            player.goldBasis > 0) && (
            <div className="metric-cell">
              <span className="metric-label">金币</span>
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
            <div className="metric-cell">
              <span className="metric-label">积分</span>
              <span className="metric-value mono-num">
                {player.activityPoints}
              </span>
            </div>
          )}
        </div>

        <div className="toolbar-actions">
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
            className="btn-outline"
            onClick={() => void handleLogout()}
          >
            <LogOut size={ICON.xs} />
            <span>退出</span>
          </button>
        </div>
      </header>

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
            ×
          </button>
        </div>
      )}

      {/* Animated Story Chronicle Bar */}
      <section className="story-chronicle-bar" aria-label="纪元指引">
        <span className="story-beacon-dot" />
        <span className="story-chapter-tag">{storyChapter.tag}</span>
        <span key={storyChapter.key} className="story-whisper-text">
          {storyChapter.text}
        </span>
      </section>

      {/* Profession Selection Gate */}
      {showProfessionChoice && (
        <section className="profession-gate-banner" aria-label="选择职业">
          <div className="section-head">
            <div>
              <span className="tag-badge tag-warning">神秘的宝藏</span>
              <h2>选择职业</h2>
              <p>选定后不可更改。</p>
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
                  disabled={busy}
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

      {/* Main Upper Dashboard */}
      <main
        className={`dashboard-grid ${!showJobAllocationColumn ? "dashboard-grid-2col" : ""}`}
      >
        {/* Column 1: Resources */}
        <section className="panel" aria-label="资源">
          <div className="panel-header">
            <div className="panel-title">
              <Droplets size={ICON.sm} />
              <h2>资源</h2>
            </div>
            <span className="tag-badge mono-num">
              {formatRate(waterRes.netRatePerSecMilli)}
            </span>
          </div>

          <div className="water-hero-box">
            <div className="water-readout">
              <span className="water-label">💧 水</span>
              <strong className="water-big-num mono-num">
                {formatResource(liveWaterMilli, 1)}
              </strong>
              <span className="water-rate mono-num">
                {formatRate(waterRes.netRatePerSecMilli)}
              </span>
            </div>
            <button
              type="button"
              className="btn-water-strike"
              onClick={handleGatherWater}
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
                    {showAdvancedWorld && <th>类型</th>}
                    <th className="num-col">库存</th>
                    <th className="num-col">产出</th>
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
                      <tr key={r.key} className="res-row-enter">
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
          )}
        </section>

        {/* Column 2: Worker Allocation — ONLY rendered after Axe Blueprint unlocks */}
        {showJobAllocationColumn && (
          <section className="panel" aria-label="岗位">
            <div className="panel-header">
              <div className="panel-title">
                <Hammer size={ICON.sm} />
                <h2>岗位</h2>
              </div>
              <span className="tag-badge mono-num">
                {player.populationAssigned} / {player.populationTotal}
              </span>
            </div>

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
                均衡
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
                打水优先
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
                  伐木优先
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
                  采石优先
                </button>
              )}
            </div>

            <div className="job-list">
              {unlockedJobs.map((job) => {
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
                            {job.efficiencyPct}%
                          </span>
                        )}
                      </div>
                      <small className="job-sub mono-num">
                        {(job.effectiveRateMilli / 1000).toFixed(2)}/s
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
                          {job.assigned}
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
                      api.saveAllocationPreset({ name: presetInput.trim() }),
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
                  <button type="submit" className="btn-outline">
                    保存
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* Column 3: Recruitment & Blueprints */}
        <section className="panel" aria-label="发展">
          <div className="panel-header">
            <div className="panel-title">
              <Compass size={ICON.sm} />
              <h2>发展</h2>
            </div>
            <span className="tag-badge mono-num">
              人口 {player.populationTotal}
            </span>
          </div>

          <div className="recruit-card">
            <div className="recruit-meta">
              <div className="recruit-head">
                <strong>招募居民</strong>
                <span className="tag-badge mono-num">
                  {formatETA(player.nextResidentEtaSeconds)}
                </span>
              </div>
              <div className="recruit-cost mono-num">
                -{formatResource(player.nextResidentCostWaterMilli, 1)} 水
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
                <span>+1</span>
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
                  +5
                </button>
              )}
            </div>
          </div>

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
                      {formatETA(bp.etaSeconds)}
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
                            {c.resourceName} {formatResource(cur, 0)}/
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
                      解锁
                    </button>
                  </div>
                </article>
              );
            })}

            {completedBlueprints.length > 0 && (
              <details className="settlement-item">
                <summary className="mono-num">
                  已解锁 ({completedBlueprints.length})
                </summary>
                {completedBlueprints.map((bp) => (
                  <div key={bp.code} className="bp-card bp-unlocked">
                    <div className="bp-top">
                      <strong>{bp.name}</strong>
                      <span className="tag-badge tag-success">✓</span>
                    </div>
                    <p className="bp-desc">{bp.effectSummary}</p>
                  </div>
                ))}
              </details>
            )}
          </div>
        </section>
      </main>

      {/* Lower Workspace Tabs: ONLY rendered AFTER choosing a profession */}
      {showAdvancedWorld && (
        <section className="lower-workspace" aria-label="帝国系统">
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
                <span>工坊</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "market"}
                className={`tab-btn ${activeTab === "market" ? "active" : ""}`}
                onClick={() => setActiveTab("market")}
              >
                <TrendingUp size={ICON.sm} />
                <span>市场</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "war"}
                className={`tab-btn ${activeTab === "war" ? "active" : ""}`}
                onClick={() => setActiveTab("war")}
              >
                <Swords size={ICON.sm} />
                <span>战区 (D{state.war.currentDay})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "collectibles"}
                className={`tab-btn ${activeTab === "collectibles" ? "active" : ""}`}
                onClick={() => setActiveTab("collectibles")}
              >
                <Award size={ICON.sm} />
                <span>藏品 ({state.collectibles.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "chronicle"}
                className={`tab-btn ${activeTab === "chronicle" ? "active" : ""}`}
                onClick={() => setActiveTab("chronicle")}
              >
                <Scale size={ICON.sm} />
                <span>纪事</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Workshop */}
          {activeTab === "craft" && (
            <div className="tab-body split-2col">
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>
                    <Layers size={ICON.sm} />
                    <span>设备装槽</span>
                  </h3>
                </div>
                <div className="equip-slot-list">
                  {state.installedEquipments.map((eq) => (
                    <div key={eq.itemKey} className="equip-card">
                      <div className="equip-main">
                        <div className="equip-title-row">
                          <strong>{eq.name}</strong>
                          <span className="tag-badge mono-num">
                            {eq.installedCount}/{eq.maxStack} · 库存{" "}
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
                          -1
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
                          +1
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
                    <span>制造配方</span>
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
                          +{formatResource(rc.outputAmountMilli, 0)}
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
                              {c.resourceName}{" "}
                              {formatResource(c.currentMilli, 0)}/
                              {formatResource(c.requiredMilli, 0)}
                            </span>
                          ))}
                          {rc.goldCostBasis > 0 && (
                            <span className="cost-chip mono-num">
                              {formatGold(rc.goldCostBasis)} G
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
                          {rc.professionMatched ? (
                            "制造"
                          ) : (
                            <span className="lock-pill">仅限对应职业</span>
                          )}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Market */}
          {activeTab === "market" && (
            <div className="tab-body split-3col">
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>行情</h3>
                </div>
                <div className="table-wrap">
                  <table className="ink-table clickable-rows">
                    <thead>
                      <tr>
                        <th>商品</th>
                        <th className="num-col">现价</th>
                        <th className="num-col">买 / 卖</th>
                        <th className="num-col">量</th>
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
                  <h3>委托 · {selectedMarketMeta.itemName}</h3>
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
                      买入
                    </button>
                    <button
                      type="button"
                      className={`side-btn ${orderSide === "ASK" ? "active-ask" : ""}`}
                      onClick={() => setOrderSide("ASK")}
                    >
                      卖出
                    </button>
                  </div>

                  <div className="form-row-2">
                    <label>
                      <span>单价</span>
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
                      <span>数量</span>
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
                      总额{" "}
                      {(
                        Number(orderPriceGold || 0) * Number(orderQtyUnits || 0)
                      ).toFixed(2)}{" "}
                      G
                    </span>
                    <span>税率 1%</span>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary btn-block"
                    disabled={busy}
                  >
                    {orderSide === "BID" ? "挂买单" : "挂卖单"}
                  </button>
                </form>

                <div className="orderbook-box">
                  <h4>盘口</h4>
                  <div className="table-wrap">
                    <table className="ink-table">
                      <thead>
                        <tr>
                          <th>方向</th>
                          <th className="num-col">价格</th>
                          <th className="num-col">数量</th>
                          <th>卖家/买家</th>
                          <th></th>
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
                                    填入
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
                  <h3>最新成交</h3>
                </div>
                <div className="table-wrap">
                  <table className="ink-table">
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>商品</th>
                        <th className="num-col">价格</th>
                        <th className="num-col">数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.recentTrades.map((tr) => (
                        <tr key={tr.id}>
                          <td className="mono-num">{tr.executedAt}</td>
                          <td>{tr.itemName}</td>
                          <td className="num-col mono-num">
                            {formatGold(tr.priceBasis)}
                          </td>
                          <td className="num-col mono-num">
                            {formatResource(tr.quantityMilli, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Chamber War */}
          {activeTab === "war" && (
            <div className="tab-body war-layout">
              <div className="war-main-col">
                <div className="war-scoreboard">
                  <div className="guild-score-block">
                    <span className="guild-tag">黑曜商会</span>
                    <strong className="mono-num">
                      {state.war.obsidianTotalScore}
                    </strong>
                  </div>
                  <div className="war-day-banner">
                    <span className="tag-badge">
                      D{state.war.currentDay} / 7
                    </span>
                    <small>每日 20:00 结算</small>
                  </div>
                  <div className="guild-score-block">
                    <span className="guild-tag">白银同盟</span>
                    <strong className="mono-num">
                      {state.war.argentTotalScore}
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
                    <h3>战报</h3>
                  </div>
                  {state.war.settlementHistory.length === 0 ? (
                    <p className="muted-note">暂无战报</p>
                  ) : (
                    <div className="settlement-list">
                      {state.war.settlementHistory.map((h) => (
                        <details
                          key={`${h.dayIndex}-${h.settledAt}`}
                          className="settlement-item"
                          open
                        >
                          <summary className="mono-num">
                            D{h.dayIndex} ({h.settledAt}) · 黑曜 +
                            {h.obsidianScoreDelta} / 白银 +{h.argentScoreDelta}
                          </summary>
                          <div className="table-wrap">
                            <table className="ink-table">
                              <thead>
                                <tr>
                                  <th>据点</th>
                                  <th>归属</th>
                                  <th className="num-col">黑曜</th>
                                  <th className="num-col">白银</th>
                                  <th>结果</th>
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
                    <span>{selectedWarNode.name}</span>
                  </h3>
                </div>

                <div className="war-guild-bar">
                  <span>{state.war.playerGuildName}</span>
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
                    切换阵营
                  </button>
                </div>

                <div className="node-intel-card">
                  <div className="intel-row">
                    <span>归属</span>
                    <strong className="mono-num">
                      {selectedWarNode.ownerGuild}
                    </strong>
                  </div>
                  <div className="intel-row">
                    <span>守军 (步/弓/骑)</span>
                    <strong className="mono-num">
                      {selectedWarNode.infantryCount}/
                      {selectedWarNode.archerCount}/
                      {selectedWarNode.cavalryCount}
                    </strong>
                  </div>
                  <div className="intel-row">
                    <span>补给线</span>
                    <strong
                      className={
                        selectedWarNode.canDeploy ? "rate-pos" : "cost-lack"
                      }
                    >
                      {selectedWarNode.canDeploy ? "已连通" : "未连通"}
                    </strong>
                  </div>
                  <div className="intel-row">
                    <span>今日额度</span>
                    <strong className="mono-num">
                      {state.war.dailyBudgetUsed} / {state.war.dailyBudgetCap}
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
                  <h4>派兵</h4>
                  <div className="form-row-3">
                    <label>
                      <span>步兵</span>
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
                      <span>弓兵</span>
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
                      <span>骑兵</span>
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
                    出兵
                  </button>
                </form>
              </aside>
            </div>
          )}

          {/* TAB 4: Collectibles */}
          {activeTab === "collectibles" && (
            <div className="tab-body">
              <div className="chest-console">
                <div className="chest-console-info">
                  <h3>
                    <Box size={ICON.sm} />
                    <span>S1 · 墨械宝箱</span>
                  </h3>
                  <p>100 积分兑换 1 个宝箱。</p>
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
                    兑换宝箱 (-100 积分)
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
                      开箱 (
                      {Math.floor(
                        (resources.find((r) => r.key === "season_chest")
                          ?.amountMilli ?? 0) / 1000,
                      )}
                      )
                    </span>
                  </button>
                </div>
              </div>

              {state.collectibles.length === 0 ? (
                <div className="empty-stage-hint">暂无藏品</div>
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
                            <dt>编号</dt>
                            <dd>#{item.serialNumber}</dd>
                          </div>
                          <div>
                            <dt>纹理</dt>
                            <dd>
                              {item.textureName} · {item.paletteName}
                            </dd>
                          </div>
                          <div>
                            <dt>种子</dt>
                            <dd>{item.patternSeed}</dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Chronicle & Season Notice */}
          {activeTab === "chronicle" && (
            <div className="tab-body split-2col">
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>赛季动向</h3>
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
                  <h3>纪事</h3>
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
