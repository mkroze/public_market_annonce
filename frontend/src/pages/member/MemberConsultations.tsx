import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkCheck, ExternalLink, Trash2 } from "lucide-react";
import { getFavorites, removeFavorite } from "../../lib/api";
import type { Tender } from "../../lib/types";
import EmptyState from "../../components/EmptyState";

export default function MemberConsultations() {
  const [favorites, setFavorites] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    const response = await getFavorites();
    setFavorites(response.data);
  }

  useEffect(() => {
    reload()
      .catch(() => setError("Impossible de charger vos consultations suivies."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(tenderId: string) {
    await removeFavorite(tenderId);
    setFavorites((current) => current.filter((tender) => tender.id !== tenderId));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <BookmarkCheck size={22} aria-hidden />
          Mes consultations
        </h1>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          size="md"
          icon={BookmarkCheck}
          title="Aucune consultation suivie"
          description="Enregistrez une consultation depuis le catalogue pour suivre son échéance depuis votre espace membre."
          action={
            <Link
              to="/tenders"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
            >
              Explorer les consultations
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
          {favorites.map((tender) => (
            <li
              key={tender.id}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <Link
                  to={`/tenders/${encodeURIComponent(tender.id)}`}
                  className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                >
                  {tender.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{tender.entity}</p>
                <p className="mt-1 text-xs text-[var(--color-muted-light)]">
                  {tender.location || "Lieu non précisé"} · Échéance {tender.deadline || "non précisée"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/tenders/${encodeURIComponent(tender.id)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)]"
                >
                  <ExternalLink size={15} aria-hidden />
                  Voir
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(tender.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                >
                  <Trash2 size={15} aria-hidden />
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
