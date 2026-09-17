import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, MapPin, Sparkles } from "lucide-react";
import OverviewTab from "./stats/OverviewTab";
import Cities from "./Cities";

/** Highlight pill — signature headline treatment (new-hot-design.md §2.2). */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const TABS = [
  { key: "overview", label: "Vue d'ensemble", icon: BarChart3 },
  { key: "villes", label: "Villes", icon: MapPin },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Stats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey = raw === "villes" ? "villes" : "overview";
  const activeLabel = TABS.find((t) => t.key === active)?.label ?? "";

  function selectTab(key: TabKey) {
    if (key === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  }

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── Header card ──────────────────────────────────────── */}
      <section className={`mx-auto ${FRAME}`} aria-labelledby="stats-title">
        <div className="px-5 py-7 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
            <Sparkles size={14} aria-hidden="true" />
            Données publiques · Maroc
          </div>

          <h1
            id="stats-title"
            className="mt-4 max-w-2xl text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
          >
            La commande publique, <Pill>en chiffres</Pill>.
          </h1>

          <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
            Indicateurs clés, répartition par secteur et villes les plus actives — agrégés à partir
            des appels d'offres publiés.
          </p>
        </div>

        {/* Pill tabs */}
        <div
          className="flex flex-wrap gap-2 border-t border-[var(--color-border-subtle)] px-5 py-4 sm:px-8"
          role="tablist"
          aria-label="Vues statistiques"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab.key)}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${
                  isActive
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_10px_24px_-16px_rgba(0,35,111,0.85)]"
                    : "border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-ink)]"
                }`}
              >
                <tab.icon
                  size={16}
                  aria-hidden="true"
                  className={isActive ? "text-[var(--color-warning)]" : ""}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Active view ──────────────────────────────────────── */}
      <div className="mt-6" role="tabpanel" aria-label={activeLabel}>
        {active === "overview" && <OverviewTab />}
        {active === "villes" && <Cities embedded />}
      </div>
    </div>
  );
}
