import { useCallback, useEffect, useState } from "react";
import { Play, RotateCcw, Loader2, CalendarClock, Eye, RefreshCw } from "lucide-react";
import { getImports, runImport, retryImport, scrapePreview, steerPipeline, ApiError } from "../api";
import type { ImportRun, ImportsStatus, ScrapePreviewRow, SteerAction } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, fmtDate, duration, ProgressBar } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { ImportStatusBadge } from "../components/StatusBadge";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import { usePipelinePolling } from "../hooks";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

export default function Scrape() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [status, setStatus] = useState<ImportsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const [preview, setPreview] = useState<ScrapePreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const canRun = can(user?.role, "imports.run");
  const canRetry = can(user?.role, "imports.retry");
  const active = status?.active ?? false;

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    getImports()
      .then((res) => { setStatus(res); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(true); }, [load]);
  usePipelinePolling(() => load(false), active);

  async function steer(action: SteerAction) {
    try {
      await steerPipeline("imports", action);
      push(`Scrape ${action}d`, "success");
      load(false);
    } catch (e) {
      push(e instanceof ApiError ? e.message : `Failed to ${action}`, "error");
    }
  }

  async function doRun() {
    try { await runImport(); push("Import started", "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : "Failed to start import", "error"); }
  }

  async function doRetry(run: ImportRun) {
    try { await retryImport(run.id); push(`Retry started (from run #${run.id})`, "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : "Retry failed", "error"); }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await scrapePreview();
      setPreview(res.data);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Preview unavailable", "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  function confirmRun() {
    setConfirm({
      title: "Run full import",
      action: "Run import",
      target: "All configured sectors",
      consequence: "Scrapes marchespublics.gov.ma across all sectors and ingests new tenders. May take several minutes — you can pause or cancel it below while it runs.",
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

  if (loading) return <LoadingState label="Loading scrape status" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => load(true)} />;

  const runs = status?.data ?? [];
  const progress = status?.progress ?? null;

  const columns: Column<ImportRun>[] = [
    { header: "#", cell: (r) => r.id, className: "text-[var(--color-slate)] tabular-nums" },
    { header: "Status", cell: (r) => <ImportStatusBadge status={r.status} /> },
    { header: "Trigger", cell: (r) => <span className="capitalize">{r.trigger || "scheduled"}</span> },
    { header: "Actor", cell: (r) => <span className="text-[var(--color-slate)]">{r.actor_email || "—"}</span> },
    { header: "Started", cell: (r) => <span className="tabular-nums">{fmtDate(r.started_at)}</span> },
    { header: "Duration", cell: (r) => <span className="tabular-nums">{duration(r)}</span> },
    { header: "Found", align: "right", cell: (r) => r.tenders_found },
    { header: "New", align: "right", cell: (r) => r.tenders_new },
    {
      header: "Actions", align: "right",
      cell: (r) => r.status === "failed" ? (
        <button
          onClick={() => confirmRetry(r)}
          disabled={!canRetry || active}
          title={!canRetry ? "Requires imports.retry permission" : active ? "An import is already running" : undefined}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Retry
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Scrape"
        description="Ingest tenders from marchespublics.gov.ma. Trigger a run, watch live progress, and pause, resume, or cancel while it runs."
        actions={
          <PipelineControls
            active={active}
            paused={status?.paused ?? false}
            canRun={canRun}
            onRun={confirmRun}
            onSteer={steer}
            runLabel="Run import"
            runIcon={<Play className="w-4 h-4" aria-hidden />}
            runningReason="An import is already running"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <Panel title="Schedule">
          <div className="px-4 py-3.5 flex items-center gap-2 text-sm font-sans text-[var(--color-slate)]">
            <CalendarClock className="w-4 h-4 text-[var(--color-gold)]" aria-hidden />
            {status ? (
              <span>
                Next automatic run <strong className="text-[var(--color-charcoal)]">{fmtDate(status.next_scheduled_run)}</strong>
                {" "}<span className="text-[var(--color-muted-light)]">(daily at {status.digest_hour}:00 Morocco time)</span>
              </span>
            ) : "—"}
          </div>
        </Panel>

        <Panel title="Live progress">
          <div className="px-4 py-3.5">
            {active && progress ? (
              <ProgressBar
                value={progress.sectors_done}
                max={progress.sectors_total}
                label={
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[var(--color-gold)]">
                      <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden />
                      {status?.paused ? "Paused" : "Running"} — sector {progress.sectors_done}/{progress.sectors_total}
                    </span>
                    <span className="tabular-nums">{progress.found} found · {progress.new} new</span>
                  </>
                }
              />
            ) : (
              <p className="text-sm font-sans text-[var(--color-muted-light)]">No scrape running. Trigger one to see live progress here.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mb-6">
        <Panel title="Available now (preview)">
          <div className="px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm font-sans text-[var(--color-slate)]">
                Peek at how many tenders each sector currently lists on the portal — no ingestion, just a homepage read.
              </p>
              <button
                onClick={loadPreview}
                disabled={previewLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {previewLoading
                  ? <><Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden /> Loading…</>
                  : preview ? <><RefreshCw className="w-4 h-4" aria-hidden /> Refresh preview</> : <><Eye className="w-4 h-4" aria-hidden /> Preview</>}
              </button>
            </div>
            {preview && (
              preview.length === 0
                ? <EmptyState title="No counts returned" hint="The portal homepage returned no sector rows." />
                : (
                  <RunHistoryTable
                    columns={[
                      { header: "Category", cell: (r: ScrapePreviewRow) => r.category },
                      { header: "Sector", cell: (r: ScrapePreviewRow) => r.sector_name },
                      { header: "Available", align: "right", cell: (r: ScrapePreviewRow) => r.count },
                    ]}
                    rows={preview}
                    rowKey={(r) => `${r.category}-${r.sector_code}-${r.sector_name}`}
                    empty={null}
                  />
                )
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Import history">
        <div className="px-1 pb-1">
          <RunHistoryTable
            columns={columns}
            rows={runs}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No imports yet" hint="Run an import to populate this history." />}
          />
        </div>
      </Panel>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
