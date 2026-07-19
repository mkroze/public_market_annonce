import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { getCities } from "../lib/api";
import type { CityStats } from "../lib/types";

export default function Cities({ embedded = false }: { embedded?: boolean }) {
  const [cities, setCities] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCities()
      .then((res) => setCities(res.cities.sort((a, b) => b.total - a.total)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={embedded ? "pt-2 space-y-6" : "px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Villes</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Marches publics par ville
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : cities.length === 0 ? (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Aucune ville trouvee.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cities.map((city) => (
            <Link key={city.name} to={`/cities/${encodeURIComponent(city.name)}`}>
              <div className="border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] rounded bg-[var(--color-ivory)] p-5 transition-colors">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[var(--color-crimson)]" />
                  <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">{city.name}</h2>
                </div>
                <p className="text-[var(--color-slate)] font-sans text-sm mt-1">{city.region}</p>
                <div className="flex gap-6 mt-3">
                  <div>
                    <div className="label-academic text-[var(--color-slate)]">Total</div>
                    <div className="text-lg font-bold tabular-nums text-[var(--color-charcoal)]">{city.total}</div>
                  </div>
                  <div>
                    <div className="label-academic text-[var(--color-slate)]">Actives</div>
                    <div className="text-lg font-bold tabular-nums text-[var(--color-crimson)]">{city.active}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
