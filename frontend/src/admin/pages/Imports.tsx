import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Loader2, DownloadCloud, Trash2 } from "lucide-react";
import { getImports, runImport, retryImport, getDceCache, runDceCache, clearDceCache, ApiError } from "../api";
import type { ImportRun, DceCacheRun } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, GatedButton, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { ImportStatusBadge } from "../components/StatusBadge";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

function duration(run: { started_at: string; finished_at: string | null }): string {
  if (!run.finished_at) return "—";
  const start = new Date(run.started_at.replace(" ", "T") + "Z").getTime();
  const end = new Date(run.finished_at.replace(" ", "T") + "Z").getTime();
  if (isNaN(start) || isNaN(end)) return "—";
  const s = Math.round((end - start) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtBytes(n: number): string {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export default function Imports() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const pollRef = useRef<number | null>(null);

  const [dceRuns, setDceRuns] = useState<DceCacheRun[]>([]);
  const [dceActive, setDceActive] = useState(false);
  const [dceCachedTotal, setDceCachedTotal] = useState(0);
  const [dceCachedBytes, setDceCachedBytes] = useState(0);
  const [dceCapBytes, setDceCapBytes] = useState(0);
  const dcePollRef = useRef<number | null>(null);

  const canRun = can(user?.role, "imports.run");
  const canRetry = can(user?.role, "imports.retry");

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    getImports()
      .then((res) => {
        setRuns(res.data);
        setActive(res.active);
        setError(null);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const loadDce = useCallback(() => {
    getDceCache()
      .then((res) => {
        setDceRuns(res.data);
        setDceActive(res.active);
        setDceCachedTotal(res.cached_total);
        setDceCachedBytes(res.cached_bytes);
        setDceCapBytes(res.cap_bytes);
      })
      .catch(() => { /* non-fatal: the import view still works without it */ });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDce(); }, [loadDce]);

  // While an import is running, poll so status transitions become visible.
  useEffect(() => {
    if (active) {
      pollRef.current = window.setInterval(() => load(false), 4000);
      return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    }
  }, [active, load]);

  // Same for a DCE cache warm-all run.
  useEffect(() => {
    if (dceActive) {
      dcePollRef.current = window.setInterval(() => loadDce(), 4000);
      return () => { if (dcePollRef.current) window.clearInterval(dcePollRef.current); };
    }
  }, [dceActive, loadDce]);

  async function doRun() {
    try {
      await runImport();
      push("Import started", "success");
      load(false);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to start import", "error");
    }
  }

  async function doRetry(run: ImportRun) {
    try {
      await retryImport(run.id);
      push(`Retry started (from run #${run.id})`, "success");
      load(false);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Retry failed", "error");
    }
  }

  async function doDceRun() {
    try {
      await runDceCache();
      push("DCE cache run started", "success");
      loadDce();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to start DCE cache run", "error");
    }
  }

  async function doClearDce(mode: "all" | "outdated") {
    try {
      const res = await clearDceCache(mode);
      push(`Cleared ${res.removed} cached DCE${res.removed === 1 ? "" : "s"} (${fmtBytes(res.freed_bytes)} freed)`, "success");
      loadDce();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to clear cache", "error");
    }
  }

  function confirmClearDce(mode: "all" | "outdated") {
    setConfirm({
      title: mode === "all" ? "Clear entire DCE cache" : "Clear outdated DCEs",
      action: mode === "all" ? "Clear all cached DCEs" : "Clear outdated cached DCEs",
      target: mode === "all" ? "Every cached DCE ZIP" : "Archived / past-deadline / removed tenders",
      consequence: mode === "all"
        ? "Deletes all cached DCE files from the server. Downloads will re-fetch and re-cache on demand — use this to force fresh copies."
        : "Deletes cached DCE files for tenders that are archived, past their deadline, or no longer in the catalog. Active tenders keep their cache.",
      reversible: true,
      confirmLabel: mode === "all" ? "Clear all" : "Clear outdated",
      onConfirm: () => doClearDce(mode),
    });
  }

  function confirmRun() {
    setConfirm({
      title: "Run full import",
      action: "Run import",
      target: "All configured sectors",
      consequence: "Scrapes marchespublics.gov.ma across all sectors and ingests new tenders. May take several minutes.",
      reversible: true,
      confirmLabel: "Run import",
      onConfirm: doRun,
    });
  }

  function confirmRetry(run: ImportRun) {
    setConfirm({
      title: "Retry import",
      action: "Retry failed import",
      target: `Run #${run.id}`,
      consequence: "Starts a fresh full import. The original run record is kept for history.",
      reversible: true,
      confirmLabel: "Retry import",
      onConfirm: () => doRetry(run),
    });
  }

  function confirmDceRun() {
    setConfirm({
      title: "Download all DCEs",
      action: "Cache DCEs",
      target: "Every tender with a DCE",
      consequence: "Pre-downloads and caches each tender's DCE ZIP on the server so users get instant, form-free downloads. Runs in the background, skips already-cached tenders, and may take a while. Stops automatically if disk space runs low.",
      reversible: true,
      confirmLabel: "Start caching",
      onConfirm: doDceRun,
    });
  }

  if (loading) return <LoadingState label="Loading imports" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => load()} />;

  return (
    <div>
      <PageHeader
        title="Import control center"
        description="Trigger scrapes, cache DCE documents, monitor progress, and inspect run history."
        actions={
          <div className="flex flex-wrap gap-2">
            <GatedButton
              allowed={canRun && !active}
              reason={active ? "An import is already running" : "Requires imports.run permission"}
              onClick={confirmRun}
            >
              <Play className="w-4 h-4" aria-hidden /> Run import
            </GatedButton>
            <GatedButton
              allowed={canRun && !dceActive}
              reason={dceActive ? "A DCE cache run is already in progress" : "Requires imports.run permission"}
              onClick={confirmDceRun}
            >
              <DownloadCloud className="w-4 h-4" aria-hidden /> Cache DCEs
            </GatedButton>
          </div>
        }
      />

      {active && (
        <div className="mb-5 flex items-center gap-2 border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 rounded px-4 py-3">
          <Loader2 className="w-4 h-4 text-[var(--color-gold)] motion-safe:animate-spin" aria-hidden />
          <span className="text-sm font-sans text-[var(--color-charcoal)]">An import is currently running. This view refreshes automatically.</span>
        </div>
      )}

      <Panel title="Import history">
        {runs.length === 0 ? (
          <EmptyState title="No imports yet" hint="Run an import to populate this history." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-4 py-2 font-medium">#</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Trigger</th>
                  <th scope="col" className="px-4 py-2 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Started</th>
                  <th scope="col" className="px-4 py-2 font-medium">Duration</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Found</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">New</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                    <td className="px-4 py-2 tabular-nums text-[var(--color-slate)]">{run.id}</td>
                    <td className="px-4 py-2"><ImportStatusBadge status={run.status} /></td>
                    <td className="px-4 py-2 capitalize">{run.trigger || "scheduled"}</td>
                    <td className="px-4 py-2 text-[var(--color-slate)]">{run.actor_email || "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{fmtDate(run.started_at)}</td>
                    <td className="px-4 py-2 tabular-nums">{duration(run)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{run.tenders_found}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{run.tenders_new}</td>
                    <td className="px-4 py-2 text-right">
                      {run.status === "failed" && (
                        <button
                          onClick={() => confirmRetry(run)}
                          disabled={!canRetry || active}
                          title={!canRetry ? "Requires imports.retry permission" : active ? "An import is already running" : undefined}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title="DCE cache">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm font-sans text-[var(--color-slate)]">
              <span>
                <strong className="text-[var(--color-charcoal)] tabular-nums">{dceCachedTotal}</strong> DCE{dceCachedTotal === 1 ? "" : "s"} cached
              </span>
              {dceCapBytes > 0 && (
                <span className="tabular-nums">
                  <strong className="text-[var(--color-charcoal)]">{fmtBytes(dceCachedBytes)}</strong> / {fmtBytes(dceCapBytes)} cap
                </span>
              )}
              {dceActive && (
                <span className="inline-flex items-center gap-1.5 text-[var(--color-gold)]">
                  <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden /> caching in progress — refreshes automatically
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => confirmClearDce("outdated")}
                disabled={!canRun || dceActive || dceCachedTotal === 0}
                title={!canRun ? "Requires imports.run permission" : dceActive ? "A DCE cache run is in progress" : undefined}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear outdated
              </button>
              <button
                onClick={() => confirmClearDce("all")}
                disabled={!canRun || dceActive || dceCachedTotal === 0}
                title={!canRun ? "Requires imports.run permission" : dceActive ? "A DCE cache run is in progress" : undefined}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-crimson)]/40 text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/5 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> Clear all
              </button>
            </div>
          </div>
          {dceRuns.length === 0 ? (
            <EmptyState title="No DCE cache runs yet" hint="Run “Cache DCEs” to pre-download every tender’s documents for instant, form-free downloads." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                    <th scope="col" className="px-4 py-2 font-medium">#</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2 font-medium">Actor</th>
                    <th scope="col" className="px-4 py-2 font-medium">Started</th>
                    <th scope="col" className="px-4 py-2 font-medium">Duration</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Threads</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Pauses</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Cached</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Skipped</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Failed</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dceRuns.map((run) => (
                    <tr key={run.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                      <td className="px-4 py-2 tabular-nums text-[var(--color-slate)]">{run.id}</td>
                      <td className="px-4 py-2 capitalize">{run.status}</td>
                      <td className="px-4 py-2 text-[var(--color-slate)]">{run.actor_email || "—"}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtDate(run.started_at)}</td>
                      <td className="px-4 py-2 tabular-nums">{duration(run)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.concurrency ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.pauses ?? 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.cached}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.skipped}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[var(--color-crimson)]">{run.failed}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[var(--color-slate)]">{run.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
