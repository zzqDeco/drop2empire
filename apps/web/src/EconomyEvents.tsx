import { useEffect, useRef, useState } from "react";
import type { DashboardStateResp } from "@drop2empire/api-client";

export function EconomyEvents({ state }: { state: DashboardStateResp }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const event = state.eventLogs.find(
    (e) => e.category === "IPO" || e.category === "GOVERNANCE",
  );
  const key = `d2e-economy-event:${state.player.handle}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  });
  const active = Boolean(event && dismissed !== event.id);
  useEffect(() => {
    const element = dialog.current;
    if (active && element && !element.open) element.showModal();
  }, [active, event?.id]);
  const dismiss = () => {
    if (!event) return;
    setDismissed(event.id);
    try {
      localStorage.setItem(key, event.id);
    } catch {
      /* In-memory acknowledgement remains available. */
    }
    dialog.current?.close();
  };
  if (!event || !active) return null;
  return (
    <dialog
      ref={dialog}
      className="economy-dialog"
      aria-labelledby="economy-event-title"
      onCancel={dismiss}
    >
      <h2 id="economy-event-title">
        {event.category === "IPO" ? "公司事件" : "股东决策"}
      </h2>
      <p>{event.message}</p>
      <button className="btn-primary" onClick={dismiss}>
        知道了
      </button>
    </dialog>
  );
}
