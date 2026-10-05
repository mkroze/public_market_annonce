import { useCallback, useEffect, useState } from "react";
import { DownloadCloud, Loader2, Trash2 } from "lucide-react";
import { getDceCache, runDceCache, clearDceCache, steerPipeline, ApiError } from "../api";
import type { DceCacheRun, DceCacheStatus, SteerAction } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, fmtDate, duration, fmtBytes, ProgressBar } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import { usePipelinePolling } from "../hooks";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

export default function DceCache() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [status, setStatus] = useState<DceCacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canRun = can(user?.role, "imports.run");
  const active = status?.active ?? false;
  const cachedTotal = status?.cached_total ?? 0;

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    getDceCache()
      .then((res) => { setStatus(res); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(true); }, [load]);
  usePipelinePolling(() => load(false), active);

  async function steer(action: SteerAction) {
    try { await steerPipeline("dce-cache", action); push(`Cache run ${action}d`, "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : `Failed to ${action}`, "error"); }
  }

  async function doRun() {
    try { await runDceCache(); push("DCE cache run started", "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : "Failed to start DCE cache run", "error"); }
  }

  async function doClear(mode: "all" | "outdated") {
    try {
      const res = await clearDceCache(mode);
      push(`Cleared ${res.removed} cached DCE${res.removed === 1 ? "" : "s"} (${fmtBytes(res.freed_bytes)} freed)`, "success");
      load(false);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to clear cache", "error");
    }
  }

  function confirmRun() {
    setConfirm({
      title: "Download all DCEs",
      action: "Cache DCEs",
      target: "Every tender with a DCE",
      consequence: "Pre-downloads and caches each tender's DCE ZIP so users get instant, form-free downloads. Runs in the background, skips already-cached tenders, self-throttles on portal push-back, and stops if disk runs low. Pause or cancel it below any time.",
      reversible: true,
      confirmLabel: "Start caching",
      onConfirm: doRun,
    });
  }

  function confirmClear(mode: "all" | "outdated") {
    setConfirm({
      title: mode === "all" ? "Clear entire DCE cache" : "Clear outdated DCEs",
      action: mode === "all" ? "Clear all cached DCEs" : "Clear outdated cached DCEs",
      target: mode === "all" ? "Every cached DCE ZIP" : "Archived / past-deadline / removed tenders",
      consequence: mode === "all"
        ? "Deletes all cached DCE files from the server. Downloads will re-fetch and re-cache on demand — use this to force fresh copies."
        : "Deletes cached DCE files for tenders that are archived, past their deadline, or no longer in the catalog. Active tenders keep their cache.",
      reversible: true,
      confirmLabel: mode === "all" ? "Clear all" : "Clear outdated",
      danger: mode === "all",
      onConfirm: () => doClear(mode),
    });
  }

  if (loading) return <LoadingState label="Loading DCE cache" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => load(true)} />;

  const runs = status?.data ?? [];
  const cachedBytes = status?.cached_bytes ?? 0;
  const capBytes = status?.cap_bytes ?? 0;
  const maxPerRun = status?.max_downloads_per_run ?? 0;

  const columns: Column<DceCacheRun>[] = [
    { header: "#", cell: (r) => r.id, className: "text-[var(--color-slate)] tabular-nums" },
    { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
    { header: "Actor", cell: (r) => <span className="text-[var(--color-slate)]">{r.actor_email || "—"}</span> },
    { header: "Started", cell: (r) => <span className="tabular-nums">{fmtDate(r.started_at)}</span> },
    { header: "Duration", cell: (r) => <span className="tabular-nums">{duration(r)}</span> },
    { header: "Threads", align: "right", cell: (r) => r.concurrency ?? "—" },
    { header: "Pauses", align: "right", cell: (r) => r.pauses ?? 0 },
    { header: "Cached", align: "right", cell: (r) => r.cached },
    { header: "Skipped", align: "right", cell: (r) => r.skipped },
    { header: "Failed", align: "right", cell: (r) => <span className="text-[var(--color-crimson)]">{r.failed}</span> },
    { header: "Total", align: "right", cell: (r) => <span className="text-[var(--color-slate)]">{r.total}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="DCE cache"
        description="Pre-download tender documents (DCE ZIPs) so users get instant, form-free downloads."
        actions={
          <PipelineControls
            active={active}
            paused={status?.paused ?? false}
            canRun={canRun}
            onRun={confirmRun}
            onSteer={steer}
            runLabel="Cache DCEs"
            runIcon={<DownloadCloud className="w-4 h-4" aria-hidden />}
            runningReason="A DCE cache run is already in progress"
          />
        }
      />

      <Panel title="Cache usage">
        <div className="px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-4 text-sm font-sans text-[var(--color-slate)]">
              <span><strong className="text-[var(--color-charcoal)] tabular-nums">{cachedTotal}</strong> DCE{cachedTotal === 1 ? "" : "s"} cached</span>
              {capBytes > 0 && (
                <span className="tabular-nums"><strong className="text-[var(--color-charcoal)]">{fmtBytes(cachedBytes)}</strong> / {fmtBytes(capBytes)} cap</span>
              )}
              {maxPerRun > 0 && (
                <span className="tabular-nums">max <strong className="text-[var(--color-charcoal)]">{maxPerRun}</strong>/run</span>
              )}
              {active && (
                <span className="inline-flex items-center gap-1.5 text-[var(--color-gold)]">
                  <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden />
                  {status?.paused ? "paused" : "caching in progress"} — refreshes automatically
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => confirmClear("outdated")}
                disabled={!canRun || active || cachedTotal === 0}
                title={!canRun ? "Requires imports.run permission" : active ? "A DCE cache run is in progress" : undefined}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear outdated
              </button>
              <button
                onClick={() => confirmClear("all")}
                disabled={!canRun || active || cachedTotal === 0}
                title={!canRun ? "Requires imports.run permission" : active ? "A DCE cache run is in progress" : undefined}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-crimson)]/40 text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/5 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear all
              </button>
            </div>
          </div>
          {capBytes > 0 && <ProgressBar value={cachedBytes} max={capBytes} />}
        </div>
      </Panel>

      <div className="mt-6">
        <Panel title="Cache run history">
          <div className="px-1 pb-1">
            <RunHistoryTable
              columns={columns}
              rows={runs}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No DCE cache runs yet" hint="Run “Cache DCEs” to pre-download every tender’s documents." />}
            />
          </div>
        </Panel>
      </div>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
