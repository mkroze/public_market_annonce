import { useEffect, useMemo, useState } from "react";
import { Check, Filter, RotateCcw, Search, X } from "lucide-react";
import { getFilters } from "../lib/api";
import type { FiltersResponse, TenderFilters } from "../lib/types";

interface Props {
  filters: Partial<TenderFilters>;
  onChange: (filters: Partial<TenderFilters>) => void;
}

const CONTROL_CLASS =
  "w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors";

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
  cloture: "Cloture",
};

const PROCEDURE_LABELS: Record<string, string> = {
  AOO: "Appel d'offres ouvert",
  AOS: "Appel d'offres simplifie",
  AMI: "Appel a manifestation d'interet",
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    getFilters().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setDraft((current) =>
      filterSignature(current) === filterSignature(filters) ? current : normalizeFilters(filters),
    );
  }, [filters]);

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
    onChange({ ...normalizeFilters(draft), page: 1 });
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
      sort: "deadline",
      order: "asc",
      page: 1,
      per_page: 20,
    };
    setDraft(cleared);
    onChange(cleared);
  }

  function removeFilter(key: keyof TenderFilters) {
    const patch = { [key]: "", page: 1 } as Partial<TenderFilters>;
    setDraft((current) => ({ ...current, ...patch }));
    onChange({ ...filters, ...patch });
  }

  const categories =
    options?.categories.map((category) => category.name).filter(Boolean) || [
      "Travaux",
      "Fournitures",
      "Services",
    ];

  return (
    <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-[var(--color-crimson)]" />
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
              Trouver une opportunite
            </h2>
            <p className="font-sans text-xs text-[var(--color-slate)]">
              Commencez simple : activite, lieu, puis ajoutez des criteres si besoin.
            </p>
          </div>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 self-start rounded px-2.5 py-1.5 font-sans text-sm text-[var(--color-crimson)] hover:bg-[var(--color-ivory-dim)] transition-colors"
            onClick={clearAll}
          >
            <RotateCcw size={14} /> Reinitialiser
          </button>
        )}
      </div>

      <form onSubmit={applyFilters} className="space-y-4">
        <div className="flex flex-col sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Recherche</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-slate)]" />
            <input
              type="text"
              placeholder="Activite, mot-cle, acheteur..."
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] py-2 pl-10 pr-3 font-sans text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] sm:rounded-r-none"
              value={draft.q || ""}
              onChange={(e) => updateDraft({ q: e.target.value })}
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded bg-[var(--color-crimson)] px-4 py-2 font-sans text-sm font-semibold text-white transition-colors hover:bg-[var(--color-crimson-dark)] sm:rounded-l-none"
          >
            <Check size={15} /> Appliquer
          </button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded border border-[var(--color-border-subtle)] px-3 py-2 font-sans text-sm md:hidden"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <Filter size={14} />
          {advancedOpen ? "Masquer les filtres" : `Filtres avancés${activeFilters.length ? ` (${activeFilters.length})` : ""}`}
        </button>

        <div className={`${advancedOpen ? "grid" : "hidden"} grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-4`}>
          <label className="space-y-1">
            <span className="label-academic text-xs">Type d'achat public</span>
            <select
              className={CONTROL_CLASS}
              value={draft.category || ""}
              onChange={(e) => updateDraft({ category: e.target.value, sector: "" })}
            >
              <option value="">Toutes categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="label-academic text-xs">Domaine d'activite</span>
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

          <label className="space-y-1">
            <span className="label-academic text-xs">Localisation</span>
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

          <label className="space-y-1">
            <span className="label-academic text-xs">Acheteur</span>
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

          <label className="space-y-1">
            <span className="label-academic text-xs">Statut</span>
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

          <label className="space-y-1">
            <span className="label-academic text-xs">Procedure</span>
            <select
              className={CONTROL_CLASS}
              value={draft.procedure_type || ""}
              onChange={(e) => updateDraft({ procedure_type: e.target.value })}
            >
              <option value="">Toutes procedures</option>
              {options?.procedure_types.map((procedure) => (
                <option key={procedure} value={procedure}>
                  {labelForProcedure(procedure)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="label-academic text-xs">Tri</span>
            <select
              className={CONTROL_CLASS}
              value={draft.sort || "deadline"}
              onChange={(e) => updateDraft({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="label-academic text-xs">Ordre</span>
              <select
                className={CONTROL_CLASS}
                value={draft.order || "asc"}
                onChange={(e) => updateDraft({ order: e.target.value })}
              >
                <option value="asc">Ascendant</option>
                <option value="desc">Descendant</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label-academic text-xs">Par page</span>
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
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((key) => (
              <button
                key={key}
                type="button"
                className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-2 py-1 font-sans text-xs text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                onClick={() => removeFilter(key)}
                title="Retirer ce filtre"
              >
                {key === "q" ? "Recherche" : key === "procedure_type" ? "Procedure" : key}:{" "}
                {key === "status"
                  ? labelForStatus(String(filters[key]))
                  : key === "procedure_type"
                    ? labelForProcedure(String(filters[key]))
                    : String(filters[key])}
                <X size={12} />
              </button>
            ))}
            {!hasActiveFilters && (
              <span className="font-sans text-xs text-[var(--color-slate)]">
                Aucun filtre actif.
              </span>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-deep)] px-3 py-2 font-sans text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasDraftChanges}
          >
            <Check size={14} />
            {hasDraftChanges ? "Appliquer les changements" : "Filtres appliques"}
          </button>
        </div>
      </form>
    </section>
  );
}
