import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BookmarkCheck, Clock, Search } from "lucide-react";
import { getAlerts, getFavorites } from "../../lib/api";
import type { AlertPreference, Tender } from "../../lib/types";
import { useAuth } from "../../lib/auth";

export default function MemberOverview() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [favorites, setFavorites] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getAlerts(), getFavorites()])
      .then(([alertRes, favoriteRes]) => {
        setAlerts(alertRes.data);
        setFavorites(favoriteRes.data);
      })
      .catch(() => setError("Impossible de charger votre espace membre."))
      .finally(() => setLoading(false));
  }, []);

  const activeAlerts = alerts.filter((alert) => Boolean(alert.enabled)).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">
          Bonjour, {user?.name || "membre"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
          Voici ce qui mérite votre attention aujourd'hui.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">À traiter</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link
            to="/member/alerts"
            className="rounded-lg border border-[var(--color-border-subtle)] p-4 hover:border-[var(--color-primary)]"
          >
            <Bell size={18} className="text-[var(--color-primary)]" aria-hidden />
            <p className="mt-3 text-2xl font-bold text-[var(--color-ink)]">
              {loading ? "-" : activeAlerts}
            </p>
            <p className="text-sm text-[var(--color-muted)]">alertes actives</p>
          </Link>
          <Link
            to="/member/consultations"
            className="rounded-lg border border-[var(--color-border-subtle)] p-4 hover:border-[var(--color-primary)]"
          >
            <BookmarkCheck size={18} className="text-[var(--color-primary)]" aria-hidden />
            <p className="mt-3 text-2xl font-bold text-[var(--color-ink)]">
              {loading ? "-" : favorites.length}
            </p>
            <p className="text-sm text-[var(--color-muted)]">consultations suivies</p>
          </Link>
          <div className="rounded-lg border border-[var(--color-border-subtle)] p-4">
            <Clock size={18} className="text-[var(--color-warning)]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">
              Aucune échéance suivie pour le moment
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Les échéances proches apparaîtront ici quand vous suivrez des consultations.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Consultations suivies</h2>
            <Link to="/member/consultations" className="text-sm font-semibold text-[var(--color-primary)]">
              Voir tout
            </Link>
          </div>
          {favorites.length === 0 ? (
            <div className="mt-4 rounded-lg bg-[var(--color-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Aucune consultation suivie</p>
              <Link to="/tenders" className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)]">
                Explorer les consultations
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-border-subtle)]">
              {favorites.slice(0, 4).map((tender) => (
                <li key={tender.id} className="py-3">
                  <Link
                    to={`/tenders/${encodeURIComponent(tender.id)}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                  >
                    {tender.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {tender.entity} · {tender.location || "Lieu non précisé"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Alertes</h2>
          {alerts.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--color-muted)]">Vous n'avez pas encore créé d'alerte.</p>
              <Link
                to="/member/alerts"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
              >
                <Bell size={15} aria-hidden />
                Créer une alerte
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-[var(--color-border-subtle)] p-3">
                  <p className="font-semibold text-[var(--color-ink)]">{alert.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {alert.enabled ? "Active" : "En pause"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Recherches enregistrées</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Les recherches enregistrées seront disponibles ici. Pour l'instant, utilisez les filtres du catalogue.
        </p>
        <Link to="/tenders" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)]">
          Ouvrir le catalogue
        </Link>
      </section>
    </div>
  );
}
