import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Building2,
  Hammer,
  Inbox,
  Laptop,
  Layers,
  Package,
  Scale,
  SearchX,
  X,
} from "lucide-react";
import {
  getTenders,
  exportTenders,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  createSavedSearch,
} from "../lib/api";
import type { TenderListResponse, TenderFilters } from "../lib/types";
import FilterBar from "../components/FilterBar";
import TenderCard from "../components/TenderCard";
import Pagination from "../components/Pagination";
import ExportDropdown from "../components/ExportDropdown";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import { getTenderUrgency } from "../lib/tenderUtils";
import { useAuth } from "../lib/auth";

const STATUS_SEGMENTS = [
  { key: "active", label: "En cours", filters: { status: "en_cours" } },
  { key: "urgent", label: "Urgentes", filters: { status: "en_cours" } },
  { key: "expired", label: "Expirées", filters: { status: "cloture" } },
  { key: "all", label: "Toutes", filters: { status: "" } },
] as const;

const CATEGORY_TILES = [
  { label: "Travaux", icon: Hammer },
  { label: "Fournitures", icon: Package },
  { label: "Services", icon: BriefcaseBusiness },
  { label: "Informatique", icon: Laptop },
  { label: "Architecture", icon: Building2 },
  { label: "Conseil", icon: Scale },
] as const;

const SORT_OPTIONS = [
  { value: "deadline", label: "Date limite" },
  { value: "publication_date", label: "Publication" },
  { value: "estimation", label: "Estimation" },
  { value: "entity", label: "Acheteur" },
  { value: "location", label: "Localisation" },
  { value: "title", label: "Objet" },
  { value: "scraped_at", label: "Import" },
];

const FILTER_LABELS: Partial<Record<keyof TenderFilters, string>> = {
  q: "Recherche",
  sector: "Domaine",
  entity: "Acheteur",
  location: "Ville",
  procedure_type: "Procédure",
};

// Chip keys shown as removable tokens. Category and status are represented by
// the toolbar rail/segments, so they are intentionally excluded here.
const CHIP_KEYS: (keyof TenderFilters)[] = ["q", "sector", "entity", "location", "procedure_type"];

/** Compact horizontal category filter — navy active state, gold accent icon,
 *  scrolls on narrow screens. Replaces the old oversized gradient tiles. */
function CategoryStrip({
  activeCategory,
  onSelect,
}: {
  activeCategory?: string;
  onSelect: (category: string) => void;
}) {
  const chipClass = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${
      active
        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
        : "border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    }`;

  return (
    <nav aria-label="Types de marchés" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <button
        type="button"
        aria-pressed={!activeCategory}
        aria-label="Tous les types de marchés"
        className={chipClass(!activeCategory)}
        onClick={() => onSelect("")}
      >
        <Layers size={15} className={!activeCategory ? "text-[var(--color-warning)]" : ""} aria-hidden="true" />
        Toutes
      </button>
      {CATEGORY_TILES.map((tile) => {
        const active = activeCategory === tile.label;
        return (
          <button
            key={tile.label}
            type="button"
            aria-pressed={active}
            aria-label={`Filtrer par ${tile.label}`}
            className={chipClass(active)}
            onClick={() => onSelect(active ? "" : tile.label)}
          >
            <tile.icon size={15} className={active ? "text-[var(--color-warning)]" : ""} aria-hidden="true" />
            {tile.label}
          </button>
        );
      })}
    </nav>
  );
}

export default function Tenders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<TenderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const { user } = useAuth();

  const filters: Partial<TenderFilters> = useMemo(
    () => ({
      q: searchParams.get("q") || "",
      category: searchParams.get("category") || "",
      sector: searchParams.get("sector") || "",
      entity: searchParams.get("entity") || "",
      location: searchParams.get("location") || "",
      status: searchParams.has("status") ? searchParams.get("status") || "" : "en_cours",
      procedure_type: searchParams.get("procedure_type") || "",
      sort: searchParams.get("sort") || "deadline",
      order: searchParams.get("order") || "asc",
      page: Number(searchParams.get("page")) || 1,
      per_page: Number(searchParams.get("per_page")) || 20,
    }),
    [searchParams],
  );

  function addToast(message: string, type: ToastData["type"] = "info") {
    setToasts((prev) => [...prev, createToast(message, type)]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Charge l'ensemble des consultations suivies pour refléter l'état du cœur.
  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    getFavoriteIds()
      .then((res) => {
        if (!cancelled) setFavoriteIds(new Set(res.ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggleFavorite(id: string) {
    if (!user) {
      addToast("Connectez-vous pour suivre une consultation.", "info");
      return;
    }
    const wasFavorite = favoriteIds.has(id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      if (wasFavorite) await removeFavorite(id);
      else await addFavorite(id);
      addToast(
        wasFavorite ? "Retiré de vos consultations suivies." : "Ajouté à vos onsultations suivies.",
        "success",
      );
    } catch {
      // Rollback optimiste en cas d'échec réseau.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(id);
        else next.delete(id);
        return next;
      });
      addToast("Action impossible pour le moment. Réessayez.", "error");
    }
  }

  // Critères de la recherche courante = paramètres d'URL, sauf l'affichage et la
  // pagination, pour qu'une recherche enregistrée reproduise exactement la vue.
  function activeCriteria(): Record<string, string> {
    const criteria: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key === "view" || key === "page" || key === "per_page") return;
      if (value) criteria[key] = value;
    });
    return criteria;
  }

  async function handleSaveSearch() {
    const name = saveName.trim();
    if (!name) return;
    setSavingSearch(true);
    try {
      await createSavedSearch({ name, criteria: activeCriteria() });
      addToast("Recherche enregistrée.", "success");
      setSaveOpen(false);
      setSaveName("");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setSavingSearch(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const data = await getTenders(filters);
        if (!cancelled) {
          setResult(data);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les consultations. Vérifiez l'API ou réessayez.");
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const urgentSegmentActive = searchParams.get("urgent") === "true" && filters.status === "en_cours";
  const filtersActive =
    Boolean(
      filters.q ||
        filters.category ||
        filters.sector ||
        filters.entity ||
        filters.location ||
        filters.procedure_type,
    ) ||
    filters.status !== "en_cours" ||
    urgentSegmentActive;

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  function updateFilters(newFilters: Partial<TenderFilters>, keepUrgent = urgentSegmentActive) {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (k === "status" && v === "") {
        params.set(k, "");
        return;
      }
      if (v === undefined || v === null || v === "") return;
      if (k === "page" && Number(v) <= 1) return;
      if (k === "per_page" && Number(v) === 20) return;
      if (k === "sort" && v === "deadline") return;
      if (k === "order" && v === "asc") return;
      params.set(k, String(v));
    });
    if (keepUrgent && newFilters.status === "en_cours") params.set("urgent", "true");
    setSearchParams(params);
  }

  function selectCategory(category: string) {
    updateFilters({ ...filters, category, sector: "", page: 1 });
  }

  function selectStatusSegment(segment: (typeof STATUS_SEGMENTS)[number]) {
    updateFilters({ ...filters, ...segment.filters, page: 1 }, segment.key === "urgent");
  }

  function changeSort(sort: string) {
    updateFilters({ ...filters, sort, page: 1 });
  }

  function toggleOrder() {
    updateFilters({ ...filters, order: (filters.order || "asc") === "asc" ? "desc" : "asc", page: 1 });
  }

  async function handleExport(format: "csv" | "excel" | "json") {
    const formatLabels = { csv: "CSV", excel: "Excel", json: "JSON" };
    addToast(`Préparation de l'export ${formatLabels[format]}...`, "info");
    try {
      await exportTenders(filters, format);
      addToast(`Export ${formatLabels[format]} terminé avec succès`, "success");
    } catch {
      addToast("Erreur lors de l'export. Veuillez réessayer.", "error");
    }
  }

  // Hide stale expired consultations when browsing the default "En cours" view,
  // and narrow to critical deadlines for the "Urgentes" segment.
  const hideExpired = filters.status === "en_cours";
  const displayedTenders = useMemo(() => {
    let list = result?.data ?? [];
    if (hideExpired) list = list.filter((tender) => !getTenderUrgency(tender.deadline)?.expired);
    if (urgentSegmentActive) list = list.filter((tender) => getTenderUrgency(tender.deadline)?.tone === "critical");
    return list;
  }, [result, hideExpired, urgentSegmentActive]);

  const catalogEmpty = Boolean(result) && !loading && !error && result!.total === 0 && !filtersActive;

  const activeChips = useMemo(
    () =>
      CHIP_KEYS.map((key) => ({ key, value: filters[key] })).filter(
        (item): item is { key: keyof TenderFilters; value: string } =>
          item.value !== undefined && item.value !== null && String(item.value) !== "",
      ),
    [filters],
  );

  function removeFilter(key: keyof TenderFilters) {
    updateFilters({ ...filters, [key]: "", page: 1 } as Partial<TenderFilters>);
  }

  const resultCount =
    result && !loading ? (urgentSegmentActive ? displayedTenders.length : result.total) : null;

  const showActions = Boolean(result) && !loading && !error && result!.total > 0 && Boolean(user);

  return (
    <div className="px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {user && saveOpen && filtersActive && (
          <div className="rounded-[1.4rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 shadow-card sm:flex sm:items-end sm:gap-3">
            <div className="flex-1">
              <label htmlFor="save-search-name" className="text-xs font-semibold text-[var(--color-muted)]">
                Nom de la recherche
              </label>
              <input
                id="save-search-name"
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Ex. Travaux électriques à Casablanca"
                className="mt-1 h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-primary)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSearch();
                }}
              />
            </div>
            <div className="mt-3 flex gap-2 sm:mt-0">
              <button
                type="button"
                className="h-11 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-40"
                disabled={savingSearch || !saveName.trim()}
                onClick={handleSaveSearch}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className="h-11 rounded-full px-4 text-sm font-medium text-[var(--color-muted)]"
                onClick={() => {
                  setSaveOpen(false);
                  setSaveName("");
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {!catalogEmpty && (
          <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
            <FilterBar filters={filters} onChange={updateFilters} />

            <section aria-label="Consultations" className="min-w-0 space-y-5">
              {/* Title + actions — shifted alongside the filter panel */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-semibold leading-tight tracking-[0] text-[var(--color-ink)] sm:text-3xl">
                  {resultCount === null
                    ? "Consultations"
                    : `${resultCount.toLocaleString("fr-FR")} consultation${resultCount !== 1 ? "s" : ""} trouvée${resultCount !== 1 ? "s" : ""}`}
                </h1>

                {showActions && (
                  <div className="flex flex-wrap items-center gap-2">
                    {filtersActive && (
                      <button
                        type="button"
                        className="h-10 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        onClick={() => setSaveOpen((value) => !value)}
                      >
                        Enregistrer
                      </button>
                    )}
                    {filtersActive && (
                      <Link
                        to={`/alerts?${searchParams.toString()}`}
                        className="inline-flex h-10 items-center rounded-full border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-ink)] no-underline transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        Créer une alerte
                      </Link>
                    )}
                    <ExportDropdown total={result!.total} onExport={handleExport} />
                  </div>
                )}
              </div>

              {/* Badges toolbar — shifted alongside the filter panel */}
              <div className="space-y-3 border-b border-[var(--color-border-subtle)] pb-4">
                <CategoryStrip activeCategory={filters.category} onSelect={selectCategory} />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Status segments */}
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Statut des consultations">
                    {STATUS_SEGMENTS.map((segment) => {
                      const active =
                        segment.key === "urgent"
                          ? urgentSegmentActive
                          : segment.key === "active"
                            ? filters.status === "en_cours" && !urgentSegmentActive
                            : filters.status === segment.filters.status && !urgentSegmentActive;
                      return (
                        <button
                          key={segment.key}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Statut ${segment.label}`}
                          className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${
                            active
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                              : "border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                          }`}
                          onClick={() => selectStatusSegment(segment)}
                        >
                          {segment.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sort + direction */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                      <span className="hidden sm:inline">Trier par</span>
                      <select
                        className="h-9 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3.5 text-sm font-medium text-[var(--color-ink)] outline-none transition-colors hover:border-[var(--color-primary)] focus:border-[var(--color-primary)]"
                        value={filters.sort || "deadline"}
                        onChange={(event) => changeSort(event.target.value)}
                        aria-label="Trier par"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={toggleOrder}
                      className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)]"
                      aria-label={(filters.order || "asc") === "asc" ? "Ordre ascendant" : "Ordre descendant"}
                      title={(filters.order || "asc") === "asc" ? "Croissant" : "Décroissant"}
                    >
                      {(filters.order || "asc") === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Active filter chips */}
                {activeChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeChips.map(({ key, value }) => (
                      <button
                        key={key}
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-3 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-primary)] motion-reduce:transition-none"
                        onClick={() => removeFilter(key)}
                        aria-label={`Retirer le filtre ${FILTER_LABELS[key]}`}
                      >
                        <span className="text-[var(--color-muted)]">{FILTER_LABELS[key]} :</span>
                        {String(value)}
                        <X size={13} aria-hidden="true" />
                      </button>
                    ))}
                    <button
                      type="button"
                      className="h-8 rounded-full px-2.5 text-xs font-semibold text-[var(--color-ink)] underline decoration-[var(--color-warning)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--color-primary)]"
                      onClick={resetFilters}
                    >
                      Tout effacer
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
                </div>
              ) : error ? (
                <div className="rounded-[1.4rem] border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-4">
                  <p className="text-sm text-[var(--color-ink)]">{error}</p>
                  <button
                    className="mt-3 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
                    onClick={() => updateFilters({ ...filters })}
                  >
                    Réessayer
                  </button>
                </div>
              ) : result && displayedTenders.length === 0 ? (
                filtersActive ? (
                  <EmptyState
                    icon={SearchX}
                    title="Aucune consultation ne correspond à vos critères."
                    description="Élargissez ou réinitialisez vos filtres."
                    action={
                      <button
                        className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
                        onClick={resetFilters}
                      >
                        Réinitialiser
                      </button>
                    }
                  />
                ) : (
                  <EmptyState size="md" icon={Inbox} title="Aucune consultation disponible pour le moment." />
                )
              ) : result ? (
                <>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {displayedTenders.map((tender) => (
                      <TenderCard
                        key={tender.id}
                        tender={tender}
                        compact
                        isFavorite={favoriteIds.has(tender.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                  {!urgentSegmentActive && (
                    <Pagination
                      page={result.page}
                      pages={result.pages}
                      total={result.total}
                      onPageChange={(p) => updateFilters({ ...filters, page: p })}
                    />
                  )}
                </>
              ) : null}
            </section>
          </div>
        )}

        {catalogEmpty && (
          <EmptyState size="md" icon={Inbox} title="Aucune consultation disponible pour le moment." />
        )}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
