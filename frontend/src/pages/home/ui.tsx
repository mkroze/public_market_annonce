// Small presentational building blocks shared by the landing page sections.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarClock, MapPin } from "lucide-react";
import { toSentenceCase, toTenderPath } from "../../lib/tenderUtils";
import type { Tender } from "../../lib/types";
import { FOCUS, deadlineBadge, useInView } from "./tokens";

/** Highlight pill — the signature headline treatment (see new-hot-design.md §2.2). */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

/** Fades and lifts its content in the first time it scrolls into view. The
 *  global reduced-motion / motion-off rules collapse the transition to instant. */
export function Reveal({ children, className = "", delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-[opacity,transform] duration-700 ease-out ${inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  id, eyebrow, title, lead, center = false,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-primary)]">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.12] text-[var(--color-ink)]">
        {title}
      </h2>
      {lead && <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">{lead}</p>}
    </div>
  );
}

/** An application-window frame: makes a composition read as the real product. */
export function AppWindow({
  title, badge, children, className = "",
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border)]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-muted)]">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
      <span className="h-2 w-2 rounded-full bg-[var(--color-success)] motion-safe:animate-pulse" aria-hidden="true" />
      En direct
    </span>
  ) : (
    <span className="shrink-0 rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-muted)]">
      Aperçu illustratif
    </span>
  );
}

/** One consultation line, as in the catalog: title, buyer, city, deadline. */
export function TenderRow({ tender, linked }: { tender: Tender; linked: boolean }) {
  const badge = deadlineBadge(tender.deadline);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-ink)]">
          {toSentenceCase(tender.title || tender.reference || "")}
        </p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${badge.className}`}>
          <CalendarClock size={12} aria-hidden="true" />
          {badge.label}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
          <Building2 size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{tender.entity || "Acheteur à vérifier"}</span>
        </span>
        {tender.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} className="shrink-0" aria-hidden="true" />
            {toSentenceCase(tender.location)}
          </span>
        )}
        {tender.procedure_type && (
          <span className="rounded-full border border-[var(--color-border-subtle)] px-1.5 py-px text-[11px] font-medium">
            {tender.procedure_type}
          </span>
        )}
      </p>
    </>
  );
  const cls = "block px-4 py-3.5 sm:px-5";
  return linked ? (
    <Link
      to={toTenderPath(tender.id)}
      className={`${cls} no-underline transition-colors hover:bg-[var(--color-surface-muted)] motion-reduce:transition-none ${FOCUS}`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
