import { useEffect, useState } from "react";
import { SETTLEMENT_UI_CONFIG } from "../config/gameConfig";

/**
 * Isolates the 150ms continuous resource interpolation clock from the root App tree,
 * preventing 6.6fps full-tree re-renders of static panels and complex SVG avatars.
 */
export function useLiveInterpolation(
  lastSyncAtMs: number,
  speedMultiplier: number,
  enabled: boolean,
): number {
  const [nowTickMs, setNowTickMs] = useState<number>(() => lastSyncAtMs);

  useEffect(() => {
    setNowTickMs(lastSyncAtMs);
  }, [lastSyncAtMs]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      setNowTickMs(Date.now());
    }, SETTLEMENT_UI_CONFIG.interpTickMs);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled) return 0;
  const elapsedSec = Math.max(0, (nowTickMs - lastSyncAtMs) / 1000);
  return (
    Math.min(SETTLEMENT_UI_CONFIG.maxInterpSec, elapsedSec) * speedMultiplier
  );
}
