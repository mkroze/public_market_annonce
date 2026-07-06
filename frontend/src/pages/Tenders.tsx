import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getTenders, getFavoriteIds, exportTenders } from "../lib/api";
import type { TenderListResponse, TenderFilters } from "../lib/types";
import { useAuth } from "../lib/auth";
import FilterBar from "../components/FilterBar";
import TenderTable from "../components/TenderTable";
import Pagination from "../components/Pagination";
import ExportDropdown from "../components/ExportDropdown";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";

export default function Tenders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<TenderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const { user } = useAuth();

  const filters: Partial<TenderFilters> = {
    q: searchParams.get("q") || "",
    category: searchParams.get("category") || "",
    sector: searchParams.get("sector") || "",
    entity: searchParams.get("entity") || "",
    location: searchParams.get("location") || "",
    sort: searchParams.get("sort") || "deadline",
    order: searchParams.get("order") || "asc",
    page: Number(searchParams.get("page")) || 1,
  };

  function addToast(message: string, type: ToastData["type"] = "info") {
    setToasts((prev) => [...prev, createToast(message, type)]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenders(filters);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [searchParams.toString()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getFavoriteIds();
      setFavoriteIds(new Set(res.ids));
    } catch {}
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  function updateFilters(newFilters: Partial<TenderFilters>) {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v && String(v) !== "1" || k === "page" && Number(v) > 1) {
        params.set(k, String(v));
      }
    });
    setSearchParams(params);
  }

  function handleSort(field: string) {
    const newOrder = filters.sort === field && filters.order === "asc" ? "desc" : "asc";
    updateFilters({ ...filters, sort: field, order: newOrder, page: 1 });
  }

  async function handleExport(format: "csv" | "excel" | "json") {
    const formatLabels = { csv: "CSV", excel: "Excel", json: "JSON" };
    addToast(`Preparation de l'export ${formatLabels[format]}...`, "info");
    try {
      await exportTenders(filters, format);
      addToast(`Export ${formatLabels[format]} termine avec succes`, "success");
    } catch {
      addToast("Erreur lors de l'export. Veuillez reessayer.", "error");
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-5">
      {/* Header row with title and export */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Consultations</h1>
          {result && !loading && (
            <p className="text-sm text-[var(--color-slate)] mt-0.5 tabular-nums font-sans">
              {result.total.toLocaleString("fr-FR")} resultats
            </p>
          )}
        </div>
        {result && !loading && result.total > 0 && (
          <ExportDropdown total={result.total} onExport={handleExport} />
        )}
      </div>

      <FilterBar filters={filters} onChange={updateFilters} />

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : result ? (
        <>
          <TenderTable
            tenders={result.data}
            sort={filters.sort || "deadline"}
            order={filters.order || "asc"}
            onSort={handleSort}
            favoriteIds={favoriteIds}
            onFavoriteToggle={loadFavorites}
          />
          <Pagination
            page={result.page}
            pages={result.pages}
            total={result.total}
            onPageChange={(p) => updateFilters({ ...filters, page: p })}
          />
        </>
      ) : (
        <div className="alert alert-warning">
          Aucune donnée. Lancez d'abord un import depuis la page d'accueil.
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
