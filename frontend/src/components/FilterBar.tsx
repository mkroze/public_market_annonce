import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Search, X } from "lucide-react";
import { getFilters } from "../lib/api";
import type { FiltersResponse, TenderFilters } from "../lib/types";

interface Props {
  filters: Partial<TenderFilters>;
  onChange: (filters: Partial<TenderFilters>) => void;
}

const CONTROL_CLASS =
  "institutional-control w-full px-3 py-2 font-sans text-sm transition-colors motion-reduce:transition-none";

const KEY_LABELS: Record<string, string> = {
  q: "Recherche",
  category: "Type d'achat",
  sector: "Domaine",
  entity: "Acheteur",
  location: "Localisation",
  status: "Statut",
  procedure_type: "Procédure",
};

const FILTER_KEYS: (keyof TenderFilters)[] = [
  "q",
  "category",
  "sector",
  "entity",
  "location",
  "status",
  "procedure_type",
];

const SORT_OPTIONS = [
  { value: "deadline", label: "Date limite" },
  { value: "publication_date", label: "Publication" },
  { value: "estimation", label: "Estimation" },
  { value: "entity", label: "Acheteur" },
  { value: "location", label: "Localisation" },
  { value: "title", label: "Objet" },
  { value: "scraped_at", label: "Import" },
];

const STATUS_LABELS: Record<string, string> = {
  en_cours: "En cours",
  cloture: "Clôturé",
};

const PROCEDURE_LABELS: Record<string, string> = {
  AOO: "Appel d'offres ouvert",
  AOS: "Appel d'offres simplifié",
  AMI: "Appel à manifestation d'intérêt",
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

function labelForStatus(status: string) {
  return STATUS_LABELS[status] || status;
}

function labelForProcedure(procedure: string) {
  return PROCEDURE_LABELS[procedure] || procedure;
}

export default function FilterBar({ filters, onChange }: Props) {
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [draft, setDraft] = useState<Partial<TenderFilters>>(() => normalizeFilters(filters));
  const [open, setOpen] = useState(false);
  // La recherche est toujours visible (hors panneau) et gère son propre état.
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

  // Nom lisible d'une valeur de filtre (le secteur est stocké en code).
  function labelForValue(key: keyof TenderFilters, value: string): string {
    if (key === "status") return labelForStatus(value);
    if (key === "procedure_type") return labelForProcedure(value);
    if (key === "sector") return options?.sectors.find((s) => s.code === value)?.name || value;
    return value;
  }

  function applySearch(e?: React.FormEvent) {
    e?.preventDefault();
    onChange({ ...normalizeFilters(filters), q: search, page: 1 });
  }

  const activeFilters = useMemo(
    () =>
      FILTER_KEYS.filter((key) => {
        const value = filters[key];
        return value !== undefined && value !== null && String(value) !== "";
      }),
    [filters],
  );

  const hasActiveFilters = activeFilters.length > 0;
  const hasDraftChanges = filterSignature(draft) !== filterSignature(filters);

  function updateDraft(patch: Partial<TenderFilters>) {
    setDraft((current) => ({ ...current, ...patch, page: 1 }));
  }

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    // La recherche visible fait foi pour `q`, indépendamment du brouillon.
    onChange({ ...normalizeFilters(draft), q: search, page: 1 });
  }

  function clearAll() {
    const cleared: Partial<TenderFilters> = {
      q: "",
      category: "",
      sector: "",
      entity: "",
      location: "",
      status: "",
      procedure_type: "",
      sort: filters.sort || "deadline",
      order: filters.order || "asc",
      page: 1,
      per_page: 20,
    };
    setSearch("");
    setDraft((current) => ({ ...cleared, sort: current.sort, order: current.order }));
    onChange(cleared);
  }

  function removeFilter(key: keyof TenderFilters) {
    const patch = { [key]: "", page: 1 } as Partial<TenderFilters>;
    setDraft((current) => ({ ...current, ...patch }));
    onChange({ ...filters, ...patch });
  }

  // Le tri s'applique immédiatement, sans passer par le brouillon.
  function changeSort(sort: string) {
    onChange({ ...filters, sort, page: 1 });
  }

  function toggleOrder() {
    onChange({ ...filters, order: (filters.order || "asc") === "asc" ? "desc" : "asc", page: 1 });
  }

  const categories =
    options?.categories.map((category) => category.name).filter(Boolean) || [
      "Travaux",
      "Fournitures",
      "Services",
    ];

  return (
    <section className="institutional-panel overflow-hidden">
      {/* Always-visible search */}
      <form onSubmit={applySearch} className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] p-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            type="search"
            aria-label="Rechercher une consultation"
            placeholder="Activité, mot-clé, acheteur…"
            className="institutional-control w-full py-2 pl-10 pr-3 font-sans text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm rounded shrink-0">
          Rechercher
        </button>
      </form>

      {/* Control row — FILTRES + / TRIER + */}
      <div className="flex items-center justify-between gap-4 py-3 border-t border-[var(--color-border-subtle)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 editorial-label text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors motion-reduce:transition-none"
        >
          Filtres
          <Plus
            size={14}
            className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
          />
          {hasActiveFilters && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-warning)] px-1 text-[10px] font-bold text-[var(--color-ink)]">
              {activeFilters.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline editorial-label text-[var(--color-muted)]">Trier</span>
          <select
            className="border-0 bg-transparent font-sans text-sm font-medium text-[var(--color-ink)] rounded focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] cursor-pointer"
            value={filters.sort || "deadline"}
            onChange={(e) => changeSort(e.target.value)}
            aria-label="Trier par"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleOrder}
            className="btn btn-ghost btn-xs btn-square"
            aria-label={(filters.order || "asc") === "asc" ? "Ordre ascendant" : "Ordre descendant"}
            title={(filters.order || "asc") === "asc" ? "Croissant" : "Décroissant"}
          >
            {(filters.order || "asc") === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] py-3">
          {activeFilters.map((key) => (
            <button
              key={key}
              type="button"
              className="inline-flex items-center gap-1.5 border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-2 py-1 font-sans text-xs text-[var(--color-ink)] hover:border-[var(--color-primary)] transition-colors motion-reduce:transition-none"
              onClick={() => removeFilter(key)}
              title="Retirer ce filtre"
            >
              {KEY_LABELS[key] || key}: {labelForValue(key, String(filters[key]))}
              <X size={12} />
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 editorial-label text-[var(--color-accent)] hover:underline"
            onClick={clearAll}
          >
            <RotateCcw size={12} /> Réinitialiser
          </button>
        </div>
      )}

      {/* Collapsible advanced panel */}
      {open && (
        <form
          onSubmit={applyFilters}
          className="border-t border-[var(--color-border-subtle)] py-5 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Type d'achat</span>
              <select
                className={CONTROL_CLASS}
                value={draft.category || ""}
                onChange={(e) => updateDraft({ category: e.target.value, sector: "" })}
              >
                <option value="">Toutes catégories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Domaine d'activité</span>
              <select
                className={CONTROL_CLASS}
                value={draft.sector || ""}
                onChange={(e) => updateDraft({ sector: e.target.value })}
              >
                <option value="">Tous secteurs</option>
                {options?.sectors.map((sector) => (
                  <option key={sector.code} value={sector.code}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Localisation</span>
              <select
                className={CONTROL_CLASS}
                value={draft.location || ""}
                onChange={(e) => updateDraft({ location: e.target.value })}
              >
                <option value="">Toutes localisations</option>
                {options?.locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Acheteur</span>
              <select
                className={CONTROL_CLASS}
                value={draft.entity || ""}
                onChange={(e) => updateDraft({ entity: e.target.value })}
              >
                <option value="">Tous acheteurs</option>
                {options?.entities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Statut</span>
              <select
                className={CONTROL_CLASS}
                value={draft.status || ""}
                onChange={(e) => updateDraft({ status: e.target.value })}
              >
                <option value="">Tous statuts</option>
                {(options?.statuses || ["en_cours"]).map((status) => (
                  <option key={status} value={status}>
                    {labelForStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Procédure</span>
              <select
                className={CONTROL_CLASS}
                value={draft.procedure_type || ""}
                onChange={(e) => updateDraft({ procedure_type: e.target.value })}
              >
                <option value="">Toutes procédures</option>
                {options?.procedure_types.map((procedure) => (
                  <option key={procedure} value={procedure}>
                    {labelForProcedure(procedure)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="editorial-label text-[var(--color-muted)]">Par page</span>
              <select
                className={CONTROL_CLASS}
                value={String(draft.per_page || 20)}
                onChange={(e) => updateDraft({ per_page: Number(e.target.value) })}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={clearAll}
              className="editorial-label text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              disabled={!hasDraftChanges}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              {hasDraftChanges ? "Appliquer" : "Filtres appliqués"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
