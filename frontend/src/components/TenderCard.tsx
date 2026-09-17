import { Link } from "react-router-dom";
import { Building2, CalendarClock, MapPin, Wallet } from "lucide-react";
import { getTenderUrgency, toSentenceCase, toTenderPath } from "../lib/tenderUtils";
import type { Tender } from "../lib/types";
import FavoriteButton from "./FavoriteButton";

interface TenderCardProps {
  tender: Tender;
  compact?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

/** Semantic deadline status — Active = green, urgent = amber, Expired = muted
 *  red, unknown = neutral gray. Tokens carry a dark-mode variant. */
function deadlineStatus(deadline: string) {
  const urgency = getTenderUrgency(deadline);
  if (!urgency) {
    return {
      label: "Date à vérifier",
      badge: "border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
    };
  }
  if (urgency.expired) {
    return {
      label: "Expirée",
      badge:
        "border-[color-mix(in_srgb,var(--color-tone-critical)_28%,transparent)] bg-[var(--color-tone-critical-soft)] text-[var(--color-tone-critical)]",
    };
  }
  if (urgency.days <= 7) {
    return {
      label: urgency.days <= 0 ? "Dernier jour" : `Clôture · ${urgency.days} j`,
      badge:
        "border-[color-mix(in_srgb,var(--color-tone-warning)_35%,transparent)] bg-[var(--color-tone-warning-soft)] text-[var(--color-tone-warning)]",
    };
  }
  return {
    label: "En cours",
    badge:
      "border-[color-mix(in_srgb,var(--color-tone-positive)_30%,transparent)] bg-[var(--color-tone-positive-soft)] text-[var(--color-tone-positive)]",
  };
}

export default function TenderCard({ tender, compact = false, isFavorite, onToggleFavorite }: TenderCardProps) {
  const status = deadlineStatus(tender.deadline);
  const displayTitle = tender.title?.trim() ? toSentenceCase(tender.title) : tender.reference?.trim();
  const buyer = tender.entity?.trim() || "Acheteur à vérifier";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:transform-none">
      {onToggleFavorite && (
        <FavoriteButton
          active={Boolean(isFavorite)}
          onToggle={() => onToggleFavorite(tender.id)}
          className="absolute right-4 top-4 z-10 h-9 w-9 rounded-full border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] shadow-card backdrop-blur"
        />
      )}

      <Link to={toTenderPath(tender.id)} className="flex flex-1 flex-col p-5 no-underline">
        {/* Status — leave room on the right for the single favorite button. */}
        <div className={onToggleFavorite ? "pr-11" : ""}>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badge}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {status.label}
          </span>
        </div>

        <h3 className="mt-3.5 line-clamp-2 text-base font-semibold leading-snug tracking-[0] text-[var(--color-ink)]">
          {displayTitle}
        </h3>

        {!compact && tender.reference && (
          <p className="mt-1.5 text-xs font-medium text-[var(--color-muted-light)]">{tender.reference}</p>
        )}

        <dl className="mt-4 space-y-2.5 text-sm text-[var(--color-muted)]">
          {/* Deadline — complete date/time, never truncated. */}
          <div className="flex items-start gap-2">
            <CalendarClock size={15} className="mt-0.5 shrink-0 text-[var(--color-ink)]" aria-hidden="true" />
            <span className="min-w-0">
              {tender.deadline?.trim() || "Date à vérifier"}
            </span>
          </div>
          {/* Buyer — clear, with native tooltip when it overflows. */}
          <div className="flex min-w-0 items-center gap-2">
            <Building2 size={15} className="shrink-0 text-[var(--color-ink)]" aria-hidden="true" />
            <span className="truncate" title={buyer}>
              {buyer}
            </span>
          </div>
          {/* Location. */}
          <div className="flex min-w-0 items-center gap-2">
            <MapPin size={15} className="shrink-0 text-[var(--color-ink)]" aria-hidden="true" />
            <span className="truncate" title={tender.location || undefined}>
              {tender.location?.trim() || "Lieu à vérifier"}
            </span>
          </div>
        </dl>

        {/* Footer — budget then category, pinned to the bottom for even heights. */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {tender.estimation?.trim() ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
              <Wallet size={13} className="text-[var(--color-primary)]" aria-hidden="true" />
              {tender.estimation}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
              <Wallet size={13} aria-hidden="true" />
              Budget à vérifier
            </span>
          )}
          {tender.category && (
            <span className="rounded-full border border-[var(--color-border-subtle)] px-3 py-1 text-xs text-[var(--color-muted)]">
              {tender.category}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
