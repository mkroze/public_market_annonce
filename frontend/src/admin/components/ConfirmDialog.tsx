import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmConfig {
  title: string;
  action: string;          // exact action, e.g. "Suspend user"
  target: string;          // target name or count
  consequence: ReactNode;  // what will happen
  reversible: boolean;
  confirmLabel: string;    // final button label, e.g. "Suspend user"
  danger?: boolean;
  // If set, the user must type this string to enable the confirm button.
  typedConfirmation?: string;
  onConfirm: () => void | Promise<void>;
}

interface Props {
  config: ConfirmConfig | null;
  onClose: () => void;
}

export default function ConfirmDialog({ config, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!config) return;
    setTyped("");
    setPending(false);
    previousFocus.current = document.activeElement as HTMLElement;
    // Focus the confirm button (or the input if typed confirmation is required).
    const t = setTimeout(() => {
      const el = config.typedConfirmation
        ? dialogRef.current?.querySelector<HTMLInputElement>("input")
        : confirmRef.current;
      el?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      previousFocus.current?.focus(); // focus return
    };
  }, [config]);

  useEffect(() => {
    if (!config) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [config, onClose]);

  if (!config) return null;

  const confirmDisabled =
    pending || (!!config.typedConfirmation && typed !== config.typedConfirmation);

  async function handleConfirm() {
    if (confirmDisabled || !config) return;
    setPending(true);
    try {
      await config.onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-md bg-base-100 border border-[var(--color-border-subtle)] rounded shadow-lg p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          {config.danger && (
            <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--color-crimson)] mt-0.5" aria-hidden />
          )}
          <h2 id="confirm-title" className="font-display text-lg text-[var(--color-charcoal)]">
            {config.title}
          </h2>
        </div>

        <div id="confirm-body" className="text-sm font-sans text-[var(--color-charcoal)] space-y-2">
          <p><span className="text-[var(--color-slate)]">Action:</span> {config.action}</p>
          <p><span className="text-[var(--color-slate)]">Target:</span> {config.target}</p>
          <p><span className="text-[var(--color-slate)]">Consequence:</span> {config.consequence}</p>
          <p>
            <span className="text-[var(--color-slate)]">Reversible:</span>{" "}
            {config.reversible ? "Yes" : "No — this cannot be undone"}
          </p>
        </div>

        {config.typedConfirmation && (
          <div className="mt-4">
            <label className="block text-sm font-sans text-[var(--color-slate)] mb-1">
              Type <span className="font-semibold text-[var(--color-charcoal)]">{config.typedConfirmation}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] rounded"
              aria-label="Type to confirm"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 text-sm font-sans font-semibold rounded text-white focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              config.danger
                ? "bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-dark)] focus-visible:ring-[var(--color-crimson)]"
                : "bg-[var(--color-charcoal)] hover:opacity-90 focus-visible:ring-[var(--color-charcoal)]"
            }`}
          >
            {pending ? "Working…" : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
