import { Link, useNavigate } from "react-router-dom";
import type { Tender } from "../lib/types";
import { ArrowRight, ArrowUpDown, ExternalLink } from "lucide-react";
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import FavoriteButton from "./FavoriteButton";

interface Props {
  tenders: Tender[];
  sort: string;
  order: string;
  onSort: (field: string) => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
}

// Pastille douce + point coloré (langage « statut » partagé avec table.png).
const URGENCY_DOT = {
  expired: "bg-[var(--color-border)]",
  critical: "bg-[var(--color-danger)]",
  warning: "bg-[var(--color-warning)]",
  normal: "bg-[var(--color-success)]",
};

export default function TenderTable({ tenders, sort, order, onSort, favoriteIds, onToggleFavorite }: Props) {
  const navigate = useNavigate();

  function SortHeader({ field, label }: { field: string; label: string }) {
    const active = sort === field;
    return (
      <th aria-sort={active ? (order === "desc" ? "descending" : "ascending") : "none"} scope="col">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-left transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
          onClick={() => onSort(field)}
        >
          {label}
          <ArrowUpDown
            size={13}
            className={`transition-transform motion-reduce:transition-none ${active ? "opacity-100" : "opacity-35"} ${active && order === "desc" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </th>
    );
  }

  if (tenders.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-14 text-center shadow-card">
        <p className="text-base font-semibold text-[var(--color-ink)]">Aucune consultation</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Essayez une autre recherche.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-muted)]">
              <SortHeader field="title" label="Consultation" />
              <SortHeader field="deadline" label="Date" />
              <SortHeader field="entity" label="Acheteur" />
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              <th scope="col" className="px-4 py-3 font-medium">Action</th>
              <th scope="col" className="w-20 px-4 py-3" aria-label="Actions rapides" />
            </tr>
          </thead>
          <tbody>
            {tenders.map((tender) => {
              const urgency = getTenderUrgency(tender.deadline);
              const dot = urgency ? URGENCY_DOT[urgency.tone] : URGENCY_DOT.normal;

              return (
                <tr
                  key={tender.id}
                  className="cursor-pointer border-b border-[var(--color-border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)] motion-reduce:transition-none"
                  onClick={() => navigate(toTenderPath(tender.id))}
                >
                  <td className="max-w-[28rem] px-4 py-5">
                    <Link
                      to={toTenderPath(tender.id)}
                      className="block text-base font-semibold leading-snug text-[var(--color-ink)] no-underline hover:text-[var(--color-primary)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {tender.title || tender.reference}
                    </Link>
                    {tender.reference && tender.title && (
                      <div className="mt-1 text-sm text-[var(--color-muted)]">{tender.reference}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-base tabular-nums text-[var(--color-ink)]">
                    {tender.deadline || "-"}
                  </td>
                  <td className="max-w-64 px-4 py-5">
                    <div className="truncate text-base text-[var(--color-ink)]">{tender.entity || "-"}</div>
                    <div className="mt-1 truncate text-sm text-[var(--color-muted)]">{tender.location || tender.sector_name || ""}</div>
                  </td>
                  <td className="px-4 py-5">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--color-ink)]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                      {urgency?.label || tender.status || "Ouvert"}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <Link
                      to={toTenderPath(tender.id)}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-ink)] no-underline transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] motion-reduce:transition-none"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Détail
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center justify-end gap-1">
                      {onToggleFavorite && (
                        <FavoriteButton
                          active={favoriteIds?.has(tender.id) ?? false}
                          onToggle={() => onToggleFavorite(tender.id)}
                          className="btn btn-ghost btn-xs btn-square rounded-full"
                        />
                      )}
                      {tender.detail_url && (
                        <a
                          href={tender.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] motion-reduce:transition-none"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Voir sur le portail"
                        >
                          <ExternalLink size={15} aria-hidden="true" />
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
