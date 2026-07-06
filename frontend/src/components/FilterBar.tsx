import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { getFilters } from "../lib/api";
import type { FiltersResponse, TenderFilters } from "../lib/types";

interface Props {
  filters: Partial<TenderFilters>;
  onChange: (filters: Partial<TenderFilters>) => void;
}

export default function FilterBar({ filters, onChange }: Props) {
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [searchInput, setSearchInput] = useState(filters.q || "");

  useEffect(() => {
    getFilters().then(setOptions).catch(() => {});
  }, []);

  function update(patch: Partial<TenderFilters>) {
    onChange({ ...filters, ...patch, page: 1 });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    update({ q: searchInput });
  }

  function clearAll() {
    setSearchInput("");
    onChange({ q: "", category: "", sector: "", entity: "", location: "", page: 1 });
  }

  const hasFilters = filters.q || filters.category || filters.sector || filters.entity || filters.location;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-slate)]" />
          <input
            type="text"
            placeholder="Rechercher par mot-cle, reference, entite..."
            className="input input-bordered w-full pl-10 font-sans bg-base-100 border-[var(--color-border-subtle)] focus:border-[var(--color-crimson)] rounded-r-none"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary rounded-l-none font-sans font-semibold">
          Rechercher
        </button>
      </form>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="label-academic mr-1">Filtres</span>

        <select
          className="select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)]"
          value={filters.category || ""}
          onChange={(e) => update({ category: e.target.value, sector: "" })}
        >
          <option value="">Toutes categories</option>
          <option value="Travaux">Travaux</option>
          <option value="Fournitures">Fournitures</option>
          <option value="Services">Services</option>
        </select>

        <select
          className="select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)]"
          value={filters.sector || ""}
          onChange={(e) => update({ sector: e.target.value })}
        >
          <option value="">Tous secteurs</option>
          {options?.sectors.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className="select select-bordered select-sm max-w-xs font-sans bg-base-100 border-[var(--color-border-subtle)]"
          value={filters.location || ""}
          onChange={(e) => update({ location: e.target.value })}
        >
          <option value="">Toutes localisations</option>
          {options?.locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          className="select select-bordered select-sm max-w-xs font-sans bg-base-100 border-[var(--color-border-subtle)]"
          value={filters.entity || ""}
          onChange={(e) => update({ entity: e.target.value })}
        >
          <option value="">Toutes entites</option>
          {options?.entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            className="flex items-center gap-1 px-2.5 py-1 text-sm font-sans text-[var(--color-crimson)] hover:bg-[var(--color-ivory-dim)] rounded transition-colors"
            onClick={clearAll}
          >
            <X size={14} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
