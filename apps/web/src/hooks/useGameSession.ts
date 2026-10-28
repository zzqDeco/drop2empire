import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type DashboardStateResp } from "@drop2empire/api-client";
import { belongsToSession, mergeServerUpdate, type ServerUpdate } from "../serverState";
import { SETTLEMENT_UI_CONFIG } from "../config/gameConfig";
import { applyTheme, getInitialTheme, type ThemeMode } from "../theme";
import type { WorldZoneKey } from "../features/macro/types";

export function useGameSession(isAdminRoute: boolean) {
  const [state, setState] = useState<DashboardStateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [activeScene, setActiveScene] = useState<WorldZoneKey>("settlement");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showWorldMapModal, setShowWorldMapModal] = useState(false);

  const [lastSyncAtMs, setLastSyncAtMs] = useState<number>(() => Date.now());
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const applyServerState = useCallback((next: ServerUpdate) => {
    setState((current) => mergeServerUpdate(current, next));
    if ("player" in next) {
      setLastSyncAtMs(Date.now());
      setNowTickMs(Date.now());
    }
  }, []);

  useEffect(() => {
    let active = true;
    const token = api.getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getDashboard()
      .then((res) => {
        if (!active || api.getSessionToken() !== token) return;
        applyServerState(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || api.getSessionToken() !== token) return;
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
  const raidActive = !!state?.raidLoadout.activeSession;
  const canNavigateWorld =
    !!state &&
    (state.player.profession !== "none" ||
      state.blueprints.some((b) => b.code === "scout_camp" && b.unlocked) ||
      state.cosmetics.some((c) => c.ownedCount > 0) ||
      state.collectibles.length > 0);

  useEffect(() => {
    if (!hasState || !hasActivePopulation || raidActive) return;
    let active = true;
    const token = api.getSessionToken();
    const timer = window.setInterval(() => {
      api
        .getDashboard()
        .then((res) => {
          if (active && api.getSessionToken() === token) applyServerState(res);
        })
        .catch(() => {});
    }, SETTLEMENT_UI_CONFIG.syncPollIntervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasState, hasActivePopulation, activeHandle, raidActive, applyServerState]);

  useEffect(() => {
    if (!hasState || !hasActivePopulation || raidActive || activeScene !== "settlement") return;
    const id = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, SETTLEMENT_UI_CONFIG.interpTickMs);
    return () => window.clearInterval(id);
  }, [hasState, hasActivePopulation, raidActive, activeScene]);

  useEffect(() => {
    if (!hasState || !hasActivePopulation || !canNavigateWorld || raidActive || isAdminRoute) return;
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
  }, [hasState, hasActivePopulation, canNavigateWorld, raidActive, isAdminRoute]);

  const runAction = useCallback(
    async (fn: () => Promise<ServerUpdate>, successMsg?: string) => {
      setErrorBanner(null);
      setBusy(true);
      const token = api.getSessionToken();
      try {
        const next = await fn();
        if (!belongsToSession(next, token, api.getSessionToken())) return;
        applyServerState(next);
        if (successMsg) {
          setNoticeBanner(successMsg);
        }
      } catch (err: unknown) {
        if (api.getSessionToken() !== token) return;
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

  const handleLogout = useCallback(async () => {
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
  }, []);

  const interpSeconds = useMemo(() => {
    if (!state) return 0;
    const elapsedSec = Math.max(0, (nowTickMs - lastSyncAtMs) / 1000);
    return (
      Math.min(SETTLEMENT_UI_CONFIG.maxInterpSec, elapsedSec) *
      state.player.speedMultiplier
    );
  }, [state, nowTickMs, lastSyncAtMs]);

  return {
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
  };
}
