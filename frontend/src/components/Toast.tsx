import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export interface ToastData {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const BORDER_COLORS = {
  success: "border-l-green-600",
  error: "border-l-[var(--color-crimson)]",
  info: "border-l-[var(--color-gold)]",
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const exitTimer = setTimeout(() => setExiting(true), duration - 300);
    const removeTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-center gap-3 px-4 py-3
        bg-base-100 border border-[var(--color-border-subtle)] border-l-4 ${BORDER_COLORS[toast.type]}
        rounded shadow-sm
        transition-all duration-300 ease-out
        ${exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
    >
      <Icon size={18} className="shrink-0 text-[var(--color-charcoal)]" />
      <span className="text-sm font-sans font-medium text-[var(--color-charcoal)] flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="btn btn-ghost btn-xs btn-circle text-[var(--color-slate)]"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

let toastCounter = 0;
export function createToast(message: string, type: ToastData["type"] = "info", duration?: number): ToastData {
  return { id: `toast-${++toastCounter}`, message, type, duration };
}
