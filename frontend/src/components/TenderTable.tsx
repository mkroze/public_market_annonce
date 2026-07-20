import { Link, useNavigate } from "react-router-dom";
import type { Tender } from "../lib/types";
import { ExternalLink, ArrowUpDown, MapPin, Heart, Banknote } from "lucide-react";
import { useAuth } from "../lib/auth";
import { addFavorite, removeFavorite } from "../lib/api";
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import { useState } from "react";

interface Props {
  tenders: Tender[];
  sort: string;
  order: string;
  onSort: (field: string) => void;
  favoriteIds?: Set<string>;
  onFavoriteToggle?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Travaux: "bg-[var(--color-crimson)] text-white",
  Fournitures: "bg-[var(--color-gold)] text-white",
  Services: "bg-[var(--color-charcoal)] text-white",
};

const URGENCY_STYLES = {
  expired: { dotClass: "status-dot-expired", textClass: "text-[var(--color-border)]" },
  critical: { dotClass: "status-dot-active", textClass: "text-[var(--color-crimson)] font-semibold" },
  warning: { dotClass: "status-dot-pending", textClass: "text-[var(--color-gold)]" },
  normal: { dotClass: "status-dot-completed", textClass: "text-[var(--color-slate)]" },
};

export default function TenderTable({ tenders, sort, order, onSort, favoriteIds, onFavoriteToggle }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleFavorite(e: React.MouseEvent, tenderId: string) {
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    setTogglingId(tenderId);
    try {
      if (favoriteIds?.has(tenderId)) {
        await removeFavorite(tenderId);
      } else {
        await addFavorite(tenderId);
      }
      onFavoriteToggle?.();
    } finally {
      setTogglingId(null);
    }
  }

  function SortHeader({ field, label, highlight }: { field: string; label: string; highlight?: boolean }) {
    const active = sort === field;
    return (
      <th
        className={`cursor-pointer select-none hover:bg-[var(--color-ivory-dim)] transition-colors duration-150 ${active && highlight ? "bg-[var(--color-ivory-dim)]" : ""}`}
        onClick={() => onSort(field)}
      >
        <span className={`flex items-center gap-1 ${active && highlight ? "text-[var(--color-crimson)]" : ""}`}>
          {label}
          {active && (
            <ArrowUpDown size={11} className={`text-[var(--color-crimson)] ${order === "desc" ? "rotate-180" : ""}`} />
          )}
        </span>
      </th>
    );
  }

  if (tenders.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-slate)]">
        <p className="font-display text-lg">Aucune consultation trouvee</p>
        <p className="text-sm mt-1">Modifiez vos filtres ou lancez un import.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded">
      <table className="table table-sm">
        <thead>
          <tr className="bg-[var(--color-ivory-dim)]">
            <SortHeader field="title" label="Objet" />
            <SortHeader field="entity" label="Entite" />
            <th>Cat.</th>
            <th>Secteur</th>
            <SortHeader field="location" label="Lieu" />
            <SortHeader field="estimation" label="Estimation" highlight />
            <SortHeader field="deadline" label="Échéance" />
            <th>Delai</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tenders.map((t) => {
            const urgency = getTenderUrgency(t.deadline);
            const urgencyStyle = urgency && URGENCY_STYLES[urgency.tone];
            const isFav = favoriteIds?.has(t.id);
            return (
              <tr
                key={t.id}
                className="hover:bg-[var(--color-ivory-dim)] cursor-pointer transition-colors duration-100"
                onClick={() => navigate(toTenderPath(t.id))}
              >
                <td className="max-w-md">
                  <Link
                    to={toTenderPath(t.id)}
                    className="font-medium text-sm leading-tight text-[var(--color-charcoal)] hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t.title || t.reference}
                  </Link>
                  {t.reference && t.title && (
                    <div className="text-xs text-[var(--color-slate)] mt-0.5 font-sans">
                      {t.reference}
                    </div>
                  )}
                </td>
                <td className="text-sm max-w-48 truncate text-[var(--color-charcoal)]">{t.entity}</td>
                <td>
                  {t.category && (
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${CATEGORY_COLORS[t.category] || "bg-base-300"}`}>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className="text-xs max-w-40 truncate text-[var(--color-slate)]">{t.sector_name}</td>
                <td className="text-sm max-w-32 truncate">
                  {t.location && (
                    <span className="flex items-center gap-1 text-[var(--color-slate)]">
                      <MapPin size={12} className="shrink-0" />
                      {t.location}
                    </span>
                  )}
                </td>
                <td className={`text-sm whitespace-nowrap tabular-nums ${t.estimation ? "font-semibold text-[var(--color-charcoal)]" : "text-[var(--color-border)]"}`}>
                  {t.estimation ? (
                    <span className="flex items-center gap-1">
                      <Banknote size={13} className="text-[var(--color-gold)] shrink-0" />
                      {t.estimation}
                    </span>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </td>
                <td className="text-sm whitespace-nowrap tabular-nums text-[var(--color-charcoal)]">
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
                    <button
                      className={`btn btn-ghost btn-xs btn-square ${isFav ? "text-[var(--color-crimson)]" : "text-[var(--color-slate)]"}`}
                      onClick={(e) => handleFavorite(e, t.id)}
                      disabled={togglingId === t.id}
                      aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    {t.detail_url && (
                      <a
                        href={t.detail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square text-[var(--color-slate)]"
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
  );
}
