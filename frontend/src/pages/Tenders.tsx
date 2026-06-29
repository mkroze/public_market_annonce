import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getTenders } from "../lib/api";
import type { TenderListResponse, TenderFilters } from "../lib/types";
import FilterBar from "../components/FilterBar";
import TenderTable from "../components/TenderTable";
import Pagination from "../components/Pagination";

export default function Tenders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState<TenderListResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Consultations</h1>

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
    </div>
  );
}
