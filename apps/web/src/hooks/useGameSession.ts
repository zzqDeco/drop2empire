import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import {
  belongsToSession,
  mergeServerUpdate,
  type ServerUpdate,
} from "../serverState";
import { SETTLEMENT_UI_CONFIG } from "../config/gameConfig";
import { applyTheme, getInitialTheme, type ThemeMode } from "../theme";
import type { WorldZoneKey } from "../features/macro/types";

const VALID_SCENES = new Set<WorldZoneKey>([
  "settlement",
  "scout",
  "market",
  "war",
  "lord",
]);

export function parseHashRoute(hash: string): {
  scene: WorldZoneKey;
  marketItem?: string;
} {
  const cleaned = hash.replace(/^#\/?/, "").trim();
  if (!cleaned || cleaned.startsWith("admin")) {
    return { scene: "settlement" };
  }
  const sepIdx = cleaned.indexOf(":");
  const rawScene = sepIdx >= 0 ? cleaned.slice(0, sepIdx) : cleaned;
  const rawParam = sepIdx >= 0 ? cleaned.slice(sepIdx + 1) : "";
  if (VALID_SCENES.has(rawScene as WorldZoneKey)) {
    let marketItem: string | undefined;
    if (rawParam) {
      try {
        marketItem = decodeURIComponent(rawParam);
      } catch {
        marketItem = undefined;
      }
    }
    return {
      scene: rawScene as WorldZoneKey,
      marketItem,
    };
  }
  return { scene: "settlement" };
}

export function useGameSession(isAdminRoute: boolean) {
  const [state, setState] = useState<DashboardStateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingScopes, setPendingScopes] = useState<Record<string, number>>(
    {},
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  const initialRoute =
    typeof window !== "undefined" && !isAdminRoute
      ? parseHashRoute(window.location.hash)
      : { scene: "settlement" as WorldZoneKey };

  const [activeScene, setActiveSceneState] = useState<WorldZoneKey>(
    initialRoute.scene,
  );
  const [marketFocusItemKey, setMarketFocusItemKey] = useState<string | null>(
    initialRoute.marketItem ?? null,
  );

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showWorldMapModal, setShowWorldMapModal] = useState(false);

  const [lastSyncAtMs, setLastSyncAtMs] = useState<number>(() => Date.now());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!noticeBanner) return;
    const timer = window.setTimeout(() => setNoticeBanner(null), 5000);
    return () => window.clearTimeout(timer);
  }, [noticeBanner]);

  const setActiveScene = useCallback(
    (scene: WorldZoneKey, marketItem?: string) => {
      setActiveSceneState(scene);
      if (marketItem) {
        setMarketFocusItemKey(marketItem);
      }
      if (typeof window !== "undefined" && !isAdminRoute) {
        const nextHash =
          scene === "market" && marketItem
            ? `#market:${encodeURIComponent(marketItem)}`
            : `#${scene}`;
        if (window.location.hash !== nextHash) {
          window.history.pushState(null, "", nextHash);
        }
      }
    },
    [isAdminRoute],
  );

  useEffect(() => {
    if (typeof window === "undefined" || isAdminRoute) return;
    const onHashOrPop = () => {
      if (showWorldMapModal) {
        setShowWorldMapModal(false);
      }
      if (showAnnouncementModal) {
        setShowAnnouncementModal(false);
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
      }
      const parsed = parseHashRoute(window.location.hash);
      setActiveSceneState(parsed.scene);
      if (parsed.marketItem) {
        setMarketFocusItemKey(parsed.marketItem);
      }
    };
    window.addEventListener("popstate", onHashOrPop);
    window.addEventListener("hashchange", onHashOrPop);
    return () => {
      window.removeEventListener("popstate", onHashOrPop);
      window.removeEventListener("hashchange", onHashOrPop);
    };
  }, [
    isAdminRoute,
    showWorldMapModal,
    showAnnouncementModal,
    showSettingsModal,
  ]);

  const applyServerState = useCallback((next: ServerUpdate) => {
    setState((current) => mergeServerUpdate(current, next));
    if ("player" in next) {
      setLastSyncAtMs(Date.now());
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

    const syncNow = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      api
        .getDashboard()
        .then((res) => {
          if (active && api.getSessionToken() === token) applyServerState(res);
        })
        .catch(() => {});
    };

    const timer = window.setInterval(
      syncNow,
      SETTLEMENT_UI_CONFIG.syncPollIntervalMs,
    );
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncNow();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      active = false;
      window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [
    hasState,
    hasActivePopulation,
    activeHandle,
    raidActive,
    applyServerState,
  ]);

  useEffect(() => {
    if (
      !hasState ||
      !hasActivePopulation ||
      !canNavigateWorld ||
      raidActive ||
      isAdminRoute
    )
      return;
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
  }, [
    hasState,
    hasActivePopulation,
    canNavigateWorld,
    raidActive,
    isAdminRoute,
  ]);

  const runAction = useCallback(
    async (
      fn: () => Promise<ServerUpdate>,
      successMsg?: string,
      actionScope?: string,
    ) => {
      setErrorBanner(null);
      setNoticeBanner(null);
      if (actionScope) {
        setPendingScopes((prev) => ({
          ...prev,
          [actionScope]: (prev[actionScope] ?? 0) + 1,
        }));
      } else {
        setBusy(true);
      }
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
        if (actionScope) {
          setPendingScopes((prev) => {
            const nextCount = (prev[actionScope] ?? 1) - 1;
            if (nextCount <= 0) {
              const rest = { ...prev };
              delete rest[actionScope];
              return rest;
            }
            return { ...prev, [actionScope]: nextCount };
          });
        } else {
          setBusy(false);
        }
      }
    },
    [applyServerState],
  );

  const isScopeBusy = useCallback(
    (scope: string) => busy || Boolean(pendingScopes[scope]),
    [busy, pendingScopes],
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

  return {
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
  };
}
