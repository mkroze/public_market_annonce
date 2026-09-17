import { useCallback, useEffect, useState } from "react";
import { Play, Loader2, Save, Clock, CircleDot } from "lucide-react";
import { getCron, updateCron, runCron, ApiError } from "../api";
import type { CronJob, CronUpdatePayload, ScheduleKind } from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

type Draft = Pick<CronJob, "enabled" | "schedule_kind" | "hour" | "interval_minutes">;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function statusTone(status: string | null): string {
  if (status === "ok") return "text-[var(--color-emerald,#047857)]";
  if (status === "failed") return "text-[var(--color-crimson)]";
  if (status === "running") return "text-[var(--color-gold)]";
  return "text-[var(--color-slate)]";
}

function scheduleSummary(d: Draft): string {
  if (!d.enabled) return "Désactivé";
  if (d.schedule_kind === "daily") return `Tous les jours à ${String(d.hour).padStart(2, "0")}:00`;
  const m = d.interval_minutes;
  return m % 60 === 0 ? `Toutes les ${m / 60} h` : `Toutes les ${m} min`;
}

export default function CronJobs() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canRun = can(user?.role, "imports.run");

  const load = useCallback(() => {
    setLoading(true);
    getCron()
      .then((res) => {
        setJobs(res.data);
        setDrafts(Object.fromEntries(res.data.map((j) => [j.job, {
          enabled: j.enabled, schedule_kind: j.schedule_kind, hour: j.hour, interval_minutes: j.interval_minutes,
        }])));
        setError(null);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
      push(`${updated.label} : planification enregistrée`, "success");
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Échec de l'enregistrement", "error");
    } finally {
      setBusy(null);
    }
  }

  async function run(job: string, label: string) {
    setBusy(job);
    try {
      await runCron(job);
      push(`${label} : exécution lancée`, "success");
      setTimeout(load, 800);
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Impossible de lancer l'exécution", "error");
    } finally {
      setBusy(null);
    }
  }

  const selectCls =
    "select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
  const inputCls =
    "input input-bordered input-sm w-24 font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

  return (
    <div>
      <PageHeader
        title="Cron jobs"
        description="Planifications éditables des tâches récurrentes. Les modifications s'appliquent sans redéploiement."
      />

      {loading ? (
        <LoadingState label="Chargement des planifications" />
      ) : error?.status === 403 ? (
        <DeniedState message={error.message} />
      ) : error ? (
        <FailedState message={error.message} onRetry={load} />
      ) : (
        <div className="grid gap-4">
          {jobs.map((j) => {
            const d = drafts[j.job];
            if (!d) return null;
            const dirty =
              d.enabled !== j.enabled || d.schedule_kind !== j.schedule_kind ||
              d.hour !== j.hour || d.interval_minutes !== j.interval_minutes;
            return (
              <Panel key={j.job}>
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--color-slate)]" aria-hidden />
                        <h2 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">{j.label}</h2>
                        {j.running && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-gold)]">
                            <CircleDot className="w-3.5 h-3.5 animate-pulse" aria-hidden /> en cours
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-slate)]">
                        {scheduleSummary(d)}
                        {d.enabled && j.next_run_at && <> · prochaine exécution <strong className="text-[var(--color-charcoal)]">{fmtDate(j.next_run_at)}</strong></>}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        disabled={!canRun}
                        checked={d.enabled}
                        onChange={(e) => patchDraft(j.job, { enabled: e.target.checked })}
                      />
                      Activé
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <select
                      aria-label={`Type de planification ${j.label}`}
                      className={selectCls}
                      disabled={!canRun}
                      value={d.schedule_kind}
                      onChange={(e) => patchDraft(j.job, { schedule_kind: e.target.value as ScheduleKind })}
                    >
                      <option value="daily">Quotidien</option>
                      <option value="interval">Par intervalle</option>
                    </select>

                    {d.schedule_kind === "daily" ? (
                      <label className="flex items-center gap-1.5 text-sm text-[var(--color-slate)]">
                        à
                        <select
                          aria-label={`Heure ${j.label}`}
                          className={selectCls}
                          disabled={!canRun}
                          value={d.hour}
                          onChange={(e) => patchDraft(j.job, { hour: Number(e.target.value) })}
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                        </select>
                        <span className="text-xs">Africa/Casablanca</span>
                      </label>
                    ) : (
                      <label className="flex items-center gap-1.5 text-sm text-[var(--color-slate)]">
                        toutes les
                        <input
                          type="number"
                          min={5}
                          aria-label={`Intervalle en minutes ${j.label}`}
                          className={inputCls}
                          disabled={!canRun}
                          value={d.interval_minutes}
                          onChange={(e) => patchDraft(j.job, { interval_minutes: Number(e.target.value) })}
                        />
                        minutes
                      </label>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => save(j.job)}
                        disabled={!canRun || !dirty || busy === j.job}
                        className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busy === j.job ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
                        Enregistrer
                      </button>
                      <button
                        onClick={() => run(j.job, j.label)}
                        disabled={!canRun || j.running || busy === j.job}
                        title={j.running ? "Déjà en cours d'exécution" : "Lancer maintenant"}
                        className="inline-flex items-center gap-1.5 rounded bg-[var(--color-crimson)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Play className="w-3.5 h-3.5" aria-hidden /> Exécuter
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-slate)]">
                    Dernière exécution {fmtDate(j.last_run_at)}
                    {j.last_status && <> · <span className={`font-semibold ${statusTone(j.last_status)}`}>{j.last_status}</span></>}
                    {j.updated_by && <> · modifié par {j.updated_by}</>}
                  </div>
                </div>
              </Panel>
            );
          })}
          {!canRun && (
            <p className="text-xs text-[var(--color-slate)]">
              Lecture seule — la permission <code>imports.run</code> est requise pour modifier ou lancer les tâches.
            </p>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
