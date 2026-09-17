// Admin API client. Reuses the token-header + structured-error pattern from
// lib/api.ts, but surfaces the backend's `detail` message and HTTP status so
// pages can render permission-denied vs. generic-failure states distinctly.

import type {
  AdminOverview, AdminTender, Paginated, BatchResult,
  AdminUser, AdminUserDetail, RoleInfo, AuditEvent, ImportRun, DceExtractionStatus,
  EmailSettings, EmailSettingsPatch,
  WebsiteCost, WebsiteCostPayload, WebsiteCostSummary,
  ImportsStatus, DceCacheStatus, ScrapePreview, PipelineStage, SteerAction, SteerResult,
  CronJob, CronUpdatePayload,
} from "./types";
import type { CompanyProfile } from "../lib/types";

const BASE = "/api/admin";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  opts: { method?: string; params?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const headers: Record<string, string> = { ...authHeaders() };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, detail?.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Overview ──
export const getOverview = () => request<AdminOverview>("/overview");

// ── Tenders ──
export const getAdminTenders = (params: Record<string, string>) =>
  request<Paginated<AdminTender>>("/tenders", { params });

export const batchTenders = (action: string, ids: string[], note?: string) =>
  request<BatchResult>("/tenders/batch", { method: "POST", body: { action, ids, note } });

export const cleanupExpired = (clearCache: boolean) =>
  request<{ matched: number; archived: number; dce_removed: number; dce_freed_bytes: number; dce_error: string | null }>(
    "/tenders/cleanup-expired",
    { method: "POST", params: clearCache ? { clear_dce_cache: "true" } : {}, body: { confirmation: "ARCHIVE EXPIRED" } },
  );

// ── Scrape / imports ──
export const getImports = () => request<ImportsStatus>("/imports");

export const getImportDetail = (id: number) => request<ImportRun>(`/imports/${id}`);

export const runImport = () => request<{ status: string }>("/imports", { method: "POST" });

export const retryImport = (id: number) =>
  request<{ status: string }>(`/imports/${id}/retry`, { method: "POST" });

export const scrapePreview = () => request<ScrapePreview>("/scrape/preview");

// ── DCE cache ──
export const getDceCache = () => request<DceCacheStatus>("/dce-cache");

export const runDceCache = () => request<{ status: string }>("/dce-cache", { method: "POST" });

export const clearDceCache = (mode: "all" | "outdated") =>
  request<{ removed: number; freed_bytes: number; mode: string }>("/dce-cache/clear", { method: "POST", params: { mode } });

// ── Pipeline steering (pause / resume / cancel), shared across the 3 stages ──
export const steerPipeline = (stage: PipelineStage, action: SteerAction) =>
  request<SteerResult>(`/${stage}/control/${action}`, { method: "POST" });

// ── DCE extraction ──
export const getDceExtraction = () => request<DceExtractionStatus>("/dce-extraction/status");

export const runDceExtraction = () => request<{ status: string }>("/dce-extraction/run", { method: "POST" });

export const simulateDceExtraction = (tenderId?: string) =>
  request<{ tender_id: string; title: string | null; extraction: unknown }>(
    "/dce-extraction/simulate",
    { method: "POST", body: tenderId ? { tender_id: tenderId } : {} },
  );

// ── Users ──
export const getUsers = (params: Record<string, string>) =>
  request<{ data: AdminUser[] }>("/users", { params });

export const setUserStatus = (id: number, status: string) =>
  request<{ id: number; status: string }>(`/users/${id}`, { method: "PATCH", body: { status } });

export const setUserRole = (id: number, role: string) =>
  request<{ id: number; role: string }>(`/users/${id}/role`, { method: "PATCH", body: { role } });

export const getUserDetail = (id: number) =>
  request<AdminUserDetail>(`/users/${id}`);

export const overrideUserProfile = (id: number, body: Partial<CompanyProfile>) =>
  request<AdminUserDetail>(`/users/${id}/profile`, { method: "PATCH", body });

// ── Cron jobs (editable schedules) ──
export const getCron = () => request<{ data: CronJob[] }>("/cron");

export const updateCron = (job: string, body: CronUpdatePayload) =>
  request<CronJob>(`/cron/${job}`, { method: "PATCH", body });

export const runCron = (job: string) =>
  request<{ status: string }>(`/cron/${job}/run`, { method: "POST" });

// ── Roles ──
export const getRoles = () =>
  request<{ roles: RoleInfo[]; all_permissions: string[] }>("/roles");

// ── Settings: email / SMTP ──
export const getEmailSettings = () => request<EmailSettings>("/settings/email");

export const updateEmailSettings = (body: EmailSettingsPatch) =>
  request<EmailSettings>("/settings/email", { method: "PUT", body });

export const testEmailSettings = () =>
  request<{ status: string; to: string }>("/settings/email/test", { method: "POST" });

// ── Website costs ──
export const getCostSummary = () => request<WebsiteCostSummary>("/costs/summary");

export const getCosts = (params: Record<string, string>) =>
  request<Paginated<WebsiteCost>>("/costs", { params });

export const createCost = (body: WebsiteCostPayload) =>
  request<WebsiteCost>("/costs", { method: "POST", body });

export const updateCost = (id: number, body: WebsiteCostPayload) =>
  request<WebsiteCost>(`/costs/${id}`, { method: "PATCH", body });

export const markCostPaid = (id: number, paidDate?: string) =>
  request<WebsiteCost>(`/costs/${id}/mark-paid`, {
    method: "POST",
    body: paidDate ? { paid_date: paidDate } : {},
  });

export const archiveCost = (id: number) =>
  request<WebsiteCost>(`/costs/${id}/archive`, { method: "POST" });

// ── Audit logs ──
export const getAuditLogs = (params: Record<string, string>) =>
  request<Paginated<AuditEvent>>("/audit-logs", { params });

export async function exportAuditLogs(params: Record<string, string>): Promise<void> {
  const url = new URL(BASE + "/audit-logs/export", window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, detail?.detail || "Export failed");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "audit_logs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
