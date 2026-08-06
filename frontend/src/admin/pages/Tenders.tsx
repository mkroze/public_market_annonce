import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Eye, Flag, Archive, ArchiveRestore, RefreshCw } from "lucide-react";
import { getAdminTenders, batchTenders, ApiError } from "../api";
import type { AdminTender, BatchResult } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, fmtDateOnly } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState, FilteredEmptyState } from "../components/StateBlock";
import { ReviewStatusBadge, AdminStatusBadge, DetailBadge } from "../components/StatusBadge";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";
import Pagination from "../../components/Pagination";

const FILTER_KEYS = ["q", "category", "sector", "status", "review_status", "admin_status", "detail", "sort", "order"];

export default function AdminTenders() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ rows: AdminTender[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canModerate = can(user?.role, "tenders.moderate");
  const page = Number(params.get("page") || "1");
  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  const load = useCallback(() => {
    setLoading(true);
    const p: Record<string, string> = { page: String(page), per_page: "25" };
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) p[k] = v; });
    getAdminTenders(p)
      .then((res) => {
        setData({ rows: res.data, total: res.total, pages: res.pages });
        setError(null);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [params, page]);

  useEffect(() => { load(); setSelected(new Set()); }, [load]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  function clearFilters() {
    setParams(new URLSearchParams());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((prev) =>
      prev.size === data.rows.length ? new Set() : new Set(data.rows.map((r) => r.id)),
    );
  }

  async function runBatch(action: string, ids: string[], note?: string) {
    try {
      const res: BatchResult = await batchTenders(action, ids, note);
      if (res.result === "success") push(`${res.updated.length} tender(s) updated`, "success");
      else if (res.result === "partial") push(`${res.updated.length} updated, ${res.failed.length} failed`, "info", 6000);
      else push(`All ${res.failed.length} failed: ${res.failed[0]?.reason ?? ""}`, "error", 6000);
      setSelected(new Set());
      load();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Batch action failed", "error");
    }
  }

  function confirmBatch(action: string, label: string, consequence: string, reversible: boolean, danger?: boolean) {
    const ids = [...selected];
    setConfirm({
      title: label,
      action: label,
      target: `${ids.length} tender${ids.length !== 1 ? "s" : ""}`,
      consequence,
      reversible,
      confirmLabel: label,
      danger,
      onConfirm: () => runBatch(action, ids),
    });
  }

  const inputCls = "input input-bordered input-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

  return (
    <div>
      <PageHeader title="Tender administration" description="Review, moderate, and moderate data quality across ingested tenders." />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input aria-label="Search tenders" placeholder="Search title, reference, entity, ID" className={`${inputCls} w-64`}
          defaultValue={params.get("q") || ""} onKeyDown={(e) => { if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value); }} />
        <select aria-label="Category" className={`select select-bordered select-sm ${inputCls}`} value={params.get("category") || ""} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">All categories</option>
          <option value="Travaux">Travaux</option>
          <option value="Fournitures">Fournitures</option>
          <option value="Services">Services</option>
        </select>
        <select aria-label="Review status" className={`select select-bordered select-sm ${inputCls}`} value={params.get("review_status") || ""} onChange={(e) => setFilter("review_status", e.target.value)}>
          <option value="">Any review status</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
          <option value="flagged">Flagged</option>
        </select>
        <select aria-label="Admin status" className={`select select-bordered select-sm ${inputCls}`} value={params.get("admin_status") || ""} onChange={(e) => setFilter("admin_status", e.target.value)}>
          <option value="">Active + archived</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select aria-label="Detail availability" className={`select select-bordered select-sm ${inputCls}`} value={params.get("detail") || ""} onChange={(e) => setFilter("detail", e.target.value)}>
          <option value="">Any detail</option>
          <option value="yes">Has detail</option>
          <option value="no">Missing detail</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
            Clear filters
          </button>
        )}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)]">
          <span className="text-sm font-sans font-medium">{selected.size} selected</span>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <BatchBtn allowed={canModerate} onClick={() => confirmBatch("mark_reviewed", "Mark reviewed", "Marks the selected tenders as reviewed.", true)} icon={<Eye className="w-3.5 h-3.5" aria-hidden />} label="Mark reviewed" />
            <BatchBtn allowed={canModerate} onClick={() => confirmBatch("flag", "Flag data issue", "Flags the selected tenders for a data-quality issue.", true)} icon={<Flag className="w-3.5 h-3.5" aria-hidden />} label="Flag issue" />
            <BatchBtn allowed={canModerate} onClick={() => confirmBatch("retry_detail", "Retry detail fetch", "Re-fetches detail pages for the selected tenders from the source portal.", true)} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />} label="Retry detail" />
            <BatchBtn allowed={canModerate} onClick={() => confirmBatch("archive", "Archive tenders", "Hides the selected tenders from active review. They can be restored later.", true)} icon={<Archive className="w-3.5 h-3.5" aria-hidden />} label="Archive" />
            <BatchBtn allowed={canModerate} onClick={() => confirmBatch("restore", "Restore tenders", "Restores the selected archived tenders to active status.", true)} icon={<ArchiveRestore className="w-3.5 h-3.5" aria-hidden />} label="Restore" />
          </div>
        </div>
      )}

      <Panel>
        {loading ? (
          <LoadingState label="Loading tenders" />
        ) : error?.status === 403 ? (
          <DeniedState message={error.message} />
        ) : error ? (
          <FailedState message={error.message} onRetry={load} />
        ) : !data || data.rows.length === 0 ? (
          hasFilters ? <FilteredEmptyState onReset={clearFilters} /> : <EmptyState title="No tenders" hint="Run an import to ingest tenders." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-3 py-2 w-8">
                    <input type="checkbox" aria-label="Select all rows" className="checkbox checkbox-sm"
                      checked={selected.size === data.rows.length && data.rows.length > 0} onChange={toggleAll} />
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">Reference / Title</th>
                  <th scope="col" className="px-3 py-2 font-medium">Entity</th>
                  <th scope="col" className="px-3 py-2 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2 font-medium">Deadline</th>
                  <th scope="col" className="px-3 py-2 font-medium">Detail</th>
                  <th scope="col" className="px-3 py-2 font-medium">Review</th>
                  <th scope="col" className="px-3 py-2 font-medium">State</th>
                  <th scope="col" className="px-3 py-2 font-medium text-right">Links</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${t.reference}`} className="checkbox checkbox-sm"
                        checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <div className="font-medium text-[var(--color-charcoal)] truncate" title={t.title}>{t.title || "—"}</div>
                      <div className="text-xs text-[var(--color-slate)]">{t.reference}</div>
                    </td>
                    <td className="px-3 py-2 max-w-[12rem] truncate" title={t.entity}>{t.entity}</td>
                    <td className="px-3 py-2">{t.category}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtDateOnly(t.deadline)}</td>
                    <td className="px-3 py-2"><DetailBadge available={!!t.detail_available} /></td>
                    <td className="px-3 py-2"><ReviewStatusBadge status={t.review_status} /></td>
                    <td className="px-3 py-2"><AdminStatusBadge status={t.admin_status} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a href={`/tenders/${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer"
                        aria-label="View tender detail" title="View tender detail"
                        className="inline-flex p-1 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                        <Eye className="w-4 h-4" aria-hidden />
                      </a>
                      <a href={`https://www.marchespublics.gov.ma`} target="_blank" rel="noreferrer"
                        aria-label="Open source portal" title="Open source portal"
                        className="inline-flex p-1 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                        <ExternalLink className="w-4 h-4" aria-hidden />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3">
              <Pagination page={page} pages={data.pages} total={data.total}
                onPageChange={(p) => { const next = new URLSearchParams(params); next.set("page", String(p)); setParams(next); }} />
            </div>
          </div>
        )}
      </Panel>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function BatchBtn({ allowed, onClick, icon, label }: { allowed: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      title={!allowed ? "Requires tenders.moderate permission" : undefined}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans rounded border border-[var(--color-border-subtle)] bg-base-100 hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon} {label}
    </button>
  );
}
