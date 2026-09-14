import { useState, type ReactNode, type ElementType } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-xl text-[var(--color-charcoal)]">{title}</h1>
        {description && <p className="text-sm font-sans text-[var(--color-slate)] mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-[var(--color-border-subtle)] rounded-xl bg-base-100 shadow-card ${className}`}>
      {title && (
        <div className="px-4 py-2.5 border-b border-[var(--color-border-subtle)]">
          <h2 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label, value, sub, tone = "neutral", onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  onClick?: () => void;
}) {
  const border =
    tone === "danger" ? "border-l-[var(--color-crimson)]"
    : tone === "warning" ? "border-l-[var(--color-gold)]"
    : "border-l-[var(--color-border)]";
  const Comp: ElementType = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`text-left w-full border border-[var(--color-border-subtle)] border-l-4 ${border} rounded-xl bg-base-100 shadow-card px-4 py-3.5 ${
        onClick ? "hover:border-[var(--color-primary)] hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] transition-all" : ""
      }`}
    >
      <div className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-[var(--color-slate)]">{label}</div>
      <div className="text-[26px] font-bold leading-tight text-[var(--color-charcoal)] tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs font-sans text-[var(--color-muted-light)] mt-1.5">{sub}</div>}
    </Comp>
  );
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function fmtDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { dateStyle: "short" });
}

// Elapsed time of a run (shared by all three pipeline history tables).
export function duration(run: { started_at: string; finished_at: string | null }): string {
  if (!run.finished_at) return "—";
  const start = new Date(run.started_at.replace(" ", "T") + "Z").getTime();
  const end = new Date(run.finished_at.replace(" ", "T") + "Z").getTime();
  if (isNaN(start) || isNaN(end)) return "—";
  const s = Math.round((end - start) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function fmtBytes(n: number): string {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

// A thin determinate progress bar. `value`/`max` are counts; label sits above.
export function ProgressBar({ value, max, label }: { value: number; max: number; label?: ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && <div className="flex justify-between text-xs font-sans text-[var(--color-slate)] mb-1">{label}</div>}
      <div className="h-2 w-full rounded-full bg-[var(--color-ivory-dim)] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[var(--color-gold)] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Collapsible pretty-printed JSON with a copy button (used in the audit drawer).
export function JsonBlock({ value, label }: { value: unknown; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  let text: string;
  try {
    text = typeof value === "string" ? JSON.stringify(JSON.parse(value), null, 2) : JSON.stringify(value, null, 2);
  } catch {
    text = String(value ?? "");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — ignore */ }
  }
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]/50">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--color-border-subtle)]">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-sans font-semibold uppercase tracking-wide text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
          aria-expanded={open}
        >
          {open ? "▾" : "▸"} {label ?? "JSON"}
        </button>
        <button
          onClick={copy}
          className="text-xs font-sans rounded px-2 py-0.5 border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] text-[var(--color-slate)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {open && (
        <pre className="max-h-72 overflow-auto px-3 py-2 text-xs font-mono text-[var(--color-charcoal)] whitespace-pre-wrap break-words">{text}</pre>
      )}
    </div>
  );
}

// A button that stays visible when the user lacks permission, but is disabled
// with an explanatory tooltip (prompt: "disable controls that should be visible
// for context, with a clear explanation").
export function GatedButton({
  allowed, reason, onClick, children, danger, className = "",
}: {
  allowed: boolean;
  reason?: string;
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      title={!allowed ? reason || "You do not have permission for this action" : undefined}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-sans font-semibold rounded-lg text-white shadow-card transition-all focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:shadow-none disabled:cursor-not-allowed ${
        danger
          ? "bg-[var(--color-danger)] hover:brightness-110 focus-visible:ring-[var(--color-danger)]"
          : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-strong)] focus-visible:ring-[var(--color-primary)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
