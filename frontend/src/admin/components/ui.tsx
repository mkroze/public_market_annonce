import type { ReactNode, ElementType } from "react";

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
