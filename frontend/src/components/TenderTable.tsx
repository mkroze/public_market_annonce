import { useNavigate } from "react-router-dom";
import type { Tender } from "../lib/types";
import { ExternalLink, ArrowUpDown, MapPin } from "lucide-react";

interface Props {
  tenders: Tender[];
  sort: string;
  order: string;
  onSort: (field: string) => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  Travaux: "badge-primary",
  Fournitures: "badge-secondary",
  Services: "badge-accent",
};

export default function TenderTable({ tenders, sort, order, onSort }: Props) {
  const navigate = useNavigate();

  function SortHeader({ field, label }: { field: string; label: string }) {
    const active = sort === field;
    return (
      <th
        className="cursor-pointer select-none hover:bg-base-200 transition-colors"
        onClick={() => onSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          {active && (
            <ArrowUpDown size={12} className={order === "desc" ? "rotate-180" : ""} />
          )}
        </span>
      </th>
    );
  }

  if (tenders.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50">
        Aucune consultation trouvée
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <SortHeader field="title" label="Objet" />
            <SortHeader field="entity" label="Entité" />
            <th>Catégorie</th>
            <th>Secteur</th>
            <SortHeader field="location" label="Localisation" />
            <SortHeader field="deadline" label="Date limite" />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tenders.map((t) => (
            <tr
              key={t.id}
              className="hover cursor-pointer"
              onClick={() => navigate(`/tenders/${t.id}`)}
            >
              <td className="max-w-md">
                <div className="font-medium text-sm leading-tight">{t.title || t.reference}</div>
                {t.reference && t.title && (
                  <div className="text-xs text-base-content/50 mt-0.5">{t.reference}</div>
                )}
              </td>
              <td className="text-sm max-w-48 truncate">{t.entity}</td>
              <td>
                {t.category && (
                  <span className={`badge badge-sm ${CATEGORY_BADGE[t.category] || "badge-ghost"}`}>
                    {t.category}
                  </span>
                )}
              </td>
              <td className="text-xs max-w-40 truncate">{t.sector_name}</td>
              <td className="text-sm max-w-32 truncate">
                {t.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="shrink-0 text-base-content/40" />
                    {t.location}
                  </span>
                )}
              </td>
              <td className="text-sm whitespace-nowrap">{t.deadline}</td>
              <td>
                {t.detail_url && (
                  <a
                    href={t.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
