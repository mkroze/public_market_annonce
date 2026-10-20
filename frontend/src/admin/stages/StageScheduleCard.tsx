// The schedule editor for whichever stage is open — the former standalone Cron
// jobs page, folded in so a stage's recurring run is configured where the stage
// is operated. A stage shows every job it owns: its run key plus folded-in jobs
// such as the cache cleanup or the tender-count recompute.
//
// Strings are English to match the surrounding stage views; the page this
// replaced was French.
import { useCallback, useEffect, useState } from "react";
import { Play, Loader2, Save, Clock, CircleDot } from "lucide-react";
import { getCron, updateCron, runCron, getDceExtraction, ApiError } from "../api";
import type { CronJob, CronUpdatePayload, ScheduleKind } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { Panel, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";
import { useStageContext } from "./useStageContext";
import { stageWorkflowKeys } from "./registry";
import { usePipelinePolling } from "../hooks";

type Draft = Pick<CronJob, "enabled" | "schedule_kind" | "hour" | "interval_minutes">;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function statusTone(status: string | null): string {
  if (status === "ok") return "text-[var(--color-emerald,#047857)]";
  if (status === "failed") return "text-[var(--color-crimson)]";
  if (status === "running") return "text-[var(--color-gold)]";
  return "text-[var(--color-slate)]";
}

function scheduleSummary(d: Draft): string {
  if (!d.enabled) return "Disabled";
  if (d.schedule_kind === "daily") return `Daily at ${String(d.hour).padStart(2, "0")}:00`;
  const m = d.interval_minutes;
  return m % 60 === 0 ? `Every ${m / 60} h` : `Every ${m} min`;
}

const selectCls = "select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
const inputCls = "input input-bordered input-sm w-24 font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

export default function StageScheduleCard({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { stage, reloadStatus, refreshKey } = useStageContext();
  const { toasts, push, dismiss } = useToasts();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const canRun = can(user?.role, "imports.run");
  const ownedParam = stageWorkflowKeys(stage).join(",");

  const load = useCallback(() => {
    const owned = ownedParam ? ownedParam.split(",") : [];
    if (owned.length === 0) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([getCron(), stage.slug === "dce-extraction" ? getDceExtraction() : Promise.resolve(null)])
      .then(([res, extraction]) => {
        setUnavailableReason(extraction?.simulate_enabled ? "Endpoint n8n non configuré" : null);
        const mine = res.data.filter((j) => owned.includes(j.job));
        setJobs(mine);
        setDrafts(Object.fromEntries(mine.map((j) => [j.job, {
          enabled: j.enabled, schedule_kind: j.schedule_kind, hour: j.hour, interval_minutes: j.interval_minutes,
        }])));
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, String(e))))
      .finally(() => setLoading(false));
  }, [ownedParam, stage.slug]);

  useEffect(() => { load(); }, [load, refreshKey]);
  // Refresh runtime fields without replacing an administrator's unsaved draft.
  const refreshRuntime = useCallback(() => {
    if (!ownedParam) return;
    getCron().then((res) => {
      setJobs(res.data.filter((j) => ownedParam.split(",").includes(j.job)));
    }).catch(() => { /* Keep the editor and its draft; the explicit refresh can retry. */ });
  }, [ownedParam]);
  usePipelinePolling(refreshRuntime, !!ownedParam, 5000);

  function patchDraft(job: string, patch: Partial<Draft>) {
    setDrafts((cur) => ({ ...cur, [job]: { ...cur[job], ...patch } }));
  }

  async function save(job: string) {
    const d = drafts[job];
    setBusy(job);
    const body: CronUpdatePayload = {
      enabled: d.enabled, schedule_kind: d.schedule_kind, hour: d.hour, interval_minutes: d.interval_minutes,
    };
    try {
      const updated = await updateCron(job, body);
      setJobs((cur) => cur.map((j) => (j.job === job ? updated : j)));
      push(`${updated.label}: schedule saved`, "success");
      reloadStatus();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Could not save the schedule", "error");
    } finally {
      setBusy(null);
    }
  }

  async function run(job: string, label: string) {
    if (!canRun || unavailableReason || busy || jobs.find((j) => j.job === job)?.running) return;
    setBusy(job);
    try {
      await runCron(job);
      push(`${label}: run started`, "success");
      reloadStatus();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Could not start the run", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title={embedded ? undefined : "Planification"}>
      <div className="px-4 py-3.5">
        {loading ? <LoadingState label="Chargement des planifications" />
          : error?.status === 403 ? <DeniedState message={error.message} />
          : error ? <FailedState message={error.message} onRetry={load} />
          : jobs.length === 0 ? (
            <div className="stage-schedule-empty"><Clock size={22} aria-hidden /><strong>{stage.planned ? "Planification à connecter" : "Aucune tâche récurrente"}</strong><p>{stage.planned ? "Le backend de cette étape doit être disponible pour planifier ses actions." : "Aucune tâche planifiable n’est exposée pour cette étape."}</p><button disabled title="Aucune tâche planifiable disponible">Configurer une planification</button></div>
          ) : (
            <div className="flex flex-col gap-4">
              {unavailableReason && <p className="text-xs text-[var(--color-slate)]">{unavailableReason} · exécution et planification indisponibles.</p>}
              {jobs.map((j) => {
                const d = drafts[j.job];
                if (!d) return null;
                const dirty =
                  d.enabled !== j.enabled || d.schedule_kind !== j.schedule_kind ||
                  d.hour !== j.hour || d.interval_minutes !== j.interval_minutes;
                return (
                  <div key={j.job} className={jobs.length > 1 ? "border-b border-[var(--color-border-subtle)] pb-4 last:border-0 last:pb-0" : ""}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[var(--color-slate)]" aria-hidden />
                          <h3 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">{j.label}</h3>
                          {j.running && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-gold)]">
                              <CircleDot className="w-3.5 h-3.5 animate-pulse" aria-hidden /> running
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-slate)]">
                          {scheduleSummary(d)}
                          {d.enabled && j.next_run_at && <> · next run <strong className="text-[var(--color-charcoal)]">{fmtDate(j.next_run_at)}</strong></>}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
                        <input
                          type="checkbox"
                          className="toggle toggle-sm"
                          disabled={!canRun || !!unavailableReason || !!busy}
                          checked={d.enabled}
                          onChange={(e) => patchDraft(j.job, { enabled: e.target.checked })}
                        />
                        Activée
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <select
                        aria-label={`Schedule kind for ${j.label}`}
                        className={selectCls}
                        disabled={!canRun || !!unavailableReason || !!busy}
                        value={d.schedule_kind}
                        onChange={(e) => patchDraft(j.job, { schedule_kind: e.target.value as ScheduleKind })}
                      >
                        <option value="daily">Chaque jour</option>
                        <option value="interval">Par intervalle</option>
                      </select>

                      {d.schedule_kind === "daily" ? (
                        <label className="flex items-center gap-1.5 text-sm text-[var(--color-slate)]">
                          at
                          <select
                            aria-label={`Hour for ${j.label}`}
                            className={selectCls}
                            disabled={!canRun || !!unavailableReason || !!busy}
                            value={d.hour}
                            onChange={(e) => patchDraft(j.job, { hour: Number(e.target.value) })}
                          >
                            {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                          </select>
                          <span className="text-xs">Africa/Casablanca</span>
                        </label>
                      ) : (
                        <label className="flex items-center gap-1.5 text-sm text-[var(--color-slate)]">
                          every
                          <input
                            type="number"
                            min={5}
                            aria-label={`Interval in minutes for ${j.label}`}
                            className={inputCls}
                            disabled={!canRun || !!unavailableReason || !!busy}
                            value={d.interval_minutes}
                            onChange={(e) => patchDraft(j.job, { interval_minutes: Number(e.target.value) })}
                          />
                          minutes
                        </label>
                      )}

                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => save(j.job)}
                          disabled={!canRun || !!unavailableReason || !dirty || !!busy}
                          className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {busy === j.job ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
                          Enregistrer
                        </button>
                        <button
                          onClick={() => run(j.job, j.label)}
                          disabled={!canRun || !!unavailableReason || j.running || !!busy}
                          title={unavailableReason || (j.running ? "Déjà en cours" : "Exécuter maintenant")}
                          className="inline-flex items-center gap-1.5 rounded bg-[var(--color-crimson)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Play className="w-3.5 h-3.5" aria-hidden /> Exécuter
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-slate)]">
                      Last run {fmtDate(j.last_run_at)}
                      {j.last_status && <> · <span className={`font-semibold ${statusTone(j.last_status)}`}>{j.last_status}</span></>}
                      {j.updated_by && <> · edited by {j.updated_by}</>}
                    </div>
                  </div>
                );
              })}
              {!canRun && (
                <p className="text-xs text-[var(--color-slate)]">
                  Read-only — the <code>imports.run</code> permission is required to edit or start jobs.
                </p>
              )}
            </div>
          )}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </Panel>
  );
}
