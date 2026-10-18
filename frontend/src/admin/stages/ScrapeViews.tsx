// Stage 01 · Collecte HTML — split from the old Scrape page into the three
// stage views. Controls runs and steers the scrape and owns its schedule; Data
// is the catalog the stage fills (the former standalone Tenders page); Logs is
// the run table plus the stage journal.
import { useState } from "react";
import { Play, RotateCcw, Loader2, Eye, RefreshCw } from "lucide-react";
import { getImports, runImport, retryImport, scrapePreview, steerPipeline, ApiError } from "../api";
import type { ImportRun, ImportsStatus, ScrapePreviewRow, SteerAction } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { Panel, fmtDate, duration, ProgressBar } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { ImportStatusBadge } from "../components/StatusBadge";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";
import { useStageStatus } from "./useStageStatus";
import { useStageContext } from "./useStageContext";
import StageLogs from "./StageLogs";
import StageScheduleCard from "./StageScheduleCard";
import AdminTenders from "../pages/Tenders";

const isActive = (s: ImportsStatus | null) => s?.active ?? false;

export function ScrapeControls() {
  const { user } = useAuth();
  const { reloadStatus } = useStageContext();
  const { toasts, push, dismiss } = useToasts();
  const { status, loading, error, reload } = useStageStatus(getImports, isActive);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [preview, setPreview] = useState<ScrapePreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const canRun = can(user?.role, "imports.run");
  const active = isActive(status);

  function refresh() { reload(false); reloadStatus(); }

  async function steer(action: SteerAction) {
    try { await steerPipeline("imports", action); push(`Scrape ${action}d`, "success"); refresh(); }
    catch (e) { push(e instanceof ApiError ? e.message : `Failed to ${action}`, "error"); }
  }

  async function doRun() {
    try { await runImport(); push("Import started", "success"); refresh(); }
    catch (e) { push(e instanceof ApiError ? e.message : "Failed to start import", "error"); }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    try { setPreview((await scrapePreview()).data); }
    catch (e) { push(e instanceof ApiError ? e.message : "Preview unavailable", "error"); }
    finally { setPreviewLoading(false); }
  }

  function confirmRun() {
    setConfirm({
      title: "Run full import",
      action: "Run import",
      target: "All configured sectors",
      consequence: "Scrapes marchespublics.gov.ma across all sectors and ingests new tenders. May take several minutes — you can pause or cancel it while it runs.",
      reversible: true,
      confirmLabel: "Run import",
      onConfirm: doRun,
    });
  }

  if (loading) return <LoadingState label="Loading scrape status" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => reload(true)} />;

  const progress = status?.progress ?? null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <StageScheduleCard />

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

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/** The catalog this stage fills. Formerly the standalone Tenders page. */
export function ScrapeData() {
  return <AdminTenders embedded />;
}

export function ScrapeLogs() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const { status, loading, error, reload } = useStageStatus(getImports, isActive);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canRetry = can(user?.role, "imports.retry");
  const active = isActive(status);

  async function doRetry(run: ImportRun) {
    try { await retryImport(run.id); push(`Retry started (from run #${run.id})`, "success"); reload(false); }
    catch (e) { push(e instanceof ApiError ? e.message : "Retry failed", "error"); }
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
      header: "", align: "right",
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
    <div className="flex flex-col gap-6">
      <Panel title="Import runs">
        <div className="px-1 pb-1">
          {loading ? <LoadingState label="Loading import history" />
            : error?.status === 403 ? <DeniedState message={error.message} />
            : error ? <FailedState message={error.message} onRetry={() => reload(true)} />
            : (
              <RunHistoryTable
                columns={columns}
                rows={status?.data ?? []}
                rowKey={(r) => r.id}
                empty={<EmptyState title="No imports yet" hint="Run an import to populate this history." />}
              />
            )}
        </div>
      </Panel>

      <StageLogs />

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
