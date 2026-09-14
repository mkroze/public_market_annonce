import { useCallback, useEffect, useState } from "react";
import { FileSearch, Loader2, Sparkles } from "lucide-react";
import { getDceExtraction, runDceExtraction, simulateDceExtraction, steerPipeline, ApiError } from "../api";
import type { DceExtractionRun, DceExtractionRecent, DceExtractionStatus, SteerAction } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, fmtDate, duration } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import { usePipelinePolling } from "../hooks";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

export default function DceExtraction() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [status, setStatus] = useState<DceExtractionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canRun = can(user?.role, "imports.run");
  const active = status?.active ?? false;

  const load = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    getDceExtraction()
      .then((res) => { setStatus(res); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(true); }, [load]);
  usePipelinePolling(() => load(false), active);

  async function steer(action: SteerAction) {
    try { await steerPipeline("dce-extraction", action); push(`Sweep ${action}d`, "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : `Failed to ${action}`, "error"); }
  }

  async function doRun() {
    try { await runDceExtraction(); push("DCE extraction sweep started", "success"); load(false); }
    catch (e) { push(e instanceof ApiError ? e.message : "Failed to start extraction", "error"); }
  }

  async function doSimulate() {
    try {
      const res = await simulateDceExtraction();
      push(`Simulated extraction for “${res.title ?? res.tender_id}”`, "success");
      load(false);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to simulate extraction", "error");
    }
  }

  function confirmRun() {
    setConfirm({
      title: "Run DCE extraction sweep",
      action: "Run extraction",
      target: "Every tender with a cached DCE",
      consequence: "Enqueues each cached DCE to the extraction pipeline (n8n → OCR → redact → extract). Results appear below as they arrive via the callback. Requires the n8n webhook to be configured — otherwise use “Simulate result” to test the display loop. Pause or cancel below any time.",
      reversible: true,
      confirmLabel: "Run extraction",
      onConfirm: doRun,
    });
  }

  if (loading) return <LoadingState label="Loading extraction status" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => load(true)} />;

  const runs = status?.data ?? [];
  const recent = status?.recent ?? [];
  const extCount = status?.extracted_count ?? 0;
  const simEnabled = status?.simulate_enabled ?? false;

  const runColumns: Column<DceExtractionRun>[] = [
    { header: "#", cell: (r) => r.id, className: "text-[var(--color-slate)] tabular-nums" },
    { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
    { header: "Actor", cell: (r) => <span className="text-[var(--color-slate)]">{r.actor_email || "—"}</span> },
    { header: "Started", cell: (r) => <span className="tabular-nums">{fmtDate(r.started_at)}</span> },
    { header: "Duration", cell: (r) => <span className="tabular-nums">{duration(r)}</span> },
    { header: "Enqueued", align: "right", cell: (r) => r.enqueued },
    { header: "Skipped", align: "right", cell: (r) => r.skipped },
    { header: "Failed", align: "right", cell: (r) => <span className="text-[var(--color-crimson)]">{r.failed}</span> },
    { header: "Total", align: "right", cell: (r) => <span className="text-[var(--color-slate)]">{r.total}</span> },
  ];

  const recentColumns: Column<DceExtractionRecent>[] = [
    { header: "Tender", cell: (r) => <span className="block max-w-[16rem] truncate" title={r.title ?? r.tender_id}>{r.title ?? r.tender_id}</span> },
    { header: "Object (extracted)", cell: (r) => <span className="block max-w-[18rem] text-[var(--color-slate)]">{r.object ?? "—"}</span> },
    { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
    {
      header: "Tags",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.tags.length === 0 ? <span className="text-[var(--color-slate)]">—</span> : r.tags.map((t) => (
            <span key={t} className="text-xs rounded bg-[var(--color-ivory-dim)] px-1.5 py-0.5 text-[var(--color-charcoal)]">{t}</span>
          ))}
        </div>
      ),
    },
    { header: "Extracted", cell: (r) => <span className="tabular-nums text-[var(--color-slate)]">{fmtDate(r.extracted_at)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="DCE extraction"
        description="Turn cached DCE documents into structured, redacted data via the OCR → extract pipeline."
        actions={
          <PipelineControls
            active={active}
            paused={status?.paused ?? false}
            canRun={canRun}
            onRun={confirmRun}
            onSteer={steer}
            runLabel="Run extraction"
            runIcon={<FileSearch className="w-4 h-4" aria-hidden />}
            runningReason="An extraction sweep is already running"
          />
        }
      />

      <Panel title="Extraction summary">
        <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm font-sans text-[var(--color-slate)]">
            <span><strong className="text-[var(--color-charcoal)] tabular-nums">{extCount}</strong> extraction{extCount === 1 ? "" : "s"} stored</span>
            {active && (
              <span className="inline-flex items-center gap-1.5 text-[var(--color-gold)]">
                <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden />
                {status?.paused ? "paused" : "sweep in progress"} — refreshes automatically
              </span>
            )}
            {simEnabled && (
              <span className="text-xs rounded bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-2 py-0.5">
                n8n not configured — use “Simulate result” to test the store→display loop
              </span>
            )}
          </div>
          {simEnabled && (
            <button
              onClick={doSimulate}
              disabled={!canRun}
              title={!canRun ? "Requires imports.run permission" : undefined}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden /> Simulate result
            </button>
          )}
        </div>
      </Panel>

      {recent.length > 0 && (
        <div className="mt-6">
          <Panel title="Recent extractions">
            <div className="px-1 pb-1">
              <RunHistoryTable columns={recentColumns} rows={recent} rowKey={(r) => r.tender_id} empty={null} />
            </div>
          </Panel>
        </div>
      )}

      <div className="mt-6">
        <Panel title="Extraction run history">
          <div className="px-1 pb-1">
            <RunHistoryTable
              columns={runColumns}
              rows={runs}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No extraction runs yet" hint="Run a sweep to enqueue cached DCEs, or use “Simulate result” to store a sample." />}
            />
          </div>
        </Panel>
      </div>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
