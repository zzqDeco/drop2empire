import { useEffect, useRef, useState } from "react";
import type { DashboardStateResp } from "@drop2empire/api-client";

export function EconomyEvents({ state }: { state: DashboardStateResp }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const events = state.eventLogs
    .filter((e) => e.category === "IPO" || e.category === "GOVERNANCE")
    .slice()
    .reverse();
  const key = `d2e-economy-events:${state.player.handle}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  });
  const pending = events.filter((e) => !dismissed.includes(e.id));
  const event = pending[0];
  const active = Boolean(event);
  useEffect(() => {
    const element = dialog.current;
    if (active && element && !element.open) element.showModal();
  }, [active, event?.id]);
  const dismiss = () => {
    if (!event) return;
    const next = [...dismissed, event.id].slice(-200);
    setDismissed(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
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
      {pending.length > 1 && (
        <p>
          还有 <span className="mono-num">{pending.length - 1}</span> 条未读事件
        </p>
      )}
      <button className="btn-primary" onClick={dismiss}>
        知道了
      </button>
    </dialog>
  );
}
