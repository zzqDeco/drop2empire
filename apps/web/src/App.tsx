import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  ApiError,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import {
  Compass,
  Droplets,
  Hammer,
  Moon,
  Plus,
  Scale,
  Sun,
  UserCheck,
} from "lucide-react";
import { ICON } from "./icons";
import { SETTLEMENT_UI_CONFIG } from "./config/gameConfig";
import { applyTheme, getInitialTheme, type ThemeMode } from "./theme";
import { formatETA, formatGold, formatRate, formatResource } from "./format";
import { CivilizationSilhouetteSVG } from "./RaidSpritesSVG";
import {
  LordProfileWardrobeBar,
  WastelandRaidPanel,
} from "./WastelandRaidPanel";
import { AdminConsoleView } from "./AdminConsoleView";
import {
  ImperialAnnouncementModal,
  MarketSceneView,
  SeasonRelicVaultPanel,
  SettingsChronicleModal,
  WarGuildSceneView,
  WorldMapCompassModal,
  type WorldZoneKey,
} from "./MacroEmpireWorkspace";

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
  const [presetInput, setPresetInput] = useState("");
  const [activeScene, setActiveScene] = useState<WorldZoneKey>("settlement");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showWorldMapModal, setShowWorldMapModal] = useState(false);
  const [dismissedChapterKey, setDismissedChapterKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("d2e_ack_chapter") ?? "";
  });

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
  const [actionBursts, setActionBursts] = useState<
    Array<{ id: number; x: number; y: number; label: string }>
  >([]);

  // Smooth visual interpolation offset (ms since last state update)
  const [lastSyncAtMs, setLastSyncAtMs] = useState<number>(() => Date.now());
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const applyServerState = useCallback((next: DashboardStateResp) => {
    setState(next);
    setLastSyncAtMs(Date.now());
    setNowTickMs(Date.now());
  }, []);

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
  }, [applyServerState]);

  const hasState = state !== null;
  const hasActivePopulation = (state?.player.populationTotal ?? 0) > 0;
  const activeHandle = state?.player.handle ?? "";

  useEffect(() => {
    if (!hasState || !hasActivePopulation) return;
    const timer = window.setInterval(() => {
      api
        .getDashboard()
        .then((res) => {
          applyServerState(res);
        })
        .catch(() => {});
    }, SETTLEMENT_UI_CONFIG.syncPollIntervalMs);
    return () => window.clearInterval(timer);
  }, [hasState, hasActivePopulation, activeHandle, applyServerState]);

  useEffect(() => {
    if (!hasState || !hasActivePopulation) return;
    const id = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, SETTLEMENT_UI_CONFIG.interpTickMs);
    return () => window.clearInterval(id);
  }, [hasState, hasActivePopulation]);

  useEffect(() => {
    if (!hasState || !hasActivePopulation || isAdminRoute) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setShowWorldMapModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasState, hasActivePopulation, isAdminRoute]);

  const runAction = useCallback(
    async (
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
    },
    [applyServerState],
  );

  const handleLogout = async () => {
    setBusy(true);
    try {
      await api.logoutAccount();
    } finally {
      setState(null);
      setShowSettingsModal(false);
      setNoticeBanner(null);
      setErrorBanner(null);
      setBusy(false);
    }
  };

  const handleGlobalButtonPop = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement | null)?.closest?.("button");
    if (!btn || btn.disabled) return;
    const popLabel = btn.getAttribute("data-pop");
    if (!popLabel) return;
    const rect = btn.getBoundingClientRect();
    const burstId = Date.now() + Math.random();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top);
    setActionBursts((prev) => [
      ...prev.slice(-7),
      { id: burstId, x, y, label: popLabel },
    ]);
    window.setTimeout(() => {
      setActionBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 660);
  };

  const interpSeconds = useMemo(() => {
    if (!state) return 0;
    const elapsedSec = Math.max(0, (nowTickMs - lastSyncAtMs) / 1000);
    return (
      Math.min(SETTLEMENT_UI_CONFIG.maxInterpSec, elapsedSec) *
      state.player.speedMultiplier
    );
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
    return (
      <AdminConsoleView
        state={state}
        busy={busy}
        theme={theme}
        setTheme={setTheme}
        errorBanner={errorBanner}
        noticeBanner={noticeBanner}
        setErrorBanner={setErrorBanner}
        setNoticeBanner={setNoticeBanner}
        runAction={runAction}
        handleLogout={handleLogout}
      />
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
            <button type="submit" className="btn-water-strike btn-block">
              {authMode === "register" ? "注册并进入" : "进入"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  // ============================================================================
  // PLAYER GAME VIEW: Minimalist, progressive multi-scene unfolding
  // ============================================================================
  const { player, resources, jobs, blueprints, professions } = state;
  const waterRes = resources.find((r) => r.key === "water")!;
  const firstResBpUnlocked =
    blueprints.find((b) => b.code === "first_resident")?.unlocked ?? false;
  const axeUnlocked =
    blueprints.find((b) => b.code === "axe_blueprint")?.unlocked ?? false;
  const quarryUnlocked =
    blueprints.find((b) => b.code === "quarry_tech")?.unlocked ?? false;
  const scoutCampUnlocked =
    blueprints.find((b) => b.code === "scout_camp")?.unlocked ?? false;
  const workshopUnlocked =
    blueprints.find((b) => b.code === "basic_workshop")?.unlocked ?? false;
  const treasureUnlocked =
    blueprints.find((b) => b.code === "mystery_treasure")?.unlocked ?? false;

  const perClickWaterMilli = firstResBpUnlocked
    ? SETTLEMENT_UI_CONFIG.upgradedGatherClickMilli
    : SETTLEMENT_UI_CONFIG.baseGatherClickMilli;
  const rawLiveWaterMilli =
    waterRes.amountMilli +
    inFlightClicks * perClickWaterMilli +
    Math.floor(waterRes.netRatePerSecMilli * interpSeconds);
  const liveWaterMilli = Math.max(
    0,
    waterRes.capacityMilli > 0
      ? Math.min(waterRes.capacityMilli, rawLiveWaterMilli)
      : rawLiveWaterMilli,
  );
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
  const canSeeFirstRecruit =
    liveWaterMilli >= SETTLEMENT_UI_CONFIG.firstRecruitWaterMilli ||
    totalClicks >= SETTLEMENT_UI_CONFIG.firstRecruitClickTarget;
  const firstTenProgressPct = Math.min(
    100,
    Math.floor(
      (liveWaterMilli / SETTLEMENT_UI_CONFIG.firstRecruitWaterMilli) * 100,
    ),
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
      <div
        className="app-shell opening-shell"
        onClickCapture={handleGlobalButtonPop}
      >
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

  // Stage B: Population >= 1 -> Progressive Multi-Scene Unfolding Dashboard
  const showJobAllocationColumn = axeUnlocked || player.profession !== "none";
  const showProfessionChoice =
    treasureUnlocked && player.profession === "none";
  const showAdvancedWorld = player.profession !== "none";
  const showScoutScene = scoutCampUnlocked || showAdvancedWorld;
  const showLordScene =
    scoutCampUnlocked ||
    showAdvancedWorld ||
    state.cosmetics.some((c) => c.ownedCount > 0) ||
    state.collectibles.length > 0;

  const unlockedResources = resources.filter((r) => r.unlocked);
  const unlockedJobs = jobs.filter((j) => j.unlocked);
  const unlockedEdicts = (state.edicts ?? []).filter((e) => e.unlocked);
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
                      text: "远古宝藏轰然开启！择定你的终身职业，即可在右下角【世界舆图】中解锁皇家工坊市场与公会战区。",
                    }
                  : {
                      key: "ch9-empire",
                      tag: "第九章 · 滴水成城",
                      text: "聚落已蜕变为帝国重镇！主界面融合领主个人档案与主城生产，点击右下角【世界舆图 (M)】即可前往荒原裂隙、工坊交易所、公会战区与秘宝馆。",
                    };

  const civEra: "stone" | "colony" | "workshop" | "empire" = !quarryUnlocked
    ? "stone"
    : !workshopUnlocked
      ? "colony"
      : player.profession === "none"
        ? "workshop"
        : "empire";

  const currentAckChapterKey = `${player.handle}:${storyChapter.key}`;
  const showCivChapterPopup = dismissedChapterKey !== currentAckChapterKey;

  const zoneTitleMap: Record<WorldZoneKey, string> = {
    settlement: "◆ 帝国主城 · 领主与聚落总览 ◆",
    scout: "◆ 西北裂隙 · 荒原斥候大营 ◆",
    market: "◆ 东南商埠 · 皇家工坊与交易所 ◆",
    war: "◆ 东北前线 · 公会驻地与八城战区 ◆",
    lord: "◆ 西南秘苑 · 墨械唯一秘宝馆 ◆",
  };

  return (
    <div className="app-shell" onClickCapture={handleGlobalButtonPop}>
      {/* ========================================================================
          GRAND IMPERIAL CREST HEADER (无冗余左上角品牌/小人，强化人口/金币/积分纹章边框)
          ======================================================================== */}
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
            <span className="metric-label">帝国人口</span>
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
          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowAnnouncementModal(true)}
          >
            <Scale size={ICON.xs} />
            <span>帝国公告 ({state.seasonNotices.length})</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowSettingsModal(true)}
          >
            <Hammer size={ICON.xs} />
            <span>设置 ({state.eventLogs.length})</span>
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

      {/* ========================================================================
          SCENE 1: 完整个人视角 · 领主主城 (Personal Lord Profile + Settlement Production)
          ======================================================================== */}
      {activeScene === "settlement" && (
        <div key="scene-settlement">
          {showProfessionChoice && (
            <section className="profession-gate-banner" aria-label="选择职业">
              <div className="section-head">
                <div>
                  <span className="tag-badge tag-warning">神秘的宝藏</span>
                  <h2>选择终身职业（解锁工坊市场与公会战区）</h2>
                  <p>选定后本赛季不可更改，不同职业享有专属工坊制造配方与聚落加成。</p>
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
            {/* Column 1: Integrated Personal Lord Profile + Resources (with Separate Gross / Drain / Net Rates) */}
            <div className="settlement-left-col">
              <LordProfileWardrobeBar state={state} runAction={runAction} />

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
                    <span>
                      净速 {formatRate(waterRes.netRatePerSecMilli)}
                    </span>
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
                              disabled={job.assigned < 5}
                              onClick={() => adjustJobCount(job.jobKey, -5)}
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              className="btn-step mono-num"
                              data-pop={`-1 ${job.name}`}
                              disabled={job.assigned <= 0}
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
                              data-pop={`+1 ${job.name}`}
                              disabled={canAddPool < 1}
                              onClick={() => adjustJobCount(job.jobKey, 1)}
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              className="btn-step mono-num"
                              data-pop={`+5 ${job.name}`}
                              disabled={canAddPool < 5}
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
                      >
                        保存
                      </button>
                    </form>
                  </div>
                )}
              </section>
            )}

            {/* Column 3: Resident Recruitment & Blueprints */}
            <section className="panel" aria-label="发展">
              <div className="panel-header">
                <div className="panel-title">
                  <Compass size={ICON.sm} />
                  <h2>招募与蓝图</h2>
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
                    data-pop="+1 居民"
                    disabled={
                      liveWaterMilli < player.nextResidentCostWaterMilli
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
                      data-pop="+5 居民"
                      disabled={
                        liveWaterMilli < player.nextResidentCostWaterMilli
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
                            人口 {player.populationTotal}/
                            {bp.requiredPopulation}
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
                          data-pop={`✓ 解锁 ${bp.name}`}
                          disabled={!bp.canUnlock}
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
        </div>
      )}

      {/* ========================================================================
          SCENE 2: 荒原裂隙斥候营 (Act 1 整备 → Act 2 3D 蚀刻增益卡抽取 → Act 3 全屏 2D 搜打撤与局内游商)
          ======================================================================== */}
      {activeScene === "scout" && showScoutScene && (
        <section
          key="scene-scout"
          className="raid-scene-shell"
          aria-label="荒原裂隙斥候营"
        >
          <WastelandRaidPanel state={state} runAction={runAction} />
        </section>
      )}

      {/* ========================================================================
          SCENE 3: 工坊与市场 (Workshop Crafting, Equipment Rack & Global CLOB Market)
          ======================================================================== */}
      {activeScene === "market" && showAdvancedWorld && (
        <div key="scene-market" style={{ marginTop: "var(--space-3)" }}>
          <MarketSceneView state={state} runAction={runAction} />
        </div>
      )}

      {/* ========================================================================
          SCENE 4: 公会与战区 (Guild Hall + 8-Node Chamber Territory War)
          ======================================================================== */}
      {activeScene === "war" && showAdvancedWorld && (
        <div key="scene-war" style={{ marginTop: "var(--space-3)" }}>
          <WarGuildSceneView state={state} runAction={runAction} />
        </div>
      )}

      {/* ========================================================================
          SCENE 5: 墨械秘宝陈列馆 (Season Chest & Procedural UV-Etched Collectibles)
          ======================================================================== */}
      {activeScene === "lord" && showLordScene && (
        <div key="scene-lord" style={{ marginTop: "var(--space-3)" }}>
          <SeasonRelicVaultPanel state={state} runAction={runAction} />
        </div>
      )}

      {/* ========================================================================
          FLOATING WORLD MAP COMPASS BUTTON (右下角世界舆图按钮，前往各大功能区)
          ======================================================================== */}
      <button
        type="button"
        className="world-map-fab"
        aria-label="打开世界舆图 (快捷键 M)"
        data-pop="展开世界舆图"
        onClick={() => setShowWorldMapModal(true)}
      >
        <span className="world-map-fab-ring" aria-hidden="true" />
        <Compass size={ICON.lg} />
        <div className="world-map-fab-text">
          <strong>世界舆图</strong>
          <span className="mono-num">
            {activeScene === "settlement" ? "前往疆域 [M]" : "切换疆域 [M]"}
          </span>
        </div>
      </button>

      {/* ========================================================================
          CIVILIZATION CHAPTER PROGRESSION POPUP (章节推进时浮出文明剪影，常驻收敛于设置)
          ======================================================================== */}
      {showCivChapterPopup && (
        <div
          className="modal-backdrop civ-popup-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="文明纪元推进昭告"
        >
          <div className="civ-popup-card">
            <div className="civ-popup-kicker">
              <span className="story-beacon-dot" />
              <span className="story-chapter-tag">{storyChapter.tag}</span>
            </div>
            <div className="civ-popup-silhouette-wrap">
              <CivilizationSilhouetteSVG era={civEra} />
            </div>
            <p className="story-whisper-text">{storyChapter.text}</p>
            <div className="civ-popup-footer">
              <span className="muted-note">
                （此章节指引随后将收纳于右上角【设置】面板中，不占用主界面视野）
              </span>
              <button
                type="button"
                className="btn-water-strike"
                data-pop="★ 纪元推进"
                onClick={() => {
                  setDismissedChapterKey(currentAckChapterKey);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      "d2e_ack_chapter",
                      currentAckChapterKey,
                    );
                  }
                }}
              >
                <span>铭记史册 · 继续开拓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          WORLD MAP COMPASS MODAL (世界舆图疆域导航)
          ======================================================================== */}
      {showWorldMapModal && (
        <WorldMapCompassModal
          state={state}
          activeScene={activeScene}
          showScoutScene={showScoutScene}
          showAdvancedWorld={showAdvancedWorld}
          showLordScene={showLordScene}
          onSelectZone={(z) => setActiveScene(z)}
          onClose={() => setShowWorldMapModal(false)}
        />
      )}

      {/* ========================================================================
          IMPERIAL ANNOUNCEMENT MODAL (帝国公告 · 赛季动向与宏观账本)
          ======================================================================== */}
      {showAnnouncementModal && (
        <ImperialAnnouncementModal
          state={state}
          onClose={() => setShowAnnouncementModal(false)}
        />
      )}

      {/* ========================================================================
          SETTINGS & CHRONICLE MODAL (设置 · 主题切换、退出、文明章节与聚落编年纪事)
          ======================================================================== */}
      {showSettingsModal && (
        <SettingsChronicleModal
          state={state}
          theme={theme}
          storyChapter={storyChapter}
          civEra={civEra}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
          onLogout={() => void handleLogout()}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Global Coordinate-Anchored Tactile Pop Layer (Matches [打水] Floating Pop UX) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 60,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        {actionBursts.map((b) => (
          <div
            key={b.id}
            style={{
              position: "fixed",
              left: `${b.x}px`,
              top: `${b.y}px`,
              width: "56px",
              height: "28px",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <span className="water-ripple-ring" />
            <span className="water-float-pop mono-num">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
