import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Activity, ExternalLink, MapPin, Search } from "lucide-react";
import { getCities } from "../lib/api";
import type { CityStats } from "../lib/types";
import MoroccoMap from "../components/MoroccoMap";

type SortKey = "total" | "active" | "rate";

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export default function Cities({ embedded = false }: { embedded?: boolean }) {
  const [cities, setCities] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");

  useEffect(() => {
    getCities()
      .then((res) => setCities(res.cities.sort((a, b) => b.total - a.total)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const total = cities.reduce((sum, city) => sum + city.total, 0);
    const active = cities.reduce((sum, city) => sum + city.active, 0);
    const topCity = cities[0];
    const topFiveTotal = cities.slice(0, 5).reduce((sum, city) => sum + city.total, 0);
    return {
      total,
      active,
      topCity,
      cityCount: cities.length,
      concentration: total > 0 ? (topFiveTotal / total) * 100 : 0,
    };
  }, [cities]);

  const filteredCities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cities
      .filter((city) => {
        if (!normalizedQuery) return true;
        return `${city.name} ${city.region}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortKey === "active") return b.active - a.active || b.total - a.total;
        if (sortKey === "rate") {
          const rateA = a.total > 0 ? a.active / a.total : 0;
          const rateB = b.total > 0 ? b.active / b.total : 0;
          return rateB - rateA || b.total - a.total;
        }
        return b.total - a.total || b.active - a.active;
      });
  }, [cities, query, sortKey]);

  const maxTotal = Math.max(...cities.map((city) => city.total), 1);
  const topDistribution = filteredCities.slice(0, 10);
  const regionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    cities.forEach((city) => {
      const region = city.region || "Autre";
      totals[region] = (totals[region] || 0) + city.total;
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [cities]);

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
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
            <div className="bg-base-100 px-5 py-4">
              <div className="label-academic">Villes suivies</div>
              <div className="text-2xl font-bold font-display tabular-nums text-[var(--color-charcoal)] mt-1">
                {metrics.cityCount.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="bg-base-100 px-5 py-4">
              <div className="label-academic">Consultations</div>
              <div className="text-2xl font-bold font-display tabular-nums text-[var(--color-crimson)] mt-1">
                {metrics.total.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="bg-base-100 px-5 py-4">
              <div className="label-academic">Actives</div>
              <div className="text-2xl font-bold font-display tabular-nums text-[var(--color-gold)] mt-1">
                {metrics.active.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="bg-base-100 px-5 py-4">
              <div className="label-academic">Top 5</div>
              <div className="text-2xl font-bold font-display tabular-nums text-[var(--color-charcoal)] mt-1">
                {formatPercent(metrics.concentration)}
              </div>
            </div>
          </div>

          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
              <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Carte des consultations</h2>
              <p className="font-sans text-sm text-[var(--color-slate)] mt-0.5">
                Seules les principales villes sont affichees. Liste complete dans le classement ci-dessous.
              </p>
            </div>
            <div className="p-5">
              <MoroccoMap cities={cities} />
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
            <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Classement des villes</h2>
                  <p className="font-sans text-sm text-[var(--color-slate)] mt-0.5">
                    {filteredCities.length.toLocaleString("fr-FR")} villes affichees
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="relative block">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-slate)]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rechercher une ville"
                      className="w-full sm:w-64 h-9 pl-9 pr-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] font-sans text-sm text-[var(--color-charcoal)]"
                    />
                  </label>
                  <div className="inline-flex h-9 rounded border border-[var(--color-border-subtle)] overflow-hidden bg-[var(--color-ivory)]">
                    {([
                      ["total", "Total"],
                      ["active", "Actives"],
                      ["rate", "Taux"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSortKey(key)}
                        className={`px-3 font-sans text-sm border-l first:border-l-0 border-[var(--color-border-subtle)] ${
                          sortKey === key
                            ? "bg-[var(--color-crimson)] text-white"
                            : "text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 text-left">Ville</th>
                      <th className="px-3 py-3 text-left hidden md:table-cell">Region</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3 text-right">Actives</th>
                      <th className="px-3 py-3 text-right hidden sm:table-cell">Taux</th>
                      <th className="px-5 py-3 text-right">
                        <ArrowUpDown size={14} className="inline text-[var(--color-slate)]" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCities.map((city) => {
                      const rate = city.total > 0 ? (city.active / city.total) * 100 : 0;
                      return (
                        <tr key={city.name} className="border-b border-[var(--color-border-subtle)] last:border-b-0">
                          <td className="px-5 py-3">
                            <Link
                              to={`/cities/${encodeURIComponent(city.name)}`}
                              className="inline-flex items-center gap-2 font-semibold text-[var(--color-charcoal)] hover:text-[var(--color-crimson)]"
                            >
                              <MapPin size={15} className="text-[var(--color-crimson)] shrink-0" />
                              <span>{city.name}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-[var(--color-slate)] hidden md:table-cell">{city.region || "Autre"}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-[var(--color-charcoal)]">{city.total}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-[var(--color-crimson)]">{city.active}</td>
                          <td className="px-3 py-3 text-right hidden sm:table-cell">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded bg-[var(--color-ivory-deep)]">
                                <div className="h-1.5 rounded bg-[var(--color-gold)]" style={{ width: `${Math.min(rate, 100)}%` }} />
                              </div>
                              <span className="w-9 tabular-nums text-[var(--color-slate)]">{formatPercent(rate)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/tenders?location=${encodeURIComponent(city.name)}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)] hover:text-[var(--color-crimson)] hover:border-[var(--color-border)]"
                              title="Voir les consultations"
                            >
                              <ExternalLink size={14} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-[var(--color-crimson)]" />
                  <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Signal principal</h2>
                </div>
                <div className="divider-academic my-4"></div>
                <div className="space-y-4">
                  <div>
                    <div className="label-academic">Ville dominante</div>
                    <div className="font-display text-2xl font-bold text-[var(--color-charcoal)] mt-1">
                      {metrics.topCity?.name || "Aucune"}
                    </div>
                    {metrics.topCity && (
                      <p className="font-sans text-sm text-[var(--color-slate)] mt-1">
                        {metrics.topCity.total.toLocaleString("fr-FR")} consultations, {metrics.topCity.active.toLocaleString("fr-FR")} actives
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="label-academic">Regions les plus actives</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {regionTotals.map(([region, total]) => (
                        <span
                          key={region}
                          className="inline-flex items-center gap-2 rounded border border-[var(--color-border-subtle)] px-2.5 py-1 font-sans text-xs text-[var(--color-charcoal)]"
                        >
                          {region}
                          <strong className="tabular-nums text-[var(--color-crimson)]">{total}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
                <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Distribution</h2>
                <div className="divider-academic my-4"></div>
                <div className="space-y-3">
                  {topDistribution.map((city) => (
                    <div key={city.name}>
                      <div className="flex items-center justify-between gap-3 font-sans text-sm">
                        <span className="truncate text-[var(--color-charcoal)]">{city.name}</span>
                        <span className="tabular-nums font-semibold text-[var(--color-crimson)]">{city.total}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-[var(--color-ivory-deep)]">
                        <div
                          className="h-1.5 rounded bg-[var(--color-crimson)]"
                          style={{ width: `${Math.max((city.total / maxTotal) * 100, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
