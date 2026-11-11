import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Compass, Droplets } from "lucide-react";
import { EconomyWorkspace, CompanyPortfolio } from "./EconomyWorkspace";
import { EconomyEvents } from "./EconomyEvents";
import "./economy.css";
import { ICON } from "./icons";
import { CivilizationSilhouetteSVG } from "./RaidSpritesSVG";
import { WastelandRaidPanel } from "./WastelandRaidPanel";
import {
  ImperialAnnouncementModal,
  SeasonRelicVaultPanel,
  SettingsChronicleModal,
  WarGuildSceneView,
  WorldMapCompassModal,
} from "./MacroEmpireWorkspace";
import { ModalShell } from "./components/ModalShell";
import { useGameSession } from "./hooks/useGameSession";
import { useWaterGather } from "./hooks/useWaterGather";
import { deriveProgressionFlags } from "./domain/settlementSelectors";
import { AuthScreen } from "./features/auth/AuthScreen";
import { OpeningStageView } from "./features/settlement/OpeningStageView";
import { ImperialTopHeader } from "./features/settlement/ImperialTopHeader";
import { SettlementDashboardView } from "./features/settlement/SettlementDashboardView";

const LazyAdminConsoleView = lazy(() => import("./AdminConsoleView"));

export function App() {
  const isAdminRoute = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin"),
    [],
  );

  const [dismissedChapterKey, setDismissedChapterKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("d2e_ack_chapter") ?? "";
  });
  const [ackedOfflineSummary, setAckedOfflineSummary] = useState<string>("");

  const {
    state,
    loading,
    busy,
    isScopeBusy,
    errorBanner,
    noticeBanner,
    setErrorBanner,
    setNoticeBanner,
    theme,
    setTheme,
    activeScene,
    setActiveScene,
    marketFocusItemKey,
    setMarketFocusItemKey,
    showSettingsModal,
    setShowSettingsModal,
    showAnnouncementModal,
    setShowAnnouncementModal,
    showWorldMapModal,
    setShowWorldMapModal,
    applyServerState,
    runAction,
    handleLogout,
    lastSyncAtMs,
  } = useGameSession(isAdminRoute);

  useEffect(() => {
    if (!noticeBanner) return;
    const id = window.setTimeout(() => setNoticeBanner(null), 5000);
    return () => window.clearTimeout(id);
  }, [noticeBanner, setNoticeBanner]);

  const firstResBpUnlocked =
    state?.blueprints.find((b) => b.code === "first_resident")?.unlocked ??
    false;

  const {
    inFlightClicks,
    waterBursts,
    actionBursts,
    handleGatherWater,
    handleGlobalButtonPop,
  } = useWaterGather(firstResBpUnlocked, applyServerState, setErrorBanner);

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

  // ISOLATED LOOPBACK ADMIN ROUTE (/admin)
  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="loading-shell">
            <div className="loading-box">
              <Droplets size={ICON.lg} />
              <span className="mono-num">加载管理后台</span>
            </div>
          </div>
        }
      >
        <LazyAdminConsoleView
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
      </Suspense>
    );
  }

  // PLAYER AUTHENTICATION SCREEN (/)
  if (!state) {
    return (
      <AuthScreen
        theme={theme}
        setTheme={setTheme}
        errorBanner={errorBanner}
        setErrorBanner={setErrorBanner}
        runAction={runAction}
      />
    );
  }

  const flags = deriveProgressionFlags(state);
  const retainedPortfolio =
    state.player.profession === "none" &&
    (state.economy?.companies?.length ?? 0) > 0;

  if (flags.isOpeningStage) {
    return (
      <>
        <OpeningStageView
          state={state}
          firstResBpUnlocked={flags.firstResBpUnlocked}
          inFlightClicks={inFlightClicks}
          lastSyncAtMs={lastSyncAtMs}
          theme={theme}
          setTheme={setTheme}
          waterBursts={waterBursts}
          onGatherWater={handleGatherWater}
          onGlobalButtonPop={handleGlobalButtonPop}
          onLogout={handleLogout}
          runAction={runAction}
        />
        {retainedPortfolio && (
          <details className="subpanel">
            <summary>跨季公司与股权</summary>
            <CompanyPortfolio state={state} busy={busy} runAction={runAction} />
          </details>
        )}
        <EconomyEvents state={state} />
        {errorBanner && (
          <p role="alert" className="status-banner status-danger economy-toast">
            {errorBanner}
          </p>
        )}
      </>
    );
  }

  const effectiveScene =
    (activeScene === "scout" && !flags.showScoutScene) ||
    ((activeScene === "market" || activeScene === "war") &&
      !flags.showAdvancedWorld) ||
    (activeScene === "lord" && !flags.showLordScene)
      ? "settlement"
      : activeScene;

  const storyChapter = {
    key: state.settlement.guideCode,
    tag: state.settlement.guideTitle,
    text: state.settlement.guideText,
  };
  const currentAckChapterKey = `${state.player.handle}:${flags.showAdvancedWorld ? `profession:${state.player.profession}` : storyChapter.key}`;
  const showCivChapterPopup =
    flags.treasureUnlocked && dismissedChapterKey !== currentAckChapterKey;

  const ackCivChapter = () => {
    setDismissedChapterKey(currentAckChapterKey);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("d2e_ack_chapter", currentAckChapterKey);
    }
  };

  const offlineSummary =
    state.player.offlineAwardSummary &&
    state.player.offlineAwardSummary !== ackedOfflineSummary
      ? state.player.offlineAwardSummary
      : "";
  const bannerMessage = errorBanner || noticeBanner || offlineSummary;

  return (
    <div className="app-shell" onClickCapture={handleGlobalButtonPop}>
      <EconomyEvents key={state.player.handle} state={state} />
      {retainedPortfolio && (
        <details className="subpanel">
          <summary>跨季公司与股权</summary>
          <CompanyPortfolio state={state} busy={busy} runAction={runAction} />
        </details>
      )}
      <ImperialTopHeader
        state={state}
        activeScene={effectiveScene}
        setActiveScene={setActiveScene}
        flags={flags}
        onOpenWorldMap={() => setShowWorldMapModal(true)}
        onOpenAnnouncements={() => setShowAnnouncementModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {bannerMessage && (
        <div
          className={`status-banner economy-toast ${errorBanner ? "status-danger" : "status-info"}`}
          role="status"
        >
          <span>{bannerMessage}</span>
          <button
            type="button"
            className="banner-close"
            onClick={() => {
              setErrorBanner(null);
              setNoticeBanner(null);
              if (state.player.offlineAwardSummary) {
                setAckedOfflineSummary(state.player.offlineAwardSummary);
              }
            }}
          >
            ×
          </button>
        </div>
      )}

      {effectiveScene === "settlement" && (
        <SettlementDashboardView
          key="scene-settlement"
          state={state}
          busy={busy}
          isScopeBusy={isScopeBusy}
          flags={flags}
          inFlightClicks={inFlightClicks}
          lastSyncAtMs={lastSyncAtMs}
          waterBursts={waterBursts}
          storyChapter={storyChapter}
          onGatherWater={handleGatherWater}
          onNavigateScene={setActiveScene}
          runAction={runAction}
        />
      )}

      {effectiveScene === "scout" && flags.showScoutScene && (
        <section
          key="scene-scout"
          className="raid-scene-shell"
          aria-label="荒原裂隙斥候营"
        >
          <WastelandRaidPanel state={state} runAction={runAction} />
        </section>
      )}

      {effectiveScene === "market" && flags.showAdvancedWorld && (
        <div key="scene-market" className="scene-workspace-offset">
          <EconomyWorkspace
            state={state}
            busy={busy}
            runAction={runAction}
            focusItemKey={marketFocusItemKey}
            onClearFocusItem={() => setMarketFocusItemKey(null)}
          />
        </div>
      )}

      {effectiveScene === "war" && flags.showAdvancedWorld && (
        <div key="scene-war" className="scene-workspace-offset">
          <WarGuildSceneView state={state} runAction={runAction} />
        </div>
      )}

      {effectiveScene === "lord" && flags.showLordScene && (
        <div key="scene-lord" className="scene-workspace-offset">
          <SeasonRelicVaultPanel state={state} runAction={runAction} />
        </div>
      )}

      {flags.canNavigateWorld && (
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
              {effectiveScene === "settlement"
                ? "前往疆域 [M]"
                : "切换疆域 [M]"}
            </span>
          </div>
        </button>
      )}

      {showCivChapterPopup && (
        <ModalShell
          ariaLabel="文明纪元推进昭告"
          backdropClassName="modal-backdrop civ-popup-backdrop"
          sheetClassName="civ-popup-card"
          onClose={ackCivChapter}
        >
          <div className="civ-popup-kicker">
            <span className="story-beacon-dot" />
            <span className="story-chapter-tag">{storyChapter.tag}</span>
          </div>
          <div className="civ-popup-silhouette-wrap">
            <CivilizationSilhouetteSVG era={flags.civEra} />
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
              onClick={ackCivChapter}
            >
              <span>铭记史册 · 继续开拓</span>
            </button>
          </div>
        </ModalShell>
      )}

      {showWorldMapModal && flags.canNavigateWorld && (
        <WorldMapCompassModal
          state={state}
          activeScene={effectiveScene}
          showScoutScene={flags.showScoutScene}
          showAdvancedWorld={flags.showAdvancedWorld}
          showLordScene={flags.showLordScene}
          onSelectZone={(z) => setActiveScene(z)}
          onClose={() => setShowWorldMapModal(false)}
        />
      )}

      {showAnnouncementModal && flags.showAdvancedWorld && (
        <ImperialAnnouncementModal
          state={state}
          onClose={() => setShowAnnouncementModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsChronicleModal
          state={state}
          theme={theme}
          storyChapter={storyChapter}
          civEra={flags.civEra}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
          onLogout={() => void handleLogout()}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Global Coordinate-Anchored Tactile Pop Layer */}
      <div className="action-burst-overlay" aria-hidden="true">
        {actionBursts.map((b) => (
          <div
            key={b.id}
            className="action-burst-item"
            ref={(el) => {
              if (el) {
                el.style.setProperty("--burst-x", `${b.x}px`);
                el.style.setProperty("--burst-y", `${b.y}px`);
              }
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
