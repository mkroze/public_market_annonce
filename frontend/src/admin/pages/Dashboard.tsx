import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, Globe, RefreshCw } from "lucide-react";
import { getOverview, ApiError } from "../api";
import type { AdminOverview } from "../types";
import { PageHeader, Panel, MetricCard, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";
import { ImportStatusBadge } from "../components/StatusBadge";

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    getOverview()
      .then(setData)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading dashboard" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error || !data) return <FailedState message={error?.message} onRetry={load} />;

  const f = data.freshness;
  const q = data.failure_queues;

  return (
    <div>
      <PageHeader
        title="Operational dashboard"
        description="Import health, data freshness, and governance at a glance."
      />

      {/* Freshness */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Tenders" value={f.tender_count.toLocaleString("fr-FR")} sub={`Source: ${f.source}`} />
        <MetricCard
          label="Detail coverage"
          value={`${f.detail_coverage_pct}%`}
          sub={`${f.detail_count.toLocaleString("fr-FR")} with detail`}
          tone={f.detail_coverage_pct < 50 ? "warning" : "neutral"}
        />
        <MetricCard label="Last scrape" value={<span className="text-base">{fmtDate(f.last_scraped_at)}</span>} sub="Newest tender timestamp" />
        <MetricCard label="Last success" value={<span className="text-base">{fmtDate(f.last_successful_import_at)}</span>} sub="Completed import" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Latest import */}
        <Panel title="Latest import">
          {data.last_import ? (
            <div className="p-4 text-sm font-sans space-y-2">
              <div className="flex items-center justify-between">
                <ImportStatusBadge status={data.last_import.status} />
                <span className="text-[var(--color-slate)]">
                  {data.last_import.trigger === "manual" ? "Manual" : "Scheduled"}
                  {data.last_import.actor_email ? ` · ${data.last_import.actor_email}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[var(--color-charcoal)]">
                <span className="text-[var(--color-slate)]">Started</span><span>{fmtDate(data.last_import.started_at)}</span>
                <span className="text-[var(--color-slate)]">Finished</span><span>{fmtDate(data.last_import.finished_at)}</span>
                <span className="text-[var(--color-slate)]">Found</span><span className="tabular-nums">{data.last_import.tenders_found}</span>
                <span className="text-[var(--color-slate)]">New</span><span className="tabular-nums">{data.last_import.tenders_new}</span>
              </div>
              {data.last_import.error && (
                <p className="text-[var(--color-crimson)] break-words">{data.last_import.error}</p>
              )}
              <button
                onClick={() => navigate("/admin/imports")}
                className="text-[var(--color-crimson)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] rounded"
              >
                View import history →
              </button>
            </div>
          ) : (
            <p className="p-4 text-sm font-sans text-[var(--color-slate)]">No imports recorded yet.</p>
          )}
        </Panel>

        {/* System health */}
        <Panel title="System health">
          <ul className="p-4 text-sm font-sans space-y-2.5">
            <li className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--color-slate)]" aria-hidden />
              <span className="flex-1">Database</span>
              <span className="text-green-700 font-medium">Reachable</span>
            </li>
            <li className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--color-slate)]" aria-hidden />
              <span className="flex-1">Scraper source ({f.source})</span>
              <span className="text-[var(--color-slate)]">
                Last attempt {fmtDate(data.health.scraper_last_attempt_at)}
              </span>
            </li>
          </ul>
        </Panel>
      </div>

      {/* Failure queues */}
      <h2 className="font-sans font-semibold text-sm text-[var(--color-charcoal)] mt-6 mb-2">Failure &amp; exception queues</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Failed imports" value={q.failed_imports} tone={q.failed_imports ? "danger" : "neutral"} onClick={() => navigate("/admin/imports")} sub="View history" />
        <MetricCard label="Missing details" value={q.missing_details} tone={q.missing_details ? "warning" : "neutral"} onClick={() => navigate("/admin/tenders?detail=no")} sub="Review tenders" />
        <MetricCard label="Flagged" value={q.flagged_tenders} tone={q.flagged_tenders ? "warning" : "neutral"} onClick={() => navigate("/admin/tenders?review_status=flagged")} sub="Review tenders" />
        <MetricCard label="Archived" value={q.archived_tenders} onClick={() => navigate("/admin/tenders?admin_status=archived")} sub="Review tenders" />
        <MetricCard label="Stale (past deadline)" value={q.stale_records} tone={q.stale_records ? "warning" : "neutral"} onClick={() => navigate("/admin/tenders")} sub="Review tenders" />
      </div>

      {/* Governance */}
      <h2 className="font-sans font-semibold text-sm text-[var(--color-charcoal)] mt-6 mb-2">Recent governance activity</h2>
      <Panel>
        {data.governance.length === 0 ? (
          <p className="p-4 text-sm font-sans text-[var(--color-slate)]">No recent role changes, suspensions, or exports.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {data.governance.map((g) => (
              <li key={g.id} className="px-4 py-2.5 text-sm font-sans flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-[var(--color-slate)] shrink-0" aria-hidden />
                <span className="font-medium text-[var(--color-charcoal)]">{g.action}</span>
                <span className="text-[var(--color-slate)]">{g.actor_email || "system"}</span>
                <span className="ml-auto text-[var(--color-slate)] tabular-nums">{fmtDate(g.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-2.5 border-t border-[var(--color-border-subtle)]">
          <button onClick={() => navigate("/admin/audit-logs")} className="text-sm text-[var(--color-crimson)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] rounded">
            Open audit-log explorer →
          </button>
        </div>
      </Panel>
    </div>
  );
}
