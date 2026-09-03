import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, ArrowLeft, ExternalLink } from "lucide-react";
import { getCityDetail, getTenders } from "../lib/api";
import type { CityDetail as CityDetailType, Tender } from "../lib/types";

function categoryBadgeClass(category: string) {
  // Soft-tint chips (à la navbar) so they read cleanly in light and dark themes.
  if (category === "Travaux") return "bg-[var(--color-primary-soft)] text-[var(--color-primary)]";
  if (category === "Fournitures") return "bg-[var(--color-warning-soft)] text-[var(--color-warning)]";
  return "bg-[var(--color-surface-strong)] text-[var(--color-ink)]";
}

export default function CityDetail() {
  const { name } = useParams<{ name: string }>();
  const [city, setCity] = useState<CityDetailType | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;
    const decoded = decodeURIComponent(name);
    Promise.all([
      getCityDetail(decoded),
      getTenders({ location: decoded }),
    ])
      .then(([cityData, tenderData]) => {
        setCity(cityData);
        setTenders(tenderData.data.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!city) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Ville introuvable.
        </div>
      </div>
    );
  }

  const cityName = decodeURIComponent(name || "");

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link to="/cities" className="inline-flex items-center gap-1 text-[var(--color-crimson)] hover:underline font-sans text-sm mb-3">
          <ArrowLeft size={14} />
          Retour aux villes
        </Link>
        <div className="flex items-center gap-2">
          <MapPin size={22} className="text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">{city.name}</h1>
        </div>
        <p className="text-[var(--color-slate)] font-sans text-sm mt-1">{city.region}</p>
      </div>

      <div className="flex gap-4">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Total consultations</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-charcoal)] mt-1">{city.total}</div>
        </div>
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Actives</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-crimson)] mt-1">{city.active}</div>
        </div>
      </div>

      {city.by_category.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Repartition par categorie</h2>
          <div className="divider-academic my-3"></div>
          <div className="flex flex-wrap gap-2">
            {city.by_category.map((cat) => (
              <span key={cat.category} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-sans text-sm ${categoryBadgeClass(cat.category)}`}>
                {cat.category}
                <span className="tabular-nums font-bold">{cat.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {city.top_sectors.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Top secteurs</h2>
          <div className="divider-academic my-3"></div>
          <div className="space-y-2">
            {city.top_sectors.map((s) => (
              <Link
                key={s.sector_code}
                to={`/sectors/${encodeURIComponent(s.sector_code)}`}
                className="flex items-center justify-between p-3 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] bg-[var(--color-ivory-dim)] transition-colors"
              >
                <span className="font-sans text-sm text-[var(--color-charcoal)]">{s.sector_name}</span>
                <span className="tabular-nums font-sans text-sm font-bold text-[var(--color-crimson)]">{s.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tenders.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Consultations recentes</h2>
          <div className="divider-academic my-3"></div>
          <div className="overflow-x-auto">
            <table className="w-full font-sans text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  <th className="text-left py-2 label-academic text-[var(--color-slate)]">Objet</th>
                  <th className="text-left py-2 label-academic text-[var(--color-slate)]">Acheteur</th>
                  <th className="text-left py-2 label-academic text-[var(--color-slate)]">Date limite</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-border-subtle)] last:border-b-0">
                    <td className="py-2.5 max-w-xs truncate text-[var(--color-charcoal)]">{t.title}</td>
                    <td className="py-2.5 text-[var(--color-slate)]">{t.entity}</td>
                    <td className="py-2.5 tabular-nums text-[var(--color-slate)]">{t.deadline}</td>
                    <td className="py-2.5">
                      <Link to={`/tenders/${t.id}`} className="text-[var(--color-crimson)] hover:underline">
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Link
          to={`/tenders?location=${encodeURIComponent(cityName)}`}
          className="inline-flex items-center px-5 py-2.5 rounded border border-[var(--color-crimson)] bg-[var(--color-crimson)] text-[var(--color-on-primary)] font-sans text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Voir toutes les consultations
        </Link>
      </div>
    </div>
  );
}
