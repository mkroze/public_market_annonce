import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, X } from "lucide-react";
import { getAuditLogs, exportAuditLogs, ApiError } from "../api";
import type { AuditEvent } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, GatedButton, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState, FilteredEmptyState } from "../components/StateBlock";
import { ResultBadge } from "../components/StatusBadge";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";
import Pagination from "../../components/Pagination";

const FILTER_KEYS = ["q", "action", "target_type", "result", "date_from", "date_to"];

export default function AuditLogs() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ rows: AuditEvent[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [detail, setDetail] = useState<AuditEvent | null>(null);

  const canExport = can(user?.role, "audit.export");
  const page = Number(params.get("page") || "1");
  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  const load = useCallback(() => {
    setLoading(true);
    const p: Record<string, string> = { page: String(page), per_page: "50" };
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) p[k] = v; });
    getAuditLogs(p)
      .then((res) => { setData({ rows: res.data, total: res.total, pages: res.pages }); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [params, page]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  function clearFilters() { setParams(new URLSearchParams()); }

  async function doExport() {
    const p: Record<string, string> = {};
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) p[k] = v; });
    try {
      await exportAuditLogs(p);
      push("Audit logs exported", "success");
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Export failed", "error");
    }
  }

  const inputCls = "input input-bordered input-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

  return (
    <div>
      <PageHeader
        title="Audit-log explorer"
        description="Every sensitive admin action and access denial, with actor and result."
        actions={
          <GatedButton allowed={canExport} reason="Requires audit.export permission" onClick={doExport}>
            <Download className="w-4 h-4" aria-hidden /> Export audit logs
          </GatedButton>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input aria-label="Search action, target, route" placeholder="Search action, target, route" className={`${inputCls} w-64`}
          defaultValue={params.get("q") || ""} onKeyDown={(e) => { if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value); }} />
        <select aria-label="Result" className={`select select-bordered select-sm ${inputCls}`} value={params.get("result") || ""} onChange={(e) => setFilter("result", e.target.value)}>
          <option value="">Any result</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="failure">Failure</option>
          <option value="denied">Denied</option>
        </select>
        <select aria-label="Target type" className={`select select-bordered select-sm ${inputCls}`} value={params.get("target_type") || ""} onChange={(e) => setFilter("target_type", e.target.value)}>
          <option value="">Any target</option>
          <option value="tender">Tender</option>
          <option value="user">User</option>
          <option value="import">Import</option>
          <option value="audit_log">Audit log</option>
          <option value="permission">Permission</option>
        </select>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          From <input type="date" aria-label="Date from" className={inputCls} value={params.get("date_from") || ""} onChange={(e) => setFilter("date_from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          To <input type="date" aria-label="Date to" className={inputCls} value={params.get("date_to") || ""} onChange={(e) => setFilter("date_to", e.target.value)} />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
            Clear filters
          </button>
        )}
      </div>

      <Panel>
        {loading ? (
          <LoadingState label="Loading audit logs" />
        ) : error?.status === 403 ? (
          <DeniedState message={error.message} />
        ) : error ? (
          <FailedState message={error.message} onRetry={load} />
        ) : !data || data.rows.length === 0 ? (
          hasFilters ? <FilteredEmptyState onReset={clearFilters} /> : <EmptyState title="No audit events" hint="Actions will appear here as admins operate." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-4 py-2 font-medium">Time</th>
                  <th scope="col" className="px-4 py-2 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Action</th>
                  <th scope="col" className="px-4 py-2 font-medium">Target</th>
                  <th scope="col" className="px-4 py-2 font-medium">Result</th>
                  <th scope="col" className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-2">
                      <div className="text-[var(--color-charcoal)]">{e.actor_email || "system"}</div>
                      <div className="text-xs text-[var(--color-slate)]">{e.actor_role || "—"}</div>
                    </td>
                    <td className="px-4 py-2 font-medium">{e.action}</td>
                    <td className="px-4 py-2 text-[var(--color-slate)]">
                      {e.target_type ? `${e.target_type}${e.target_id ? ` · ${e.target_id}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2"><ResultBadge result={e.result} /></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setDetail(e)} className="text-xs text-[var(--color-crimson)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] rounded">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4">
              <Pagination page={page} pages={data.pages} total={data.total}
                onPageChange={(p) => { const next = new URLSearchParams(params); next.set("page", String(p)); setParams(next); }} />
            </div>
          </div>
        )}
      </Panel>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label="Audit event detail">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-md bg-base-100 border-l border-[var(--color-border-subtle)] h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-[var(--color-charcoal)]">Audit event #{detail.id}</h2>
              <button onClick={() => setDetail(null)} aria-label="Close" className="p-1 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <dl className="text-sm font-sans space-y-2">
              <Row label="Time" value={fmtDate(detail.created_at)} />
              <Row label="Actor" value={`${detail.actor_email || "system"} (${detail.actor_role || "—"})`} />
              <Row label="Action" value={detail.action} />
              <Row label="Target" value={detail.target_type ? `${detail.target_type} ${detail.target_id || ""}` : "—"} />
              <Row label="Result" value={<ResultBadge result={detail.result} />} />
              <Row label="Route" value={detail.route || "—"} />
              <Row label="IP" value={detail.ip || "—"} />
            </dl>
            {(detail.before_json || detail.after_json) && (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {detail.before_json && <JsonBlock title="Before" json={detail.before_json} />}
                {detail.after_json && <JsonBlock title="After" json={detail.after_json} />}
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--color-slate)]">{label}</dt>
      <dd className="text-[var(--color-charcoal)] text-right break-words">{value}</dd>
    </div>
  );
}

function JsonBlock({ title, json }: { title: string; json: string }) {
  let pretty = json;
  try { pretty = JSON.stringify(JSON.parse(json), null, 2); } catch { /* keep raw */ }
  return (
    <div>
      <div className="text-xs font-sans uppercase tracking-wide text-[var(--color-slate)] mb-1">{title}</div>
      <pre className="text-xs font-mono bg-[var(--color-ivory-dim)] rounded p-2 overflow-x-auto text-[var(--color-charcoal)]">{pretty}</pre>
    </div>
  );
}
