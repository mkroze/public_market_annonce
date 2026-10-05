import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Map } from "lucide-react";
import { getRegions } from "../lib/api";
import type { RegionStats } from "../lib/types";

export default function Regions({ embedded = false }: { embedded?: boolean }) {
  const [regions, setRegions] = useState<RegionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRegions()
      .then((res) => setRegions(res.regions.sort((a, b) => b.total - a.total)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={embedded ? "pt-2 space-y-6" : "px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Régions</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Marchés publics par région
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : regions.length === 0 ? (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Aucune région trouvée.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regions.map((region) => {
            const activeRate = region.total > 0 ? (region.active / region.total) * 100 : 0;
            return (
              <Link key={region.name} to={`/regions/${encodeURIComponent(region.name)}`}>
                <div className="border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] rounded bg-[var(--color-ivory)] p-5 transition-colors">
                  <div className="flex items-center gap-2">
                    <Map size={18} className="text-[var(--color-crimson)]" />
                    <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">{region.name}</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <div className="label-academic text-[var(--color-slate)]">Total</div>
                      <div className="text-lg font-bold tabular-nums text-[var(--color-charcoal)]">{region.total}</div>
                    </div>
                    <div>
                      <div className="label-academic text-[var(--color-slate)]">Actives</div>
                      <div className="text-lg font-bold tabular-nums text-[var(--color-crimson)]">{region.active}</div>
                    </div>
                    <div>
                      <div className="label-academic text-[var(--color-slate)]">Villes</div>
                      <div className="text-lg font-bold tabular-nums text-[var(--color-gold)]">{region.cities.length}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 rounded bg-[var(--color-ivory-deep)]">
                    <div className="h-1.5 rounded bg-[var(--color-gold)]" style={{ width: `${Math.min(activeRate, 100)}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
