import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { getFilters } from "../lib/api";
import type { FiltersResponse, TenderFilters } from "../lib/types";

interface Props {
  filters: Partial<TenderFilters>;
  onChange: (filters: Partial<TenderFilters>) => void;
}

const FIELD_CLASS =
  "h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-primary)]";

const SECTION_LABEL = "mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";

// Category and status now live in the catalog toolbar; the sidebar owns the
// finer-grained facets to stay lighter than the results column.
const FILTER_KEYS: (keyof TenderFilters)[] = ["q", "category", "sector", "entity", "location", "status", "procedure_type"];

const PROCEDURE_LABELS: Record<string, string> = {
  AOO: "Appel d'offres ouvert",
  AOS: "Appel d'offres simplifié",
  AMI: "Manifestation d'intérêt",
  CONCA: "Concours",
  CONSA: "Consultation architecturale",
};

function normalizeFilters(filters: Partial<TenderFilters>): Partial<TenderFilters> {
  return {
    q: filters.q || "",
    category: filters.category || "",
    sector: filters.sector || "",
    entity: filters.entity || "",
    location: filters.location || "",
    status: filters.status || "",
    procedure_type: filters.procedure_type || "",
    sort: filters.sort || "deadline",
    order: filters.order || "asc",
    page: filters.page || 1,
    per_page: filters.per_page || 20,
  };
}

function filterSignature(filters: Partial<TenderFilters>) {
  const normalized = normalizeFilters(filters);
  return JSON.stringify(
    Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))),
  );
}

function labelForProcedure(procedure: string) {
  return PROCEDURE_LABELS[procedure] || procedure;
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0">
      <h3 className={SECTION_LABEL}>{title}</h3>
      {children}
    </section>
  );
}

export default function FilterBar({ filters, onChange }: Props) {
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [draft, setDraft] = useState<Partial<TenderFilters>>(() => normalizeFilters(filters));
  const [search, setSearch] = useState(filters.q || "");

  useEffect(() => {
    getFilters().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setDraft((current) =>
      filterSignature(current) === filterSignature(filters) ? current : normalizeFilters(filters),
    );
  }, [filters]);

  useEffect(() => {
    setSearch(filters.q || "");
  }, [filters.q]);

  // Status defaults to "en_cours"; only count it as an active filter when the
  // user has moved it off the default (that control lives in the toolbar).
  const hasActiveFilters = useMemo(
    () =>
      FILTER_KEYS.some((key) => {
        const value = filters[key];
        if (key === "status") return Boolean(value) && value !== "en_cours";
        return value !== undefined && value !== null && String(value) !== "";
      }),
    [filters],
  );

  const searchChanged = search !== (filters.q || "");
  const hasDraftChanges = filterSignature(draft) !== filterSignature(filters) || searchChanged;

  function updateDraft(patch: Partial<TenderFilters>) {
    setDraft((current) => ({ ...current, ...patch, page: 1 }));
  }

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    onChange({ ...normalizeFilters(draft), q: search, page: 1 });
  }

  function clearAll() {
    const cleared: Partial<TenderFilters> = {
      q: "",
      category: "",
      sector: "",
      entity: "",
      location: "",
      status: "en_cours",
      procedure_type: "",
      sort: filters.sort || "deadline",
      order: filters.order || "asc",
      page: 1,
      per_page: 20,
    };
    setSearch("");
    setDraft(cleared);
    onChange(cleared);
  }

  return (
    <aside
      aria-label="Filtres du catalogue"
      className="overflow-hidden rounded-[1.6rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card lg:sticky lg:top-4 lg:-mt-2 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col lg:self-start"
    >
      <form onSubmit={applyFilters} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.04em] text-[var(--color-ink)]">Filtres</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            onClick={clearAll}
            disabled={!hasActiveFilters && !searchChanged}
            aria-label="Réinitialiser les filtres"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Réinitialiser
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <FilterSection title="Recherche">
            <label className="relative block">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Rechercher une consultation"
                placeholder="Mot-clé, acheteur, référence..."
                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white pl-11 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </FilterSection>

          <FilterSection title="Domaine">
            <select
              aria-label="Domaine"
              className={FIELD_CLASS}
              value={draft.sector || ""}
              onChange={(event) => updateDraft({ sector: event.target.value })}
            >
              <option value="">Tous domaines</option>
              {options?.sectors.map((sector) => (
                <option key={sector.code} value={sector.code}>
                  {sector.name}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Localisation">
            <select
              aria-label="Localisation"
              className={FIELD_CLASS}
              value={draft.location || ""}
              onChange={(event) => updateDraft({ location: event.target.value })}
            >
              <option value="">Toutes villes</option>
              {options?.locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Acheteur">
            <select
              aria-label="Acheteur"
              className={FIELD_CLASS}
              value={draft.entity || ""}
              onChange={(event) => updateDraft({ entity: event.target.value })}
            >
              <option value="">Tous acheteurs</option>
              {options?.entities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Procédure">
            <select
              aria-label="Procédure"
              className={FIELD_CLASS}
              value={draft.procedure_type || ""}
              onChange={(event) => updateDraft({ procedure_type: event.target.value })}
            >
              <option value="">Toutes procédures</option>
              {options?.procedure_types.map((procedure) => (
                <option key={procedure} value={procedure}>
                  {labelForProcedure(procedure)}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Par page">
            <select
              aria-label="Résultats par page"
              className={FIELD_CLASS}
              value={String(draft.per_page || 20)}
              onChange={(event) => updateDraft({ per_page: Number(event.target.value) })}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </FilterSection>
        </div>

        <div className="shrink-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4">
          <button
            type="submit"
            disabled={!hasDraftChanges}
            className="h-11 w-full rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:transform-none"
          >
            Appliquer
          </button>
        </div>
      </form>
    </aside>
  );
}
