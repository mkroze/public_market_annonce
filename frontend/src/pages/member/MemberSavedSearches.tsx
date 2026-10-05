import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2, ArrowUpRight } from "lucide-react";
import EmptyState from "../../components/EmptyState";
import { getSavedSearches, deleteSavedSearch } from "../../lib/api";
import type { SavedSearch } from "../../lib/types";

const CRITERIA_LABELS: Record<string, string> = {
  q: "Mot-clé",
  category: "Type",
  sector: "Secteur",
  entity: "Acheteur",
  location: "Lieu",
  status: "Statut",
  procedure_type: "Procédure",
  sort: "Tri",
  order: "Ordre",
};

function criteriaToQuery(criteria: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(criteria || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

function criteriaSummary(criteria: Record<string, string>): string {
  const parts = Object.entries(criteria || {})
    .filter(([key, value]) => CRITERIA_LABELS[key] && value)
    .map(([key, value]) => `${CRITERIA_LABELS[key]} : ${value}`);
  return parts.length ? parts.join(" · ") : "Tous les critères du catalogue";
}

export default function MemberSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSavedSearches()
      .then((res) => {
        if (!cancelled) setSearches(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger vos recherches enregistrées.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: number) {
    const previous = searches;
    setSearches((current) => current.filter((s) => s.id !== id));
    try {
      await deleteSavedSearch(id);
    } catch {
      setSearches(previous);
      setError("Suppression impossible. Réessayez.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <Search size={22} aria-hidden />
          Recherches enregistrées
        </h1>
      </header>

      {error && (
        <div className="rounded-lg border border-l-4 border-[var(--color-danger)] px-4 py-3 text-sm text-[var(--color-ink)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : searches.length === 0 ? (
        <EmptyState
          size="md"
          icon={Search}
          title="Aucune recherche enregistrée"
          description="Depuis le catalogue, appliquez des filtres puis « Enregistrer cette recherche » pour la retrouver ici et la relancer en un clic."
          action={
            <Link
              to="/tenders"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
            >
              Ouvrir le catalogue
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
          {searches.map((saved) => (
            <li key={saved.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--color-ink)]">{saved.name}</p>
                <p className="truncate text-sm text-[var(--color-muted)]">
                  {criteriaSummary(saved.criteria)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  to={`/tenders?${criteriaToQuery(saved.criteria)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  <ArrowUpRight size={14} />
                  Ouvrir
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(saved.id)}
                  aria-label={`Supprimer la recherche ${saved.name}`}
                  className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
