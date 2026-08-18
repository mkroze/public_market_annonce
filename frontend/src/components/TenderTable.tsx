import { Link, useNavigate } from "react-router-dom";
import type { Tender } from "../lib/types";
import { ExternalLink, ArrowUpDown, MapPin, Banknote } from "lucide-react";
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import { CATEGORY_COLORS, CATEGORY_FALLBACK } from "../lib/tone";

interface Props {
  tenders: Tender[];
  sort: string;
  order: string;
  onSort: (field: string) => void;
}

const URGENCY_STYLES = {
  expired: { dotClass: "status-dot-expired", textClass: "text-[var(--color-border)]" },
  critical: { dotClass: "status-dot-pending", textClass: "text-[var(--color-warning)] font-semibold" },
  warning: { dotClass: "status-dot-pending", textClass: "text-[var(--color-gold)]" },
  normal: { dotClass: "status-dot-completed", textClass: "text-[var(--color-muted)]" },
};

export default function TenderTable({ tenders, sort, order, onSort }: Props) {
  const navigate = useNavigate();

  function SortHeader({ field, label, highlight }: { field: string; label: string; highlight?: boolean }) {
    const active = sort === field;
    return (
      <th
        className={`cursor-pointer select-none hover:bg-[var(--color-surface-muted)] transition-colors duration-150 motion-reduce:transition-none ${active && highlight ? "bg-[var(--color-surface-muted)]" : ""}`}
        onClick={() => onSort(field)}
      >
        <span className={`flex items-center gap-1 ${active && highlight ? "text-[var(--color-primary)]" : ""}`}>
          {label}
          {active && (
            <ArrowUpDown size={11} className={`text-[var(--color-primary)] ${order === "desc" ? "rotate-180" : ""}`} />
          )}
        </span>
      </th>
    );
  }

  if (tenders.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-muted)]">
        <p className="font-display text-lg">Aucune consultation trouvée</p>
        <p className="text-sm mt-1">Modifiez ou réinitialisez vos filtres pour voir plus de résultats.</p>
      </div>
    );
  }

  return (
    <div className="institutional-panel overflow-hidden">
      <p className="lg:hidden px-3 py-1.5 text-xs text-[var(--color-muted)] border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)]">
        Faites défiler horizontalement pour voir toutes les colonnes →
      </p>
      <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="bg-[var(--color-surface-muted)] text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
            <SortHeader field="title" label="Objet" />
            <SortHeader field="entity" label="Entité" />
            <th>Cat.</th>
            <th>Secteur</th>
            <SortHeader field="location" label="Lieu" />
            <SortHeader field="estimation" label="Estimation" highlight />
            <SortHeader field="deadline" label="Échéance" />
            <th>Délai</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tenders.map((t) => {
            const urgency = getTenderUrgency(t.deadline);
            const urgencyStyle = urgency && URGENCY_STYLES[urgency.tone];
            return (
              <tr
                key={t.id}
                className="cursor-pointer odd:bg-[var(--color-surface)] even:bg-[var(--color-app-bg)] hover:bg-[var(--color-surface-muted)] transition-colors duration-100 motion-reduce:transition-none"
                onClick={() => navigate(toTenderPath(t.id))}
              >
                <td className="max-w-md">
                  <Link
                    to={toTenderPath(t.id)}
                    className="font-medium text-sm leading-tight text-[var(--color-ink)] hover:text-[var(--color-primary)] hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t.title || t.reference}
                  </Link>
                  {t.reference && t.title && (
                    <div className="text-xs text-[var(--color-muted)] mt-0.5 font-sans">
                      {t.reference}
                    </div>
                  )}
                </td>
                <td className="text-sm max-w-48 truncate text-[var(--color-ink)]">{t.entity}</td>
                <td>
                  {t.category && (
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${CATEGORY_COLORS[t.category] || CATEGORY_FALLBACK}`}>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className="text-xs max-w-40 truncate text-[var(--color-muted)]">{t.sector_name}</td>
                <td className="text-sm max-w-32 truncate">
                  {t.location && (
                    <span className="flex items-center gap-1 text-[var(--color-muted)]">
                      <MapPin size={12} className="shrink-0" />
                      {t.location}
                    </span>
                  )}
                </td>
                <td className={`text-sm whitespace-nowrap tabular-nums ${t.estimation ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-border)]"}`}>
                  {t.estimation ? (
                    <span className="flex items-center gap-1">
                      <Banknote size={13} className="text-[var(--color-gold)] shrink-0" />
                      {t.estimation}
                    </span>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </td>
                <td className="text-sm whitespace-nowrap tabular-nums text-[var(--color-ink)]">
                  {t.deadline}
                </td>
                <td>
                  {urgency && urgencyStyle && (
                    <span className={`flex items-center gap-1.5 text-xs ${urgencyStyle.textClass}`}>
                      <span className={`status-dot ${urgencyStyle.dotClass}`}></span>
                      {urgency.label}
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-0.5">
                    {t.detail_url && (
                      <a
                        href={t.detail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square text-[var(--color-muted)]"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Voir sur le portail"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
