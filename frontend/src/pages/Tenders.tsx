import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LockKeyhole, Inbox, SearchX } from "lucide-react";
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
import TenderTable from "../components/TenderTable";
import Pagination from "../components/Pagination";
import ExportDropdown from "../components/ExportDropdown";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import { getTenderUrgency } from "../lib/tenderUtils";
import { useAuth } from "../lib/auth";

const STATUS_SEGMENTS = [
  { key: "active", label: "En cours", filters: { status: "en_cours" } },
  { key: "urgent", label: "Urgentes", filters: { status: "en_cours" } },
  { key: "expired", label: "Expirées", filters: { status: "cloture" } },
  { key: "all", label: "Toutes", filters: { status: "" } },
] as const;

function SummaryTile({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warning" | "neutral";
}) {
  const dot =
    tone === "warning"
      ? "bg-[var(--color-warning)]"
      : tone === "neutral"
        ? "bg-[var(--color-border)]"
        : "bg-[var(--color-primary)]";

  return (
    <div className="hover-lift institutional-panel px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
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
        wasFavorite ? "Retiré de vos consultations suivies." : "Ajouté à vos consultations suivies.",
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
  const viewMode = searchParams.get("view") === "expert" ? "expert" : "guided";

  // Un résultat vide « à cause des filtres » n'est pas un catalogue vide : on
  // distingue les deux pour proposer la bonne action (réinitialiser vs patienter).
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

  function setViewMode(mode: "guided" | "expert") {
    const params = new URLSearchParams(searchParams);
    params.set("view", mode);
    setSearchParams(params);
  }

  function resetFilters() {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    setSearchParams(params);
  }

  function updateFilters(newFilters: Partial<TenderFilters>, keepUrgent = urgentSegmentActive) {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (k === "page" && Number(v) <= 1) return;
      if (k === "per_page" && Number(v) === 20) return;
      if (k === "sort" && v === "deadline") return;
      if (k === "order" && v === "asc") return;
      params.set(k, String(v));
    });
    if (keepUrgent && newFilters.status === "en_cours") params.set("urgent", "true");
    params.set("view", viewMode);
    setSearchParams(params);
  }

  function selectStatusSegment(segment: (typeof STATUS_SEGMENTS)[number]) {
    updateFilters(
      { ...filters, ...segment.filters, page: 1 },
      segment.key === "urgent",
    );
  }

  function handleSort(field: string) {
    const newOrder = filters.sort === field && filters.order === "asc" ? "desc" : "asc";
    updateFilters({ ...filters, sort: field, order: newOrder, page: 1 });
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

  const displayedTenders = useMemo(
    () =>
      urgentSegmentActive
        ? result?.data.filter((tender) => getTenderUrgency(tender.deadline)?.tone === "critical") || []
        : result?.data || [],
    [result, urgentSegmentActive],
  );

  const pageSummary = useMemo(() => {
    const tenders = result?.data || [];
    const active = tenders.filter((tender) => tender.status === "en_cours").length;
    const urgent = tenders.filter((tender) => getTenderUrgency(tender.deadline)?.tone === "critical").length;
    const expired = tenders.filter((tender) => tender.status === "cloture").length;
    return { active, urgent, expired, shown: displayedTenders.length };
  }, [result, displayedTenders.length]);

  // Catalogue réellement vide (aucune donnée, aucun filtre) : on masque tout le
  // cockpit (stats à zéro, bandeau, onglets, filtres) pour une page calme.
  const catalogEmpty = Boolean(result) && !loading && !error && result!.total === 0 && !filtersActive;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 space-y-5">
      <Breadcrumbs items={[{ label: "Consultations" }]} />

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
            Marchés publics
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--color-ink)]">Consultations</h1>
          {result && !loading && !catalogEmpty && (
            <p className="mt-1 text-sm text-[var(--color-muted)] tabular-nums">
              {urgentSegmentActive
                ? `${displayedTenders.length} consultation${displayedTenders.length !== 1 ? "s" : ""} urgente${displayedTenders.length !== 1 ? "s" : ""} sur cette page`
                : `${result.total.toLocaleString("fr-FR")} résultats`}
            </p>
          )}
        </div>
        {result && !loading && result.total > 0 && (
          user ? (
            <div className="flex flex-wrap items-center gap-2">
              {filtersActive && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm font-sans font-semibold"
                  onClick={() => setSaveOpen((v) => !v)}
                >
                  Enregistrer cette recherche
                </button>
              )}
              {filtersActive && (
                <Link
                  to={`/alerts?${searchParams.toString()}`}
                  className="btn btn-outline btn-sm font-sans font-semibold"
                >
                  Créer une alerte
                </Link>
              )}
              <ExportDropdown total={result.total} onExport={handleExport} />
            </div>
          ) : (
            <Link
              to="/login"
              state={{ from: "/tenders" }}
              className="btn btn-outline btn-sm gap-1.5 normal-case font-sans"
            >
              <LockKeyhole size={14} />
              Exporter après connexion
            </Link>
          )
        )}
      </section>

      {user && saveOpen && filtersActive && (
        <div className="institutional-panel flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-end">
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
              className="input input-sm input-bordered mt-1 w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveSearch();
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={savingSearch || !saveName.trim()}
              onClick={handleSaveSearch}
            >
              Enregistrer
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
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

      {result && !loading && !catalogEmpty && (
        <section className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label="Sur cette page" value={pageSummary.shown} />
          <SummaryTile label="En cours" value={pageSummary.active} />
          <SummaryTile label="Urgentes" value={pageSummary.urgent} tone="warning" />
          <SummaryTile label="Expirées" value={pageSummary.expired} tone="neutral" />
        </section>
      )}

      {!catalogEmpty && (
      <>
      <div className="institutional-panel px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Comparez les opportunités avant d'ouvrir le détail.</p>
            <p className="text-xs text-[var(--color-muted)]">La vue guidée met en avant le délai, le lieu, le budget et les points à vérifier.</p>
          </div>
          <div className="join">
            <button type="button" aria-pressed={viewMode === "guided"} className={`btn join-item btn-sm rounded ${viewMode === "guided" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("guided")}>Guidée</button>
            <button type="button" aria-pressed={viewMode === "expert"} className={`btn join-item btn-sm rounded ${viewMode === "expert" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("expert")}>Tableau</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Statut des consultations">
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
              className={`rounded-full px-4 py-1.5 font-sans text-sm font-semibold transition-all motion-reduce:transition-none ${
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-card"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[color-mix(in_srgb,var(--color-border-subtle)_70%,transparent)] hover:text-[var(--color-ink)] hover:ring-[var(--color-primary)]"
              }`}
              onClick={() => selectStatusSegment(segment)}
            >
              {segment.label}
            </button>
          );
        })}
      </div>

      <FilterBar filters={filters} onChange={updateFilters} />
      </>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : error ? (
        <div className="border border-[var(--color-danger)] border-l-4 rounded-lg px-4 py-3">
          <p className="font-sans text-sm text-[var(--color-ink)]">{error}</p>
          <button className="btn btn-sm btn-primary mt-3" onClick={() => updateFilters({ ...filters })}>
            Réessayer
          </button>
        </div>
      ) : result && displayedTenders.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            title="Aucune consultation ne correspond à vos critères."
            description="Élargissez ou réinitialisez vos filtres pour voir plus de résultats."
            action={
              <button className="btn btn-sm btn-primary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            }
          />
        ) : (
          <EmptyState
            size="md"
            icon={Inbox}
            title="Aucune consultation disponible pour le moment."
            description="De nouvelles consultations sont ajoutées régulièrement. Revenez bientôt."
          />
        )
      ) : result ? (
        <>
          {viewMode === "guided" ? (
            <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-4">
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
          ) : (
            <TenderTable
              tenders={displayedTenders}
              sort={filters.sort || "deadline"}
              order={filters.order || "asc"}
              onSort={handleSort}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {/* La segmentation « Urgentes » filtre la page courante côté client :
              paginer n'aurait pas de sens, on la masque dans ce mode. */}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
