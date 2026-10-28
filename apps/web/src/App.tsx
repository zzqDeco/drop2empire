import { useMemo, useState } from "react";
import { Compass, Droplets } from "lucide-react";
import { ICON } from "./icons";
import { CivilizationSilhouetteSVG } from "./RaidSpritesSVG";
import { WastelandRaidPanel } from "./WastelandRaidPanel";
import { AdminConsoleView } from "./AdminConsoleView";
import {
  ImperialAnnouncementModal,
  MarketSceneView,
  SeasonRelicVaultPanel,
  SettingsChronicleModal,
  WarGuildSceneView,
  WorldMapCompassModal,
} from "./MacroEmpireWorkspace";
import { useGameSession } from "./hooks/useGameSession";
import { useWaterGather } from "./hooks/useWaterGather";
import {
  computeLiveWaterMetrics,
  deriveProgressionFlags,
} from "./domain/settlementSelectors";
import { AuthScreen } from "./features/auth/AuthScreen";
import { OpeningStageView } from "./features/settlement/OpeningStageView";
import { ImperialTopHeader } from "./features/settlement/ImperialTopHeader";
import { SettlementDashboardView } from "./features/settlement/SettlementDashboardView";

export function App() {
  const isAdminRoute = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin") ||
        window.location.hash.startsWith("#/admin")),
    [],
  );

  const [dismissedChapterKey, setDismissedChapterKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("d2e_ack_chapter") ?? "";
  });

  const {
    state,
    loading,
    busy,
    errorBanner,
    noticeBanner,
    setErrorBanner,
    setNoticeBanner,
    theme,
    setTheme,
    activeScene,
    setActiveScene,
    showSettingsModal,
    setShowSettingsModal,
    showAnnouncementModal,
    setShowAnnouncementModal,
    showWorldMapModal,
    setShowWorldMapModal,
    applyServerState,
    runAction,
    handleLogout,
    interpSeconds,
  } = useGameSession(isAdminRoute);

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

  // ISOLATED ADMIN ROUTE (/admin)
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
  const {
    waterRes,
    liveWaterMilli,
    hasAnyWaterYet,
    canSeeFirstRecruit,
    firstTenProgressPct,
  } = computeLiveWaterMetrics(
    state,
    flags.firstResBpUnlocked,
    inFlightClicks,
    interpSeconds,
  );

  if (flags.isOpeningStage) {
    return (
      <OpeningStageView
        handle={state.player.handle}
        theme={theme}
        setTheme={setTheme}
        liveWaterMilli={liveWaterMilli}
        hasAnyWaterYet={hasAnyWaterYet}
        canSeeFirstRecruit={canSeeFirstRecruit}
        firstTenProgressPct={firstTenProgressPct}
        waterBursts={waterBursts}
        onGatherWater={handleGatherWater}
        onGlobalButtonPop={handleGlobalButtonPop}
        onLogout={handleLogout}
        runAction={runAction}
      />
    );
  }

  const storyChapter = {
    key: state.settlement.guideCode,
    tag: state.settlement.guideTitle,
    text: state.settlement.guideText,
  };
  const currentAckChapterKey = `${state.player.handle}:${storyChapter.key}`;
  const showCivChapterPopup =
    flags.treasureUnlocked && dismissedChapterKey !== currentAckChapterKey;

  return (
    <div className="app-shell" onClickCapture={handleGlobalButtonPop}>
      <ImperialTopHeader
        state={state}
        activeScene={activeScene}
        setActiveScene={setActiveScene}
        showAdvancedWorld={flags.showAdvancedWorld}
        treasureUnlocked={flags.treasureUnlocked}
        onOpenAnnouncements={() => setShowAnnouncementModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {(errorBanner || noticeBanner || state.player.offlineAwardSummary) && (
        <div
          className={`status-banner ${errorBanner ? "status-danger" : "status-info"}`}
          role="status"
        >
          <span>
            {errorBanner || noticeBanner || state.player.offlineAwardSummary}
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

      {activeScene === "settlement" && (
        <SettlementDashboardView
          key="scene-settlement"
          state={state}
          busy={busy}
          flags={flags}
          waterRes={waterRes}
          liveWaterMilli={liveWaterMilli}
          interpSeconds={interpSeconds}
          waterBursts={waterBursts}
          storyChapter={storyChapter}
          onGatherWater={handleGatherWater}
          runAction={runAction}
        />
      )}

      {activeScene === "scout" && flags.showScoutScene && (
        <section
          key="scene-scout"
          className="raid-scene-shell"
          aria-label="荒原裂隙斥候营"
        >
          <WastelandRaidPanel state={state} runAction={runAction} />
        </section>
      )}

      {activeScene === "market" && flags.showAdvancedWorld && (
        <div key="scene-market" className="scene-workspace-offset">
          <MarketSceneView state={state} runAction={runAction} />
        </div>
      )}

      {activeScene === "war" && flags.showAdvancedWorld && (
        <div key="scene-war" className="scene-workspace-offset">
          <WarGuildSceneView state={state} runAction={runAction} />
        </div>
      )}

      {activeScene === "lord" && flags.showLordScene && (
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
              {activeScene === "settlement" ? "前往疆域 [M]" : "切换疆域 [M]"}
            </span>
          </div>
        </button>
      )}

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

      {showWorldMapModal && flags.canNavigateWorld && (
        <WorldMapCompassModal
          state={state}
          activeScene={activeScene}
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
