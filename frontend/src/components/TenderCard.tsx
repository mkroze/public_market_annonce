import { Link } from "react-router-dom";
import { Banknote, Building2, Calendar, MapPin, Sparkles } from "lucide-react";
import { getTenderGuidance } from "../lib/tenderGuidance";
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import type { Tender } from "../lib/types";

interface TenderCardProps {
  tender: Tender;
  compact?: boolean;
}

const TONE_CLASS = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-slate)]",
};

export default function TenderCard({ tender, compact = false }: TenderCardProps) {
  const guidance = getTenderGuidance(tender);
  const urgency = getTenderUrgency(tender.deadline);

  return (
    <article className="relative rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] transition-colors hover:border-[var(--color-border)]">
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <Link to={toTenderPath(tender.id)} className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 font-sans text-xs font-semibold ${TONE_CLASS[guidance.tone]}`}>
                {guidance.label}
              </span>
              {tender.category && (
                <span className="rounded border border-[var(--color-border-subtle)] px-2 py-0.5 font-sans text-xs text-[var(--color-slate)]">
                  {tender.category}
                </span>
              )}
            </div>
            <h3 className="font-display text-base font-bold leading-snug text-[var(--color-charcoal)]">
              {tender.title || tender.reference}
            </h3>
            {!compact && tender.reference && (
              <p className="mt-1 font-sans text-xs text-[var(--color-slate)]">{tender.reference}</p>
            )}
          </div>
        </Link>
      </div>

      <Link to={toTenderPath(tender.id)} className="block p-4 pt-3">
        <dl className="mt-4 grid grid-cols-1 gap-2 font-sans text-sm text-[var(--color-slate)] sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span className="truncate">{tender.entity || "Acheteur a verifier"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span className="truncate">{tender.location || "Lieu a verifier"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span>{tender.deadline || "Date limite a verifier"}{urgency ? ` · ${urgency.label}` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Banknote size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span>{tender.estimation || "Budget a verifier"}</span>
          </div>
        </dl>

        {!compact && guidance.reasons.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 font-sans text-xs text-[var(--color-slate)]">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--color-crimson)]" />
            {guidance.reasons[0]}
          </p>
        )}
      </Link>
    </article>
  );
}
