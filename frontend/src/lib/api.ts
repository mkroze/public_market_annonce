import type {
  TenderListResponse,
  TenderFilters,
  OverviewResponse,
  StatsResponse,
  FiltersResponse,
  TenderWithDetails,
  AuthResponse,
  User,
  CityStats,
  CityDetail,
  RegionStats,
  RegionDetail,
  SectorCategory,
  SectorDetailResponse,
  AlertPreference,
  AlertPreview,
  BlogPost,
  Tender,
} from "./types";

const BASE = "/api";

function tenderPathSegment(id: string): string {
  return encodeURIComponent(id);
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Session expirée / token invalide : le middleware backend renvoie 401 sur
 * toute route authentifiée. On purge le token et on renvoie l'utilisateur vers
 * la connexion plutôt que de le laisser sur un écran d'erreur sans issue.
 */
function handleUnauthorized() {
  localStorage.removeItem("token");
  const path = window.location.pathname;
  if (path !== "/login" && path !== "/register") {
    window.location.assign("/login");
  }
}

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Tenders ──

export function getTenders(filters: Partial<TenderFilters> = {}): Promise<TenderListResponse> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.category) params.category = filters.category;
  if (filters.sector) params.sector = filters.sector;
  if (filters.entity) params.entity = filters.entity;
  if (filters.location) params.location = filters.location;
  if (filters.status) params.status = filters.status;
  if (filters.procedure_type) params.procedure_type = filters.procedure_type;
  if (filters.sort) params.sort = filters.sort;
  if (filters.order) params.order = filters.order;
  if (filters.page) params.page = String(filters.page);
  if (filters.per_page) params.per_page = String(filters.per_page);
  return fetchJSON<TenderListResponse>(`${BASE}/tenders`, params);
}

export async function exportTenders(
  filters: Partial<TenderFilters>,
  format: "csv" | "excel" | "json",
): Promise<void> {
  const params = new URLSearchParams();
  params.set("format", format);
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.sector) params.set("sector", filters.sector);
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.location) params.set("location", filters.location);
  if (filters.status) params.set("status", filters.status);
  if (filters.procedure_type) params.set("procedure_type", filters.procedure_type);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);

  const res = await fetch(`${BASE}/tenders/export?${params.toString()}`, { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const ext = format === "json" ? "json" : "csv";
  const filename = match ? match[1] : `consultations.${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getTender(id: string): Promise<TenderWithDetails> {
  return fetchJSON<TenderWithDetails>(`${BASE}/tenders/${tenderPathSegment(id)}`);
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
  const res = await fetch(`${BASE}/tenders/${tenderPathSegment(tenderId)}/dce`, { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
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

export async function downloadPdf(tenderId: string): Promise<void> {
  const res = await fetch(`${BASE}/tenders/${tenderPathSegment(tenderId)}/pdf`, { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new Error("PDF export failed");
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "tender.pdf";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Auth ──

export async function register(data: { email: string; password: string; name: string; company?: string }): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export function getMe(): Promise<User> {
  return fetchJSON<User>(`${BASE}/auth/me`);
}

// ── Cities ──

export function getCities(): Promise<{ cities: CityStats[] }> {
  return fetchJSON(`${BASE}/cities`);
}

export function getCityDetail(name: string): Promise<CityDetail> {
  return fetchJSON(`${BASE}/cities/${encodeURIComponent(name)}`);
}

// ── Regions ──

export function getRegions(): Promise<{ regions: RegionStats[] }> {
  return fetchJSON(`${BASE}/regions`);
}

export function getRegionDetail(name: string): Promise<RegionDetail> {
  return fetchJSON(`${BASE}/regions/${encodeURIComponent(name)}`);
}

// ── Sectors ──

export function getSectors(): Promise<{ categories: SectorCategory[]; all_sectors: any[] }> {
  return fetchJSON(`${BASE}/sectors`);
}

export function getSectorDetail(code: string): Promise<SectorDetailResponse> {
  return fetchJSON(`${BASE}/sectors/${encodeURIComponent(code)}`);
}

// ── Favorites ──

export function getFavorites(): Promise<{ data: Tender[] }> {
  return fetchJSON(`${BASE}/favorites`);
}

export function getFavoriteIds(): Promise<{ ids: string[] }> {
  return fetchJSON(`${BASE}/favorites/ids`);
}

export async function addFavorite(tenderId: string): Promise<void> {
  await fetch(`${BASE}/favorites/${tenderId}`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function removeFavorite(tenderId: string): Promise<void> {
  await fetch(`${BASE}/favorites/${tenderId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ── Alerts ──

export function getAlerts(): Promise<{ data: AlertPreference[] }> {
  return fetchJSON(`${BASE}/alerts`);
}

export async function createAlert(data: Partial<AlertPreference>): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateAlert(id: number, data: Partial<AlertPreference>): Promise<void> {
  await fetch(`${BASE}/alerts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
}

export async function deleteAlert(id: number): Promise<void> {
  await fetch(`${BASE}/alerts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function previewAlert(data: Partial<AlertPreference>): Promise<AlertPreview> {
  const res = await fetch(`${BASE}/alerts/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function testAlertEmail(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/alerts/test-email`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `API error: ${res.status}`);
  return body;
}

// ── Assistant juridique ──

export async function askAssistant(question: string, procedure?: string): Promise<{ answer: string }> {
  const res = await fetch(`${BASE}/assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, procedure: procedure || "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "L'assistant est indisponible" }));
    throw new Error(err.detail || "L'assistant est indisponible");
  }
  return res.json();
}

// ── Blog ──

export function getBlogPosts(): Promise<{ posts: BlogPost[] }> {
  return fetchJSON(`${BASE}/blog`);
}

export function getBlogPost(slug: string): Promise<BlogPost> {
  return fetchJSON(`${BASE}/blog/${slug}`);
}
