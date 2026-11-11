import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { api, getCommandSyncOutcome } from "@drop2empire/api-client";
import type { ServerUpdate } from "../serverState";

export interface WaterBurstItem {
  id: number;
  label: string;
}

export interface ActionBurstItem {
  id: number;
  x: number;
  y: number;
  label: string;
}

export interface WaterGatherSessionContext {
  boundSessionToken: string | null;
  playerHandle: string;
  seasonId: string;
  authoritativeClicks: number;
  onSessionMismatch?: () => void;
}

interface ClickBurstState {
  epoch: number;
  scopeKey: string;
  baselineClicks: number;
  sentCount: number;
  failedCount: number;
  activeCount: number;
}

const LEGACY_SCOPE_KEY = "__legacy__";

export function useWaterGather(
  firstResBpUnlocked: boolean,
  applyServerState: (next: ServerUpdate) => void,
  setErrorBanner: (msg: string | null) => void,
  sessionContext?: WaterGatherSessionContext,
) {
  const hasSessionContext = sessionContext !== undefined;
  const boundSessionToken = sessionContext?.boundSessionToken ?? null;
  const playerHandle = sessionContext?.playerHandle ?? "";
  const seasonId = sessionContext?.seasonId ?? "";
  const authoritativeClicks = sessionContext?.authoritativeClicks ?? 0;
  const onSessionMismatch = sessionContext?.onSessionMismatch;

  const scopeKey = hasSessionContext
    ? `${boundSessionToken ?? ""}:${playerHandle}:${seasonId}`
    : LEGACY_SCOPE_KEY;

  const initialBurst: ClickBurstState = {
    epoch: 0,
    scopeKey,
    baselineClicks: authoritativeClicks,
    sentCount: 0,
    failedCount: 0,
    activeCount: 0,
  };

  const [burst, setBurst] = useState<ClickBurstState>(initialBurst);
  const burstRef = useRef<ClickBurstState>(initialBurst);
  const currentScopeKeyRef = useRef<string>(scopeKey);
  const latestContextRef = useRef({
    hasSessionContext,
    boundSessionToken,
    scopeKey,
    authoritativeClicks,
    onSessionMismatch,
  });

  useLayoutEffect(() => {
    latestContextRef.current = {
      hasSessionContext,
      boundSessionToken,
      scopeKey,
      authoritativeClicks,
      onSessionMismatch,
    };
    if (currentScopeKeyRef.current !== scopeKey) {
      currentScopeKeyRef.current = scopeKey;
      const resetBurst: ClickBurstState = {
        epoch: burstRef.current.epoch + 1,
        scopeKey,
        baselineClicks: authoritativeClicks,
        sentCount: 0,
        failedCount: 0,
        activeCount: 0,
      };
      burstRef.current = resetBurst;
      setBurst(resetBurst);
    }
  }, [
    hasSessionContext,
    boundSessionToken,
    scopeKey,
    authoritativeClicks,
    onSessionMismatch,
  ]);

  const [waterBursts, setWaterBursts] = useState<WaterBurstItem[]>([]);
  const [actionBursts, setActionBursts] = useState<ActionBurstItem[]>([]);

  const handleGatherWater = useCallback(() => {
    const ctx = latestContextRef.current;
    const startedToken = api.getSessionToken();
    if (
      ctx.hasSessionContext &&
      ctx.boundSessionToken !== null &&
      startedToken !== ctx.boundSessionToken
    ) {
      ctx.onSessionMismatch?.();
      return;
    }

    setErrorBanner(null);
    const burstId = Date.now() + Math.random();
    const label = `+${firstResBpUnlocked ? 2 : 1}`;
    setWaterBursts((prev) => [...prev.slice(-5), { id: burstId, label }]);
    window.setTimeout(() => {
      setWaterBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 660);

    const prevBurst = burstRef.current;
    const shouldResetBurst =
      prevBurst.scopeKey !== ctx.scopeKey ||
      prevBurst.activeCount === 0 ||
      (ctx.hasSessionContext &&
        ctx.authoritativeClicks < prevBurst.baselineClicks);

    const requestEpoch = shouldResetBurst
      ? prevBurst.epoch + 1
      : prevBurst.epoch;
    const nextBurst: ClickBurstState = shouldResetBurst
      ? {
          epoch: requestEpoch,
          scopeKey: ctx.scopeKey,
          baselineClicks: ctx.authoritativeClicks,
          sentCount: 1,
          failedCount: 0,
          activeCount: 1,
        }
      : {
          ...prevBurst,
          sentCount: prevBurst.sentCount + 1,
          activeCount: prevBurst.activeCount + 1,
        };

    burstRef.current = nextBurst;
    setBurst(nextBurst);

    const startedScopeKey = ctx.scopeKey;
    api
      .gatherWater({ clicks: 1 })
      .then((next) => {
        const outcome = getCommandSyncOutcome(next);
        const isCurrentSession =
          api.getSessionToken() === startedToken &&
          currentScopeKeyRef.current === startedScopeKey;
        if (isCurrentSession) {
          if (
            "player" in next &&
            next.player.totalManualClicks >
              latestContextRef.current.authoritativeClicks
          ) {
            latestContextRef.current = {
              ...latestContextRef.current,
              authoritativeClicks: next.player.totalManualClicks,
            };
          }
          applyServerState(next);
          if (outcome.kind !== "executed") {
            setErrorBanner(outcome.message);
          }
        }

        const cur = burstRef.current;
        if (cur.epoch !== requestEpoch) return;
        const remainingActive = Math.max(0, cur.activeCount - 1);
        const nextFailedCount =
          outcome.kind === "conflict" ? cur.failedCount + 1 : cur.failedCount;
        const settledBurst: ClickBurstState =
          remainingActive === 0
            ? {
                ...cur,
                sentCount: 0,
                failedCount: 0,
                activeCount: 0,
              }
            : {
                ...cur,
                failedCount: nextFailedCount,
                activeCount: remainingActive,
              };
        burstRef.current = settledBurst;
        setBurst(settledBurst);
      })
      .catch((err: unknown) => {
        const cur = burstRef.current;
        if (cur.epoch === requestEpoch) {
          const remainingActive = Math.max(0, cur.activeCount - 1);
          const failedBurst: ClickBurstState =
            remainingActive === 0
              ? {
                  ...cur,
                  sentCount: 0,
                  failedCount: 0,
                  activeCount: 0,
                }
              : {
                  ...cur,
                  failedCount: cur.failedCount + 1,
                  activeCount: remainingActive,
                };
          burstRef.current = failedBurst;
          setBurst(failedBurst);
        }

        const isCurrentSession =
          api.getSessionToken() === startedToken &&
          currentScopeKeyRef.current === startedScopeKey;
        if (isCurrentSession) {
          setErrorBanner(err instanceof Error ? err.message : "请求失败");
        }
      });
  }, [firstResBpUnlocked, applyServerState, setErrorBanner]);

  let inFlightClicks: number;
  if (!hasSessionContext) {
    inFlightClicks = Math.max(0, burst.activeCount);
  } else if (
    burst.scopeKey !== scopeKey ||
    burst.activeCount <= 0 ||
    authoritativeClicks < burst.baselineClicks
  ) {
    inFlightClicks = 0;
  } else {
    const committedDelta = Math.max(
      0,
      authoritativeClicks - burst.baselineClicks,
    );
    const maxPendingValid = Math.max(
      0,
      burst.sentCount - burst.failedCount - committedDelta,
    );
    inFlightClicks = Math.min(burst.activeCount, maxPendingValid);
  }

  const handleGlobalButtonPop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
    },
    [],
  );

  return {
    inFlightClicks,
    waterBursts,
    actionBursts,
    handleGatherWater,
    handleGlobalButtonPop,
  };
}
