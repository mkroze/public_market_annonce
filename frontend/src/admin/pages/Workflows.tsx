import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play, Loader2, RefreshCw, CalendarClock, ArrowRight, Trash2, Archive, ArchiveRestore,
  SlidersHorizontal, Settings2, CircleDot, Pause, Minus,
} from "lucide-react";
import {
  getWorkflows, getWorkflowEvents, runImport, runDceCache, runDceExtraction, runCron, updateCron,
  steerPipeline, ApiError,
} from "../api";
import type {
  Paginated, SteerAction, WorkflowEvent, WorkflowEventKind, WorkflowKey, WorkflowState,
} from "../types";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { PageHeader, Panel, ProgressBar, GatedButton, fmtDate, fmtBytes, duration } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState, FilteredEmptyState } from "../components/StateBlock";
import { ImportStatusBadge, ResultBadge } from "../components/StatusBadge";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { PipelineControls } from "../components/PipelineControls";
import { usePipelinePolling } from "../hooks";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

// The rest of the admin has no i18n layer, so this page carries its own small
// EN/FR dictionary and remembers the choice per browser.
type Lang = "en" | "fr";
const LANG_KEY = "admin.workflows.lang";

const TEXT = {
  en: {
    title: "Workflows",
    description: "Every background pipeline in one place: what is running, what was launched, and what was deleted or archived.",
    loading: "Loading workflows",
    refresh: "Refresh",
    live: "Pipelines",
    idle: "Idle", running: "Running", paused: "Paused", cancelling: "Cancelling",
    run: "Run now",
    alreadyRunning: "A run is already in progress",
    needsRun: "Requires imports.run permission",
    autoCleanup: "Automatic daily cleanup",
    autoOn: "automatic cleanup enabled", autoOff: "automatic cleanup disabled",
    cleanupHint: "Removes cached DCEs whose tender is past its deadline, archived, or gone.",
    hourlyStats: "Recompute every hour",
    hourlyOn: "recomputed every hour", hourlyOff: "back to the daily computation",
    statsHint: "Recomputes the Tenders counters shown on the dashboard (all / current).",
    lastRun: "Last run", never: "Never run",
    nextRun: "Next automatic run", scheduleOff: "Automatic schedule disabled",
    openPage: "Open page",
    confirmTitle: "Run workflow",
    confirmConsequence: "Starts this workflow in the background. You can pause or cancel it from this page while it runs.",
    started: "started", failedToStart: "Failed to start",
    steered: { pause: "paused", resume: "resumed", cancel: "cancel requested" },
    journal: "Activity journal",
    tabAll: "All activity", tabCleanup: "Deletions & cleanups",
    allWorkflows: "All workflows", allKinds: "All event types", allOrigins: "All origins",
    from: "From", to: "To",
    colDate: "Date", colWorkflow: "Workflow", colEvent: "Event", colOrigin: "Origin",
    colActor: "By", colResult: "Result", colDetails: "Details",
    emptyTitle: "No activity yet", emptyHint: "Runs, pauses, cache clears and archives will appear here.",
    previous: "Previous", next: "Next",
    page: (p: number, n: number, total: number) => `Page ${p} of ${n} · ${total} events`,
    recentOnly: "The journal merges the 500 most recent rows of each source.",
    workflows: { scrape_digest: "Scrape + email digest", dce_cache: "DCE caching", dce_extraction: "DCE extraction", dce_cache_cleanup: "DCE cache cleanup", tender_stats: "Tender count", tenders: "Tenders" },
    kinds: { run: "Run", control: "Control", deletion: "Deletion", archive: "Archive", restore: "Restore", config: "Schedule change" },
    origins: { manual: "Manual", scheduled: "Scheduled", system: "Automatic" },
    actions: {
      pause: "Paused", resume: "Resumed", cancel: "Cancel requested",
      "dce_cache.clear": "Cache cleared", "dce_cache.evict": "Cache eviction (size cap)",
      "dce_cache.cleanup": "Outdated DCEs removed",
      "tender.batch.archive": "Tenders archived", "tender.cleanup.expired_archive": "Expired tenders archived",
      "tender.batch.restore": "Tenders restored", "cron.update": "Schedule edited", run: "Run",
    },
    d: {
      found: "found", fresh: "new", cached: "cached", skipped: "skipped", failed: "failed", enqueued: "enqueued",
      files: "files removed", freed: "freed", orphans: "orphan files", mode: "mode",
      archived: "archived", restored: "restored", matched: "matched", run: "Run",
      all: "in total", current: "current",
      sector: "sector", enabled: "enabled", disabled: "disabled", daily: "daily at", every: "every",
    },
  },
  fr: {
    title: "Workflows",
    description: "Tous les traitements de fond au même endroit : ce qui tourne, ce qui a été lancé, ce qui a été supprimé ou archivé.",
    loading: "Chargement des workflows",
    refresh: "Actualiser",
    live: "Traitements",
    idle: "Inactif", running: "En cours", paused: "En pause", cancelling: "Annulation",
    run: "Lancer",
    alreadyRunning: "Une exécution est déjà en cours",
    needsRun: "Permission imports.run requise",
    autoCleanup: "Nettoyage automatique quotidien",
    autoOn: "nettoyage automatique activé", autoOff: "nettoyage automatique désactivé",
    cleanupHint: "Supprime du cache les DCE dont l'appel d'offres a dépassé son échéance, est archivé ou a disparu.",
    hourlyStats: "Recalculer chaque heure",
    hourlyOn: "recalcul chaque heure", hourlyOff: "retour au calcul quotidien",
    statsHint: "Recalcule les compteurs Tenders affichés sur le dashboard (tous / à jour).",
    lastRun: "Dernière exécution", never: "Jamais exécuté",
    nextRun: "Prochaine exécution automatique", scheduleOff: "Planification automatique désactivée",
    openPage: "Ouvrir la page",
    confirmTitle: "Lancer le workflow",
    confirmConsequence: "Lance ce workflow en arrière-plan. Vous pouvez le mettre en pause ou l'annuler depuis cette page pendant qu'il tourne.",
    started: "lancé", failedToStart: "Échec du lancement",
    steered: { pause: "mis en pause", resume: "repris", cancel: "annulation demandée" },
    journal: "Journal d'activité",
    tabAll: "Toute l'activité", tabCleanup: "Suppressions et nettoyages",
    allWorkflows: "Tous les workflows", allKinds: "Tous les types", allOrigins: "Toutes les origines",
    from: "Du", to: "Au",
    colDate: "Date", colWorkflow: "Workflow", colEvent: "Événement", colOrigin: "Origine",
    colActor: "Par", colResult: "Résultat", colDetails: "Détails",
    emptyTitle: "Aucune activité", emptyHint: "Les exécutions, pauses, vidages de cache et archivages apparaîtront ici.",
    previous: "Précédent", next: "Suivant",
    page: (p: number, n: number, total: number) => `Page ${p} sur ${n} · ${total} événements`,
    recentOnly: "Le journal fusionne les 500 lignes les plus récentes de chaque source.",
    workflows: { scrape_digest: "Scrape + digest e-mail", dce_cache: "Mise en cache des DCE", dce_extraction: "Extraction des DCE", dce_cache_cleanup: "Nettoyage du cache DCE", tender_stats: "Calcul des appels d'offres", tenders: "Appels d'offres" },
    kinds: { run: "Exécution", control: "Contrôle", deletion: "Suppression", archive: "Archivage", restore: "Restauration", config: "Planification modifiée" },
    origins: { manual: "Manuel", scheduled: "Planifié", system: "Automatique" },
    actions: {
      pause: "Mis en pause", resume: "Repris", cancel: "Annulation demandée",
      "dce_cache.clear": "Cache vidé", "dce_cache.evict": "Éviction du cache (plafond)",
      "dce_cache.cleanup": "DCE périmés supprimés",
      "tender.batch.archive": "Appels d'offres archivés", "tender.cleanup.expired_archive": "Appels d'offres expirés archivés",
      "tender.batch.restore": "Appels d'offres restaurés", "cron.update": "Planification modifiée", run: "Exécution",
    },
    d: {
      found: "trouvés", fresh: "nouveaux", cached: "mis en cache", skipped: "ignorés", failed: "en échec", enqueued: "envoyés",
      files: "fichiers supprimés", freed: "libérés", orphans: "fichiers orphelins", mode: "mode",
      archived: "archivés", restored: "restaurés", matched: "concernés", run: "Exécution",
      all: "au total", current: "à jour",
      sector: "secteur", enabled: "activé", disabled: "désactivé", daily: "chaque jour à", every: "toutes les",
    },
  },
} as const;

type Text = (typeof TEXT)[Lang];

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch { /* storage unavailable — fall through */ }
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

const STAGE_PATH: Record<WorkflowKey, string> = {
  scrape_digest: "/admin/scrape",
  dce_cache: "/admin/dce-cache",
  dce_extraction: "/admin/dce-extraction",
  dce_cache_cleanup: "/admin/dce-cache",
  tender_stats: "/admin",
};

const RUNNERS: Record<WorkflowKey, () => Promise<unknown>> = {
  scrape_digest: runImport,
  dce_cache: runDceCache,
  dce_extraction: runDceExtraction,
  dce_cache_cleanup: () => runCron("dce_cache_cleanup"),
  tender_stats: () => runCron("tender_stats"),
};

const CLEANUP_KINDS = "deletion,archive,restore";
const KIND_OPTIONS: WorkflowEventKind[] = ["run", "control", "deletion", "archive", "restore", "config"];
const PER_PAGE = 25;

const KIND_ICON: Record<WorkflowEventKind, typeof Play> = {
  run: Play, control: SlidersHorizontal, deletion: Trash2, archive: Archive,
  restore: ArchiveRestore, config: Settings2,
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function workflowName(t: Text, key: string | null): string {
  return (key && (t.workflows as Record<string, string>)[key]) || key || "—";
}

function actionLabel(t: Text, e: WorkflowEvent): string {
  const actions = t.actions as Record<string, string>;
  if (e.kind === "run") return actions.run;
  if (e.kind === "control") return actions[e.action.split(".").pop() ?? ""] ?? e.action;
  return actions[e.action] ?? e.action;
}

// One-line, human summary of an event's counters.
function detailsText(t: Text, e: WorkflowEvent): string {
  const d = e.details;
  const parts: string[] = [];
  if (e.kind === "run") {
    if (e.workflow === "scrape_digest") {
      parts.push(`${num(d.tenders_found)} ${t.d.found}`, `${num(d.tenders_new)} ${t.d.fresh}`);
    } else if (e.workflow === "tender_stats") {
      parts.push(`${num(d.tender_count)} ${t.d.all}`, `${num(d.active_tender_count)} ${t.d.current}`);
    } else if (e.workflow === "dce_cache") {
      parts.push(`${num(d.cached)}/${num(d.total)} ${t.d.cached}`, `${num(d.skipped)} ${t.d.skipped}`, `${num(d.failed)} ${t.d.failed}`);
    } else {
      parts.push(`${num(d.enqueued)}/${num(d.total)} ${t.d.enqueued}`, `${num(d.skipped)} ${t.d.skipped}`, `${num(d.failed)} ${t.d.failed}`);
    }
    if (e.finished_at) parts.push(duration({ started_at: e.at, finished_at: e.finished_at }));
  } else if (e.kind === "deletion" && typeof d.error === "string") {
    parts.push(d.error);
  } else if (e.kind === "deletion") {
    // Rows audited before removal counts were recorded have no figures to show.
    if (d.removed !== undefined) parts.push(`${num(d.removed)} ${t.d.files}`, `${fmtBytes(num(d.freed_bytes))} ${t.d.freed}`);
    if (d.mode) parts.push(`${t.d.mode} ${String(d.mode)}`);
    if (num(d.orphans_removed)) parts.push(`${num(d.orphans_removed)} ${t.d.orphans}`);
  } else if (e.kind === "archive" || e.kind === "restore") {
    const verb = e.kind === "archive" ? t.d.archived : t.d.restored;
    if (d.archived !== undefined) {
      parts.push(`${num(d.archived)} ${verb}`, `${num(d.matched)} ${t.d.matched}`);
      if (num(d.dce_removed)) parts.push(`${num(d.dce_removed)} ${t.d.files}`);
    } else {
      parts.push(`${num(d.updated)} ${verb}`);
      if (num(d.failed)) parts.push(`${num(d.failed)} ${t.d.failed}`);
    }
  } else if (e.kind === "control") {
    if (e.run_id) parts.push(`${t.d.run} #${e.run_id}`);
  } else if (e.kind === "config") {
    const after = (d.after ?? {}) as Record<string, unknown>;
    if (after.enabled !== undefined) parts.push(after.enabled ? t.d.enabled : t.d.disabled);
    if (after.schedule_kind === "daily" && after.hour !== undefined) parts.push(`${t.d.daily} ${String(after.hour).padStart(2, "0")}:00`);
    else if (after.hour !== undefined) parts.push(`${String(after.hour).padStart(2, "0")}:00`);
    if (after.interval_minutes !== undefined) parts.push(`${t.d.every} ${num(after.interval_minutes)} min`);
  }
  return parts.join(" · ") || "—";
}

function StateBadge({ w, t }: { w: WorkflowState; t: Text }) {
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-sans font-medium whitespace-nowrap";
  if (!w.active)
    return <span className={`${base} text-[var(--color-slate)] border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]`}><Minus className="w-3 h-3" aria-hidden />{t.idle}</span>;
  const gold = "text-[var(--color-gold)] border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5";
  if (w.cancel_requested)
    return <span className={`${base} ${gold}`}><Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden />{t.cancelling}</span>;
  if (w.paused)
    return <span className={`${base} ${gold}`}><Pause className="w-3 h-3" aria-hidden />{t.paused}</span>;
  return <span className={`${base} ${gold}`}><CircleDot className="w-3 h-3 motion-safe:animate-pulse" aria-hidden />{t.running}</span>;
}

// Live progress of an active run: the scrape reports sectors through its
// control; the two DCE sweeps flush counters to their (live) run row.
function liveProgress(w: WorkflowState, t: Text): { value: number; max: number; label: string } | null {
  if (!w.active) return null;
  if (w.key === "scrape_digest") {
    const p = w.progress ?? {};
    return {
      value: num(p.sectors_done), max: num(p.sectors_total),
      label: `${t.d.sector} ${num(p.sectors_done)}/${num(p.sectors_total)} · ${num(p.found)} ${t.d.found} · ${num(p.new)} ${t.d.fresh}`,
    };
  }
  const d = w.last_run?.status === "running" ? w.last_run.details : (w.progress ?? {});
  const done = num(d.cached) + num(d.enqueued) + num(d.skipped) + num(d.failed);
  const main = w.key === "dce_cache" ? `${num(d.cached)} ${t.d.cached}` : `${num(d.enqueued)} ${t.d.enqueued}`;
  return { value: done, max: num(d.total), label: `${done}/${num(d.total)} · ${main} · ${num(d.failed)} ${t.d.failed}` };
}

const selectCls = "select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
const inputCls = "input input-bordered input-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
const ghostBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed";

interface Filters { workflow: string; kind: string; origin: string; date_from: string; date_to: string; }
const NO_FILTERS: Filters = { workflow: "", kind: "", origin: "", date_from: "", date_to: "" };

export default function Workflows() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = TEXT[lang];

  const [flows, setFlows] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const [tab, setTab] = useState<"all" | "cleanup">("all");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<Paginated<WorkflowEvent> | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const canRun = can(user?.role, "imports.run");
  const anyActive = flows.some((w) => w.active);

  const loadFlows = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    getWorkflows()
      .then((res) => { setFlows(res.data); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  const loadEvents = useCallback(() => {
    getWorkflowEvents({
      workflow: filters.workflow,
      kind: tab === "cleanup" ? CLEANUP_KINDS : filters.kind,
      origin: filters.origin,
      date_from: filters.date_from,
      date_to: filters.date_to,
      page: String(page),
      per_page: String(PER_PAGE),
    })
      .then((res) => { setEvents(res); setEventsError(null); })
      .catch((e) => setEventsError(e instanceof ApiError ? e.message : String(e)));
  }, [filters, tab, page]);

  const refresh = useCallback(() => { loadFlows(false); loadEvents(); }, [loadFlows, loadEvents]);

  useEffect(() => { loadFlows(true); }, [loadFlows]);
  useEffect(() => { loadEvents(); }, [loadEvents]);
  usePipelinePolling(refresh, anyActive);

  function switchLang(next: Lang) {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* storage unavailable */ }
  }

  function patchFilters(patch: Partial<Filters>) {
    setFilters((cur) => ({ ...cur, ...patch }));
    setPage(1);
  }

  function switchTab(next: "all" | "cleanup") {
    setTab(next);
    setPage(1);
  }

  async function doRun(w: WorkflowState) {
    try {
      await RUNNERS[w.key]();
      push(`${workflowName(t, w.key)} : ${t.started}`, "success");
      setTimeout(refresh, 800);
    } catch (e) {
      push(e instanceof ApiError ? e.message : t.failedToStart, "error");
    }
  }

  // The cleanup card switches its daily job on/off; the tender-count card
  // switches between the daily run and an hourly one (interval, 60 min).
  async function toggleSchedule(w: WorkflowState, on: boolean) {
    const stats = w.key === "tender_stats";
    try {
      await updateCron(w.key, !stats
        ? { enabled: on }
        : on
          ? { enabled: true, schedule_kind: "interval", interval_minutes: 60 }
          : { enabled: true, schedule_kind: "daily" });
      const done = stats ? (on ? t.hourlyOn : t.hourlyOff) : (on ? t.autoOn : t.autoOff);
      push(`${workflowName(t, w.key)} : ${done}`, "success");
      refresh();
    } catch (e) {
      push(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  async function steer(w: WorkflowState, action: SteerAction) {
    if (!w.stage) return;
    try {
      await steerPipeline(w.stage, action);
      push(`${workflowName(t, w.key)} : ${t.steered[action]}`, "success");
      refresh();
    } catch (e) {
      push(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  function confirmRun(w: WorkflowState) {
    setConfirm({
      title: t.confirmTitle,
      action: t.run,
      target: workflowName(t, w.key),
      consequence: t.confirmConsequence,
      reversible: true,
      confirmLabel: t.run,
      onConfirm: () => doRun(w),
    });
  }

  if (loading) return <LoadingState label={t.loading} />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => loadFlows(true)} />;

  const filtered = tab === "cleanup" || Object.values(filters).some(Boolean);

  const columns: Column<WorkflowEvent>[] = [
    { header: t.colDate, cell: (e) => <span className="tabular-nums whitespace-nowrap">{fmtDate(e.at)}</span> },
    { header: t.colWorkflow, cell: (e) => workflowName(t, e.workflow) },
    {
      header: t.colEvent,
      cell: (e) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${e.kind === "deletion" ? "text-[var(--color-crimson)]" : "text-[var(--color-slate)]"}`} aria-hidden />
            {actionLabel(t, e)}
          </span>
        );
      },
    },
    { header: t.colOrigin, cell: (e) => <span className="text-[var(--color-slate)]">{t.origins[e.origin]}</span> },
    { header: t.colActor, cell: (e) => <span className="text-[var(--color-slate)] break-all">{e.actor || "—"}</span> },
    { header: t.colResult, cell: (e) => e.kind === "run" ? <ImportStatusBadge status={e.status} /> : <ResultBadge result={e.status} /> },
    {
      header: t.colDetails,
      cell: (e) => (
        <div>
          <span className="tabular-nums">{detailsText(t, e)}</span>
          {e.error && <p className="text-xs text-[var(--color-crimson)] break-words mt-0.5">{e.error}</p>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-[var(--color-border-subtle)] overflow-hidden" role="group" aria-label="Language">
              {(["en", "fr"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLang(l)}
                  aria-pressed={lang === l}
                  className={`px-2.5 py-1.5 text-xs font-sans font-semibold uppercase focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] ${
                    lang === l ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-slate)] hover:bg-[var(--color-ivory-dim)]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={refresh} className={ghostBtn}>
              <RefreshCw className="w-4 h-4" aria-hidden /> {t.refresh}
            </button>
          </>
        }
      />

      <h2 className="font-sans font-semibold text-sm text-[var(--color-charcoal)] mb-2">{t.live}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
        {flows.map((w) => {
          const progress = liveProgress(w, t);
          const schedule = w.schedule;
          return (
            <Panel key={w.key}>
              <div className="p-4 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">{workflowName(t, w.key)}</h3>
                  <StateBadge w={w} t={t} />
                </div>

                {progress && <ProgressBar value={progress.value} max={progress.max} label={<span className="tabular-nums">{progress.label}</span>} />}

                <div className="text-xs font-sans text-[var(--color-slate)] space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{t.lastRun}</span>
                    {w.last_run ? (
                      <>
                        {w.last_run.kind === "run"
                          ? <ImportStatusBadge status={w.last_run.status} />
                          : <ResultBadge result={w.last_run.status} />}
                        <span className="tabular-nums text-[var(--color-charcoal)]">{fmtDate(w.last_run.at)}</span>
                        <span>· {t.origins[w.last_run.origin]}{w.last_run.actor ? ` · ${w.last_run.actor}` : ""}</span>
                      </>
                    ) : <span>— {t.never}</span>}
                  </div>
                  {w.last_run && <div className="tabular-nums">{detailsText(t, w.last_run)}</div>}
                  {!w.stage && <div>{w.key === "tender_stats" ? t.statsHint : t.cleanupHint}</div>}
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-[var(--color-gold)]" aria-hidden />
                    {schedule?.enabled
                      ? <span>{t.nextRun} <strong className="text-[var(--color-charcoal)] font-semibold">{fmtDate(schedule.next_run_at)}</strong></span>
                      : <span>{t.scheduleOff}</span>}
                  </div>
                </div>

                {!w.stage && (
                  <label className="inline-flex items-center gap-2 text-sm font-sans text-[var(--color-charcoal)]">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      disabled={!canRun}
                      title={!canRun ? t.needsRun : undefined}
                      checked={w.key === "tender_stats"
                        ? !!schedule?.enabled && schedule.schedule_kind === "interval"
                        : schedule?.enabled ?? false}
                      onChange={(e) => toggleSchedule(w, e.target.checked)}
                    />
                    {w.key === "tender_stats" ? t.hourlyStats : t.autoCleanup}
                  </label>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  {w.stage ? (
                    <PipelineControls
                      active={w.active}
                      paused={w.paused}
                      canRun={canRun}
                      onRun={() => confirmRun(w)}
                      onSteer={(action) => steer(w, action)}
                      runLabel={t.run}
                      runIcon={<Play className="w-4 h-4" aria-hidden />}
                      runningReason={t.alreadyRunning}
                    />
                  ) : (
                    <GatedButton
                      allowed={canRun && !w.active}
                      reason={w.active ? t.alreadyRunning : t.needsRun}
                      onClick={() => confirmRun(w)}
                    >
                      <Play className="w-4 h-4" aria-hidden /> {t.run}
                    </GatedButton>
                  )}
                  <Link
                    to={STAGE_PATH[w.key]}
                    className="inline-flex items-center gap-1 text-sm font-sans text-[var(--color-crimson)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] rounded"
                  >
                    {t.openPage} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title={t.journal}>
        <div className="px-4 pt-3 flex flex-wrap items-center gap-2" role="tablist">
          {([["all", t.tabAll], ["cleanup", t.tabCleanup]] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={`px-3 py-1.5 text-sm font-sans rounded-lg border focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] ${
                tab === key
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white font-semibold"
                  : "border-[var(--color-border-subtle)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 flex flex-wrap items-end gap-2">
          <select aria-label={t.colWorkflow} className={selectCls} value={filters.workflow} onChange={(e) => patchFilters({ workflow: e.target.value })}>
            <option value="">{t.allWorkflows}</option>
            {(Object.keys(t.workflows) as (keyof Text["workflows"])[]).map((k) => <option key={k} value={k}>{t.workflows[k]}</option>)}
          </select>
          {tab === "all" && (
            <select aria-label={t.colEvent} className={selectCls} value={filters.kind} onChange={(e) => patchFilters({ kind: e.target.value })}>
              <option value="">{t.allKinds}</option>
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}
            </select>
          )}
          <select aria-label={t.colOrigin} className={selectCls} value={filters.origin} onChange={(e) => patchFilters({ origin: e.target.value })}>
            <option value="">{t.allOrigins}</option>
            {(Object.keys(t.origins) as (keyof Text["origins"])[]).map((k) => <option key={k} value={k}>{t.origins[k]}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-sans text-[var(--color-slate)]">
            {t.from}
            <input type="date" className={inputCls} value={filters.date_from} onChange={(e) => patchFilters({ date_from: e.target.value })} />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-sans text-[var(--color-slate)]">
            {t.to}
            <input type="date" className={inputCls} value={filters.date_to} onChange={(e) => patchFilters({ date_to: e.target.value })} />
          </label>
        </div>

        {eventsError ? (
          <FailedState message={eventsError} onRetry={loadEvents} />
        ) : !events ? (
          <LoadingState label={t.loading} />
        ) : (
          <>
            <div className="px-1">
              <RunHistoryTable
                columns={columns}
                rows={events.data}
                rowKey={(e) => e.id}
                empty={filtered
                  ? <FilteredEmptyState onReset={() => { setFilters(NO_FILTERS); switchTab("all"); }} />
                  : <EmptyState title={t.emptyTitle} hint={t.emptyHint} />}
              />
            </div>
            <div className="px-4 py-2.5 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-[var(--color-slate)]">
              <span>{t.page(events.page, Math.max(1, events.pages), events.total)} — {t.recentOnly}</span>
              <div className="flex items-center gap-2">
                <button className={ghostBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t.previous}</button>
                <button className={ghostBtn} disabled={page >= events.pages} onClick={() => setPage((p) => p + 1)}>{t.next}</button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
