import { useCallback, useState } from "react";
import { api } from "@drop2empire/api-client";
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

export function useWaterGather(
  firstResBpUnlocked: boolean,
  applyServerState: (next: ServerUpdate) => void,
  setErrorBanner: (msg: string | null) => void,
) {
  const [inFlightClicks, setInFlightClicks] = useState(0);
  const [waterBursts, setWaterBursts] = useState<WaterBurstItem[]>([]);
  const [actionBursts, setActionBursts] = useState<ActionBurstItem[]>([]);

  const handleGatherWater = useCallback(() => {
    const token = api.getSessionToken();
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
        if (api.getSessionToken() !== token) return;
        applyServerState(next);
      })
      .catch((err: unknown) => {
        setInFlightClicks((prev) => Math.max(0, prev - 1));
        setErrorBanner(err instanceof Error ? err.message : "请求失败");
      });
  }, [firstResBpUnlocked, applyServerState, setErrorBanner]);

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
