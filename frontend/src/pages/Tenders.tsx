import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTenders, exportTenders } from "../lib/api";
import type { TenderListResponse, TenderFilters } from "../lib/types";
import FilterBar from "../components/FilterBar";
import TenderCard from "../components/TenderCard";
import TenderTable from "../components/TenderTable";
import Pagination from "../components/Pagination";
import ExportDropdown from "../components/ExportDropdown";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import { getTenderUrgency } from "../lib/tenderUtils";

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
  const accent =
    tone === "warning"
      ? "border-l-[var(--color-warning)]"
      : tone === "neutral"
        ? "border-l-[var(--color-border)]"
        : "border-l-[var(--color-primary)]";

  return (
    <div className={`institutional-panel border-l-4 ${accent} px-4 py-3`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</div>
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

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 space-y-5">
      <Breadcrumbs items={[{ label: "Consultations" }]} />

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
            Marchés publics
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--color-ink)]">Consultations</h1>
          {result && !loading && (
            <p className="mt-1 text-sm text-[var(--color-muted)] tabular-nums">
              {urgentSegmentActive
                ? `${displayedTenders.length} consultation${displayedTenders.length !== 1 ? "s" : ""} urgente${displayedTenders.length !== 1 ? "s" : ""} sur cette page`
                : `${result.total.toLocaleString("fr-FR")} résultats`}
            </p>
          )}
        </div>
        {result && !loading && result.total > 0 && (
          <ExportDropdown total={result.total} onExport={handleExport} />
        )}
      </section>

      {result && !loading && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Sur cette page" value={pageSummary.shown} />
          <SummaryTile label="En cours" value={pageSummary.active} />
          <SummaryTile label="Urgentes" value={pageSummary.urgent} tone="warning" />
          <SummaryTile label="Expirées" value={pageSummary.expired} tone="neutral" />
        </section>
      )}

      <div className="institutional-panel px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Comparez les opportunités avant d'ouvrir le détail.</p>
            <p className="text-xs text-[var(--color-muted)]">La vue guidée met en avant le délai, le lieu, le budget et les points à vérifier.</p>
          </div>
          <div className="join">
            <button type="button" className={`btn join-item btn-sm rounded ${viewMode === "guided" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("guided")}>Guidée</button>
            <button type="button" className={`btn join-item btn-sm rounded ${viewMode === "expert" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("expert")}>Tableau</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-subtle)]" role="tablist" aria-label="Statut des consultations">
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
              role="tab"
              aria-selected={active}
              className={`border-b-2 px-3 py-2 font-sans text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--color-crimson)] text-[var(--color-crimson)]"
                  : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
              }`}
              onClick={() => selectStatusSegment(segment)}
            >
              {segment.label}
            </button>
          );
        })}
      </div>

      <FilterBar filters={filters} onChange={updateFilters} />

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : error ? (
        <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3">
          <p className="font-sans text-sm text-[var(--color-charcoal)]">{error}</p>
          <button className="btn btn-sm btn-primary mt-3" onClick={() => updateFilters({ ...filters })}>
            Réessayer
          </button>
        </div>
      ) : result && displayedTenders.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-6 py-14 text-center">
          <p className="font-display text-lg text-[var(--color-ink)]">
            {filtersActive
              ? "Aucune consultation ne correspond à vos critères."
              : "Aucune consultation disponible pour le moment."}
          </p>
          <p className="mt-1 font-sans text-sm text-[var(--color-muted)]">
            {filtersActive
              ? "Élargissez ou réinitialisez vos filtres pour voir plus de résultats."
              : "De nouvelles consultations sont ajoutées régulièrement. Revenez bientôt."}
          </p>
          {filtersActive && (
            <button className="btn btn-sm btn-primary mt-4" onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : result ? (
        <>
          {viewMode === "guided" ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {displayedTenders.map((tender) => (
                <TenderCard
                  key={tender.id}
                  tender={tender}
                />
              ))}
            </div>
          ) : (
            <TenderTable
              tenders={displayedTenders}
              sort={filters.sort || "deadline"}
              order={filters.order || "asc"}
              onSort={handleSort}
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
