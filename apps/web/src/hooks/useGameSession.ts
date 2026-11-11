import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  getCommandSyncOutcome,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import {
  applySnapshotUpdate,
  belongsToSession,
  type ClientSessionSnapshot,
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
  const [snapshot, setSnapshot] = useState<ClientSessionSnapshot | null>(null);
  const [fallbackSyncMs] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingScopes, setPendingScopes] = useState<Record<string, number>>(
    {},
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  const sessionEpochRef = useRef(0);
  const activeTokenRef = useRef<string | null>(api.getSessionToken());
  const boundTokenRef = useRef<string | null>(null);
  const localAuthInFlightRef = useRef(0);

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

  const applyServerStateForSession = useCallback(
    (next: ServerUpdate, sessionToken: string | null) => {
      const nowMs = Date.now();
      activeTokenRef.current = sessionToken;
      boundTokenRef.current = sessionToken;
      setSnapshot((current) =>
        applySnapshotUpdate(current, next, sessionToken, nowMs),
      );
    },
    [],
  );

  const loadSessionDashboard = useCallback(
    (token: string | null, epoch: number) => {
      if (!token) {
        setSnapshot(null);
        boundTokenRef.current = null;
        setLoading(false);
        return;
      }
      setLoading(true);
      api
        .getDashboard()
        .then((res) => {
          if (
            sessionEpochRef.current !== epoch ||
            api.getSessionToken() !== token
          ) {
            return;
          }
          applyServerStateForSession(res, token);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (
            sessionEpochRef.current !== epoch ||
            api.getSessionToken() !== token
          ) {
            return;
          }
          if (err instanceof ApiError && err.status === 401) {
            localAuthInFlightRef.current += 1;
            try {
              api.setSessionToken(null);
            } finally {
              localAuthInFlightRef.current = Math.max(
                0,
                localAuthInFlightRef.current - 1,
              );
            }
            activeTokenRef.current = null;
            boundTokenRef.current = null;
            setSnapshot(null);
          } else {
            setErrorBanner(err instanceof Error ? err.message : "加载失败");
          }
          setLoading(false);
        });
    },
    [applyServerStateForSession],
  );

  const reconcileExternalSession = useCallback(
    (nextToken: string | null, bannerMsg?: string) => {
      sessionEpochRef.current += 1;
      const nextEpoch = sessionEpochRef.current;
      activeTokenRef.current = nextToken;
      boundTokenRef.current = null;
      setSnapshot(null);
      setPendingScopes({});
      setBusy(false);
      setNoticeBanner(null);
      setShowSettingsModal(false);
      setShowAnnouncementModal(false);
      setShowWorldMapModal(false);
      setErrorBanner(bannerMsg ?? null);
      loadSessionDashboard(nextToken, nextEpoch);
    },
    [loadSessionDashboard],
  );

  const reconcileSessionMismatch = useCallback(() => {
    const liveToken = api.getSessionToken();
    reconcileExternalSession(
      liveToken,
      liveToken
        ? "当前会话已在其他页面切换，已同步最新账号状态，请确认后重试"
        : "当前登录会话已退出，请重新登录",
    );
  }, [reconcileExternalSession]);

  const applyServerState = useCallback(
    (next: ServerUpdate) => {
      const liveToken = api.getSessionToken();
      if (boundTokenRef.current !== null && liveToken !== boundTokenRef.current) {
        reconcileExternalSession(liveToken);
        return;
      }
      const resolvedToken =
        ("player" in next && next.sessionToken ? next.sessionToken : null) ??
        liveToken;
      applyServerStateForSession(next, resolvedToken);
    },
    [applyServerStateForSession, reconcileExternalSession],
  );

  useEffect(() => {
    const initialToken = api.getSessionToken();
    activeTokenRef.current = initialToken;
    const epoch = sessionEpochRef.current;
    loadSessionDashboard(initialToken, epoch);
    return () => {
      sessionEpochRef.current += 1;
    };
  }, [loadSessionDashboard]);

  useEffect(() => {
    return api.subscribeSession((nextToken, source) => {
      if (source === "local" && localAuthInFlightRef.current > 0) return;
      if (nextToken === activeTokenRef.current) return;
      reconcileExternalSession(nextToken);
    });
  }, [reconcileExternalSession]);

  const state: DashboardStateResp | null = snapshot?.state ?? null;
  const boundSessionToken: string | null = snapshot?.sessionToken ?? null;
  const lastSyncAtMs: number = snapshot?.lastSyncAtMs ?? fallbackSyncMs;
  const raidSyncedAtMs: number = snapshot?.raidSyncedAtMs ?? lastSyncAtMs;

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
    if (!hasState) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const liveToken = api.getSessionToken();
      if (liveToken !== boundTokenRef.current) {
        reconcileExternalSession(liveToken);
        return;
      }
      if (!hasActivePopulation || raidActive) return;
      const epoch = sessionEpochRef.current;
      api
        .getDashboard()
        .then((res) => {
          if (
            sessionEpochRef.current === epoch &&
            api.getSessionToken() === liveToken
          ) {
            applyServerStateForSession(res, liveToken);
          }
        })
        .catch(() => {});
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    if (!hasActivePopulation || raidActive) {
      return () => {
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisibility);
        }
      };
    }

    const syncNow = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      const liveToken = api.getSessionToken();
      if (liveToken !== boundTokenRef.current) {
        reconcileExternalSession(liveToken);
        return;
      }
      if (!liveToken) return;
      const epoch = sessionEpochRef.current;
      api
        .getDashboard()
        .then((res) => {
          if (
            sessionEpochRef.current === epoch &&
            api.getSessionToken() === liveToken
          ) {
            applyServerStateForSession(res, liveToken);
          }
        })
        .catch(() => {});
    };

    const timer = window.setInterval(
      syncNow,
      SETTLEMENT_UI_CONFIG.syncPollIntervalMs,
    );
    return () => {
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
    boundSessionToken,
    applyServerStateForSession,
    reconcileExternalSession,
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
      const liveToken = api.getSessionToken();
      if (
        boundTokenRef.current !== null &&
        liveToken !== boundTokenRef.current
      ) {
        reconcileSessionMismatch();
        return;
      }

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

      const startedEpoch = sessionEpochRef.current;
      const startedToken = liveToken;
      const isAuthBootstrap = boundTokenRef.current === null;
      if (isAuthBootstrap) {
        localAuthInFlightRef.current += 1;
      }

      try {
        const next = await fn();
        const currentToken = api.getSessionToken();
        if (sessionEpochRef.current !== startedEpoch) return;
        if (!belongsToSession(next, startedToken, currentToken)) {
          if (currentToken !== startedToken) {
            reconcileExternalSession(currentToken);
          }
          return;
        }
        const resolvedToken =
          ("player" in next && next.sessionToken ? next.sessionToken : null) ??
          currentToken;
        applyServerStateForSession(next, resolvedToken);

        const outcome = getCommandSyncOutcome(next);
        if (outcome.kind !== "executed") {
          setErrorBanner(outcome.message);
        } else if (successMsg) {
          setNoticeBanner(successMsg);
        }
      } catch (err: unknown) {
        if (sessionEpochRef.current !== startedEpoch) return;
        const currentToken = api.getSessionToken();
        if (currentToken !== startedToken) {
          reconcileExternalSession(currentToken);
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          localAuthInFlightRef.current += 1;
          try {
            api.setSessionToken(null);
          } finally {
            localAuthInFlightRef.current = Math.max(
              0,
              localAuthInFlightRef.current - 1,
            );
          }
          sessionEpochRef.current += 1;
          activeTokenRef.current = null;
          boundTokenRef.current = null;
          setSnapshot(null);
          setPendingScopes({});
          setBusy(false);
          setErrorBanner(err.message);
        } else if (err instanceof Error) {
          setErrorBanner(err.message);
        } else {
          setErrorBanner("操作未完成");
        }
      } finally {
        if (isAuthBootstrap) {
          localAuthInFlightRef.current = Math.max(
            0,
            localAuthInFlightRef.current - 1,
          );
        }
        if (sessionEpochRef.current === startedEpoch) {
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
      }
    },
    [
      applyServerStateForSession,
      reconcileExternalSession,
      reconcileSessionMismatch,
    ],
  );

  const isScopeBusy = useCallback(
    (scope: string) => busy || Boolean(pendingScopes[scope]),
    [busy, pendingScopes],
  );

  const handleLogout = useCallback(async () => {
    sessionEpochRef.current += 1;
    const logoutEpoch = sessionEpochRef.current;
    setBusy(true);
    localAuthInFlightRef.current += 1;
    try {
      await api.logoutAccount();
    } finally {
      localAuthInFlightRef.current = Math.max(
        0,
        localAuthInFlightRef.current - 1,
      );
      if (sessionEpochRef.current === logoutEpoch) {
        activeTokenRef.current = null;
        boundTokenRef.current = null;
        setSnapshot(null);
        setPendingScopes({});
        setShowSettingsModal(false);
        setShowAnnouncementModal(false);
        setShowWorldMapModal(false);
        setNoticeBanner(null);
        setErrorBanner(null);
        setBusy(false);
      }
    }
  }, []);

  return {
    state,
    boundSessionToken,
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
    reconcileSessionMismatch,
    runAction,
    handleLogout,
    lastSyncAtMs,
    raidSyncedAtMs,
  };
}
