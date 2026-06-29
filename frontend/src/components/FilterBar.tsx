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
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="join w-full">
        <input
          type="text"
          placeholder="Rechercher par mot-clé, référence, entité..."
          className="input input-bordered join-item flex-1"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary join-item">
          <Search size={16} />
        </button>
      </form>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="select select-bordered select-sm"
          value={filters.category || ""}
          onChange={(e) => update({ category: e.target.value, sector: "" })}
        >
          <option value="">Toutes catégories</option>
          <option value="Travaux">Travaux</option>
          <option value="Fournitures">Fournitures</option>
          <option value="Services">Services</option>
        </select>

        <select
          className="select select-bordered select-sm"
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
          className="select select-bordered select-sm max-w-xs"
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
          className="select select-bordered select-sm max-w-xs"
          value={filters.entity || ""}
          onChange={(e) => update({ entity: e.target.value })}
        >
          <option value="">Toutes entités</option>
          {options?.entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll}>
            <X size={14} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
