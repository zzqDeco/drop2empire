import { useEffect, useRef, useState, type ReactNode } from "react";
import { Shield } from "lucide-react";
import { ICON } from "../icons";

interface ModalShellProps {
  ariaLabel: string;
  backdropClassName?: string;
  sheetClassName?: string;
  onClose?: () => void;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true",
  );
}

export function ModalShell({
  ariaLabel,
  backdropClassName = "modal-backdrop",
  sheetClassName = "modal-sheet",
  onClose,
  children,
}: ModalShellProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (
      sheetRef.current &&
      !sheetRef.current.contains(document.activeElement)
    ) {
      sheetRef.current.focus();
    }

    const isTopmostModal = () => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      return (
        dialogs.length === 0 ||
        dialogs[dialogs.length - 1] === backdropRef.current
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmostModal()) return;
      if (e.key === "Escape" && onCloseRef.current) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const sheet = sheetRef.current;
        const focusables = getFocusableElements(sheet);
        if (focusables.length === 0) {
          e.preventDefault();
          sheet.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || active === sheet || !sheet.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !sheet.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (!isTopmostModal() || !sheetRef.current) return;
      const sheet = sheetRef.current;
      if (e.target instanceof Node && !sheet.contains(e.target)) {
        const focusables = getFocusableElements(sheet);
        (focusables[0] ?? sheet).focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.style.overflow = prevOverflow;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <div
      ref={backdropRef}
      className={backdropClassName}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div ref={sheetRef} className={sheetClassName} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

interface ConfirmActionModalProps {
  title: string;
  subtitle?: string;
  severity?: "warning" | "danger";
  consequences: string[];
  confirmLabel: string;
  cancelLabel?: string;
  requireMatchText?: string;
  requireMatchHint?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  title,
  subtitle,
  severity = "warning",
  consequences,
  confirmLabel,
  cancelLabel = "取消操作",
  requireMatchText,
  requireMatchHint,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  const [typedText, setTypedText] = useState("");
  const matchOk = !requireMatchText || typedText.trim() === requireMatchText;

  return (
    <ModalShell
      ariaLabel={title}
      backdropClassName="modal-backdrop confirm-modal-backdrop"
      sheetClassName="modal-sheet confirm-modal-sheet"
      onClose={busy ? undefined : onCancel}
    >
      <div className="modal-header">
        <div>
          <span
            className={`tag-badge ${severity === "danger" ? "cost-lack" : "tag-warning"}`}
          >
            <Shield size={ICON.xs} />
            <span>
              {severity === "danger" ? "不可逆高危操作核验" : "重要决策确认"}
            </span>
          </span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="confirm-modal-body">
        <ul className="confirm-consequence-list">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {requireMatchText && (
          <label className="confirm-match-box">
            <span>
              {requireMatchHint ?? `请输入「${requireMatchText}」以确认执行：`}
            </span>
            <input
              type="text"
              className="mono-num"
              placeholder={requireMatchText}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
            />
          </label>
        )}

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              severity === "danger" ? "btn-danger-solid" : "btn-primary"
            }
            disabled={busy || !matchOk}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
