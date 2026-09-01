import type { ReactNode } from "react";
import { Loader2, Inbox, SearchX, ShieldAlert, AlertTriangle, RefreshCw } from "lucide-react";

function Wrap({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-1.5 py-10 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-ivory-dim)] text-[var(--color-primary)]">
        {icon}
      </div>
      <p className="font-sans font-bold text-[var(--color-charcoal)]">{title}</p>
      {children && <div className="text-sm font-sans text-[var(--color-slate)] max-w-md">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <Wrap icon={<Loader2 className="w-6 h-6 motion-safe:animate-spin" aria-hidden />} title={label}>
      <span className="sr-only">{label}</span>
    </Wrap>
  );
}

export function EmptyState({ title = "No data yet", hint }: { title?: string; hint?: string }) {
  return <Wrap icon={<Inbox className="w-6 h-6" aria-hidden />} title={title}>{hint}</Wrap>;
}

export function FilteredEmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <Wrap icon={<SearchX className="w-6 h-6" aria-hidden />} title="No results match your filters">
      {onReset && (
        <button
          onClick={onReset}
          className="mt-2 px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] transition-colors"
        >
          Clear filters
        </button>
      )}
    </Wrap>
  );
}

export function DeniedState({ message }: { message?: string }) {
  return (
    <Wrap icon={<ShieldAlert className="w-6 h-6 text-[var(--color-crimson)]" aria-hidden />} title="Access denied">
      {message || "You do not have permission to view this resource."}
    </Wrap>
  );
}

export function FailedState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Wrap icon={<AlertTriangle className="w-6 h-6 text-[var(--color-crimson)]" aria-hidden />} title="Failed to load">
      <p>{message || "Something went wrong."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" aria-hidden /> Retry
        </button>
      )}
    </Wrap>
  );
}
