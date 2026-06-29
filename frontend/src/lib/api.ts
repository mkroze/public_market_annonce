import type {
  TenderListResponse,
  TenderFilters,
  OverviewResponse,
  StatsResponse,
  FiltersResponse,
  TenderWithDetails,
} from "./types";

const BASE = "/api";

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getTenders(filters: Partial<TenderFilters> = {}): Promise<TenderListResponse> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.category) params.category = filters.category;
  if (filters.sector) params.sector = filters.sector;
  if (filters.entity) params.entity = filters.entity;
  if (filters.location) params.location = filters.location;
  if (filters.sort) params.sort = filters.sort;
  if (filters.order) params.order = filters.order;
  if (filters.page) params.page = String(filters.page);
  return fetchJSON<TenderListResponse>(`${BASE}/tenders`, params);
}

export function getTender(id: string): Promise<TenderWithDetails> {
  return fetchJSON<TenderWithDetails>(`${BASE}/tenders/${id}`);
}

export function getOverview(): Promise<OverviewResponse> {
  return fetchJSON<OverviewResponse>(`${BASE}/overview`);
}

export function getStats(): Promise<StatsResponse> {
  return fetchJSON<StatsResponse>(`${BASE}/stats`);
}

export function getFilters(): Promise<FiltersResponse> {
  return fetchJSON<FiltersResponse>(`${BASE}/filters`);
}

export function triggerScrape(): Promise<{ status: string; total_found: number; total_new: number }> {
  return fetch(`${BASE}/scrape`, { method: "POST" }).then((r) => r.json());
}

export async function downloadDce(tenderId: string): Promise<void> {
  const res = await fetch(`${BASE}/tenders/${tenderId}/dce`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(err.error || "Download failed");
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "dce.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
