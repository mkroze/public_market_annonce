// Stage 03 · Fiches universelles — split from the old DCE extraction page.
// Controls starts and steers the sweep (and can simulate a result when n8n is
// not wired); Data is the fiches the stage produced; Logs is the run table plus
// the stage journal.
import { useState } from "react";
import { FileSearch, Sparkles } from "lucide-react";
import { getDceExtraction, runDceExtraction, simulateDceExtraction, purgeDceSimulations, steerPipeline, ApiError } from "../api";
import type { DceExtractionRun, DceExtractionRecent, DceExtractionStatus, SteerAction } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { Panel, fmtDate, duration } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";
import { useStageStatus } from "./useStageStatus";
import { useStageContext } from "./useStageContext";
import StageLogs from "./StageLogs";
import StageScheduleCard from "./StageScheduleCard";

const isActive = (s: DceExtractionStatus | null) => s?.active ?? false;

export function DceExtractionControls({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { reloadStatus } = useStageContext();
  const { toasts, push, dismiss } = useToasts();
  const { status, loading, error, reload } = useStageStatus(getDceExtraction, isActive);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canRun = can(user?.role, "imports.run") && !!status && !loading && !error;
  const active = isActive(status);

  function refresh() { reload(false); reloadStatus(); }

  async function steer(action: SteerAction) {
    try { await steerPipeline("dce-extraction", action); push(`Sweep ${action}d`, "success"); refresh(); }
    catch (e) { push(e instanceof ApiError ? e.message : `Failed to ${action}`, "error"); }
  }

  async function doRun() {
    try { await runDceExtraction(); push("DCE extraction sweep started", "success"); refresh(); }
    catch (e) { push(e instanceof ApiError ? e.message : "Failed to start extraction", "error"); }
  }

  async function doSimulate() {
    try {
      const res = await simulateDceExtraction();
      push(`Simulated extraction for “${res.title ?? res.tender_id}”`, "success");
      refresh();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to simulate extraction", "error");
    }
  }

  function confirmRun() {
    setConfirm({
      title: "Run DCE extraction sweep",
      action: "Run extraction",
      target: "Every tender with a cached DCE",
      consequence: "Enqueues each cached DCE to the extraction pipeline (n8n → OCR → redact → extract). Results appear in the Data view as they arrive via the callback. Requires the n8n webhook to be configured — otherwise use “Simulate result” to test the display loop. Pause or cancel any time.",
      reversible: true,
      confirmLabel: "Run extraction",
      onConfirm: doRun,
    });
  }


  const simEnabled = status?.simulate_enabled ?? false;

  return (
    <div>
      {loading && <p className="mb-3 text-xs text-[var(--color-slate)]">Connexion au backend…</p>}
      {error && <FailedState message={error.message} onRetry={() => reload(true)} />}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <PipelineControls
          active={active}
          paused={status?.paused ?? false}
          canRun={canRun}
          onRefresh={refresh}
          onRun={confirmRun}
          onSteer={steer}
          runLabel="Lancer l’extraction"
          unavailableReason={loading ? "Connexion au backend…" : error ? "Backend indisponible" : status?.simulate_enabled ? "Endpoint n8n non configuré" : undefined}
          runIcon={<FileSearch className="w-4 h-4" aria-hidden />}
          runningReason="An extraction sweep is already running"
        />
        {(
          <button
            onClick={doSimulate}
            disabled={!canRun || !simEnabled}
            title={!canRun ? "Requires imports.run permission" : !simEnabled ? "Simulation disponible uniquement sans connexion n8n" : undefined}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden /> Simulate result
          </button>
        )}
      </div>

      {simEnabled && (
        <p className="mb-5 rounded-lg bg-[var(--color-gold)]/10 px-3 py-2 text-xs font-sans text-[var(--color-gold)]">
          Endpoint n8n non configuré. La simulation permet de vérifier l’affichage des résultats.
        </p>
      )}

      <div className="stage-future-action"><button disabled title="La réception du prompt JSON et la connexion à votre modèle restent à livrer.">Envoyer le prompt JSON au modèle</button><p>Étape suivante : prompt JSON → votre modèle.</p></div>
      {!embedded && <StageScheduleCard />}

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/** The fiches universelles this stage produced. */
export function DceExtractionData() {
  const { user } = useAuth();
  const { reloadStatus } = useStageContext();
  const { toasts, push, dismiss } = useToasts();
  const { status, loading, error, reload } = useStageStatus(getDceExtraction, isActive);

  async function doPurge() {
    try {
      const res = await purgeDceSimulations();
      push(`${res.deleted} sample fiche(s) removed`, "success");
      reload(true);
      reloadStatus();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Failed to remove samples", "error");
    }
  }

  if (loading) return <LoadingState label="Loading extractions" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => reload(true)} />;

  const recent = status?.recent ?? [];
  const extCount = status?.extracted_count ?? 0;
  const simCount = status?.simulated_count ?? 0;

  const columns: Column<DceExtractionRecent>[] = [
    { header: "Tender", cell: (r) => <span className="block max-w-[16rem] truncate" title={r.title ?? r.tender_id}>{r.title ?? r.tender_id}</span> },
    { header: "Object (extracted)", cell: (r) => <span className="block max-w-[18rem] text-[var(--color-slate)]">{r.object ?? "—"}</span> },
    {
      header: "Status",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="capitalize">{r.status}</span>
          {r.source === "simulation" && (
            // Fabricated sample: never counted as a stored fiche and never
            // served to members, so say so plainly in the table.
            <span className="text-xs rounded bg-[var(--color-ivory-dim)] px-1.5 py-0.5 text-[var(--color-crimson)]">sample</span>
          )}
        </span>
      ),
    },
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
    <>
      <Panel title={`Fiches universelles · ${extCount.toLocaleString("fr-FR")} stored`}>
        {simCount > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-ivory-dim)] px-4 py-2.5">
            <p className="text-sm font-sans text-[var(--color-muted-light)]">
              {simCount.toLocaleString("fr-FR")} simulated sample{simCount > 1 ? "s" : ""} stored — excluded from the count above and never served to members.
            </p>
            {can(user?.role, "imports.run") && (
              <button
                type="button"
                onClick={doPurge}
                className="shrink-0 text-sm font-sans text-[var(--color-crimson)] underline underline-offset-2 hover:no-underline"
              >
                Remove samples
              </button>
            )}
          </div>
        )}
        <div className="px-1 pb-1">
          <RunHistoryTable
            columns={columns}
            rows={recent}
            rowKey={(r) => r.tender_id}
            empty={<EmptyState title="No extractions yet" hint="Run a sweep from Controls to enqueue cached DCEs, or use “Simulate result” to store a sample." />}
          />
        </div>
      </Panel>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export function DceExtractionLogs() {
  const { status, loading, error, reload } = useStageStatus(getDceExtraction, isActive);

  const columns: Column<DceExtractionRun>[] = [
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

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Extraction runs">
        <div className="px-1 pb-1">
          {loading ? <LoadingState label="Loading extraction run history" />
            : error?.status === 403 ? <DeniedState message={error.message} />
            : error ? <FailedState message={error.message} onRetry={() => reload(true)} />
            : (
              <RunHistoryTable
                columns={columns}
                rows={status?.data ?? []}
                rowKey={(r) => r.id}
                empty={<EmptyState title="No extraction runs yet" hint="Run a sweep to enqueue cached DCEs." />}
              />
            )}
        </div>
      </Panel>

      <StageLogs />
    </div>
  );
}
