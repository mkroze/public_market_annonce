import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Map, ArrowLeft } from "lucide-react";
import { getRegionDetail } from "../lib/api";
import type { RegionDetail as RegionDetailType } from "../lib/types";

function categoryBadgeClass(category: string) {
  // Soft-tint chips (à la navbar) so they read cleanly in light and dark themes.
  if (category === "Travaux") return "bg-[var(--color-primary-soft)] text-[var(--color-primary)]";
  if (category === "Fournitures") return "bg-[var(--color-warning-soft)] text-[var(--color-warning)]";
  return "bg-[var(--color-surface-strong)] text-[var(--color-ink)]";
}

export default function RegionDetail() {
  const { name } = useParams<{ name: string }>();
  const [region, setRegion] = useState<RegionDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;
    getRegionDetail(decodeURIComponent(name))
      .then(setRegion)
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

  if (!region) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Region introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link to="/regions" className="inline-flex items-center gap-1 text-[var(--color-crimson)] hover:underline font-sans text-sm mb-3">
          <ArrowLeft size={14} />
          Retour aux regions
        </Link>
        <div className="flex items-center gap-2">
          <Map size={22} className="text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">{region.name}</h1>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Total consultations</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-charcoal)] mt-1">{region.total}</div>
        </div>
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Actives</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-crimson)] mt-1">{region.active}</div>
        </div>
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Villes</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-gold)] mt-1">{region.cities.length}</div>
        </div>
      </div>

      {region.cities.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Villes de la region</h2>
          <div className="divider-academic my-3"></div>
          <div className="space-y-2">
            {region.cities
              .sort((a, b) => b.total - a.total)
              .map((city) => (
                <Link
                  key={city.location}
                  to={`/cities/${encodeURIComponent(city.location)}`}
                  className="flex items-center justify-between p-3 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] bg-[var(--color-ivory-dim)] transition-colors"
                >
                  <span className="font-sans text-sm text-[var(--color-charcoal)]">{city.location}</span>
                  <span className="tabular-nums font-sans text-sm font-bold text-[var(--color-crimson)]">{city.total}</span>
                </Link>
              ))}
          </div>
        </div>
      )}

      {region.by_category.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Repartition par categorie</h2>
          <div className="divider-academic my-3"></div>
          <div className="flex flex-wrap gap-2">
            {region.by_category.map((cat) => (
              <span key={cat.category} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-sans text-sm ${categoryBadgeClass(cat.category)}`}>
                {cat.category}
                <span className="tabular-nums font-bold">{cat.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {region.top_sectors.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Top secteurs</h2>
          <div className="divider-academic my-3"></div>
          <div className="space-y-2">
            {region.top_sectors.map((s) => (
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

      <div className="flex justify-center">
        <Link
          to={`/tenders?location=${encodeURIComponent(region.cities.map((c) => c.location).join(","))}`}
          className="inline-flex items-center px-5 py-2.5 rounded border border-[var(--color-crimson)] bg-[var(--color-crimson)] text-[var(--color-on-primary)] font-sans text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Voir toutes les consultations de la region
        </Link>
      </div>
    </div>
  );
}
