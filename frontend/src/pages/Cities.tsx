import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, ExternalLink, MapPin, Search } from "lucide-react";
import { getCities } from "../lib/api";
import type { CityStats } from "../lib/types";
import MoroccoMap from "../components/MoroccoMap";

type SortKey = "total" | "active" | "rate";

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const GRID_FRAME =
  "grid gap-px overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-border-subtle)] shadow-card";

const LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";
const SECTION_TITLE = "text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]";

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

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

  const KPIS = [
    { label: "Villes suivies", value: metrics.cityCount.toLocaleString("fr-FR"), accent: "text-[var(--color-ink)]" },
    { label: "Consultations", value: metrics.total.toLocaleString("fr-FR"), accent: "text-[var(--color-primary)]" },
    { label: "Actives", value: metrics.active.toLocaleString("fr-FR"), accent: "text-[var(--color-warning)]" },
    { label: "Top 5", value: formatPercent(metrics.concentration), accent: "text-[var(--color-ink)]" },
  ];

  return (
    <div className={embedded ? "space-y-6 pt-2" : "space-y-6 px-3 py-3 sm:px-5 sm:py-4"}>
      {!embedded && (
        <section className={`mx-auto ${FRAME}`} aria-labelledby="cities-title">
          <div className="px-5 py-7 sm:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              <MapPin size={14} aria-hidden="true" />
              Villes · Maroc
            </div>
            <h1
              id="cities-title"
              className="mt-4 max-w-2xl text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
            >
              Les marchés publics, <Pill>ville par ville</Pill>.
            </h1>
            <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
              Où se concentrent les consultations publiques : classement, carte et régions les plus actives.
            </p>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
        </div>
      ) : cities.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4 text-sm text-[var(--color-muted)]">
          Aucune ville trouvée.
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className={`grid-cols-2 lg:grid-cols-4 ${GRID_FRAME}`}>
            {KPIS.map((kpi) => (
              <div key={kpi.label} className="bg-[var(--color-surface)] px-5 py-4">
                <div className={LABEL}>{kpi.label}</div>
                <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${kpi.accent}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Map */}
          <section className={FRAME}>
            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4">
              <MapPin size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
              <div>
                <h2 className={SECTION_TITLE}>Carte des consultations</h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  Principales villes affichées — liste complète dans le classement ci-dessous.
                </p>
              </div>
            </div>
            <div className="p-5">
              <MoroccoMap cities={cities} />
            </div>
          </section>

          {/* Ranking + aside */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className={FRAME}>
              <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className={SECTION_TITLE}>Classement des villes</h2>
                  <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                    {filteredCities.length.toLocaleString("fr-FR")} villes affichées
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative block">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-light)]" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rechercher une ville"
                      aria-label="Rechercher une ville"
                      className="h-10 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] pl-9 pr-4 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)] sm:w-64"
                    />
                  </label>
                  <div className="inline-flex overflow-hidden rounded-full border border-[var(--color-border-subtle)]">
                    {([
                      ["total", "Total"],
                      ["active", "Actives"],
                      ["rate", "Taux"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSortKey(key)}
                        aria-pressed={sortKey === key}
                        className={`h-10 border-l border-[var(--color-border-subtle)] px-4 text-sm font-semibold transition-colors first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${
                          sortKey === key
                            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-light)]">
                      <th className="px-5 py-3 text-left font-semibold">Ville</th>
                      <th className="hidden px-3 py-3 text-left font-semibold md:table-cell">Région</th>
                      <th className="px-3 py-3 text-right font-semibold">Total</th>
                      <th className="px-3 py-3 text-right font-semibold">Actives</th>
                      <th className="hidden px-3 py-3 text-right font-semibold sm:table-cell">Taux</th>
                      <th className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCities.map((city) => {
                      const rate = city.total > 0 ? (city.active / city.total) * 100 : 0;
                      return (
                        <tr
                          key={city.name}
                          className="border-b border-[var(--color-border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)]"
                        >
                          <td className="px-5 py-3">
                            <Link
                              to={`/cities/${encodeURIComponent(city.name)}`}
                              className="inline-flex items-center gap-2 font-semibold text-[var(--color-ink)] no-underline transition-colors hover:text-[var(--color-primary)]"
                            >
                              <MapPin size={15} className="shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                              <span>{city.name}</span>
                            </Link>
                          </td>
                          <td className="hidden px-3 py-3 text-[var(--color-muted)] md:table-cell">{city.region || "Autre"}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--color-ink)]">{city.total}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--color-primary)]">{city.active}</td>
                          <td className="hidden px-3 py-3 text-right tabular-nums text-[var(--color-muted)] sm:table-cell">{formatPercent(rate)}</td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/tenders?location=${encodeURIComponent(city.name)}`}
                              className="inline-grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-primary)]"
                              title="Voir les consultations"
                              aria-label={`Voir les consultations à ${city.name}`}
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-6">
              <div className={`${FRAME} p-5`}>
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
                  <h2 className={SECTION_TITLE}>Signal principal</h2>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className={LABEL}>Ville dominante</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">
                      {metrics.topCity?.name || "Aucune"}
                    </div>
                    {metrics.topCity && (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {metrics.topCity.total.toLocaleString("fr-FR")} consultations, {metrics.topCity.active.toLocaleString("fr-FR")} actives
                      </p>
                    )}
                  </div>
                  <div>
                    <div className={LABEL}>Régions les plus actives</div>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {regionTotals.map(([region, total]) => (
                        <li
                          key={region}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-ink)]"
                        >
                          {region}
                          <strong className="tabular-nums text-[var(--color-primary)]">{total}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className={`${FRAME} p-5`}>
                <h2 className={SECTION_TITLE}>Distribution</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {topDistribution.map((city) => (
                    <li
                      key={city.name}
                      title={`${city.name} — ${city.total.toLocaleString("fr-FR")} consultations`}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-1 pl-3 pr-1.5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <span className="max-w-[9rem] truncate text-sm text-[var(--color-ink)]">{city.name}</span>
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--color-primary)]">
                        {city.total.toLocaleString("fr-FR")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
