import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, Trash2, Archive, ArchiveRestore, SlidersHorizontal, Settings2, ScrollText, CalendarClock, DownloadCloud, Database, FileSearch, Calculator, ShieldCheck, ListFilter, ChevronLeft, ChevronRight, Clock, User, Activity } from "lucide-react";
import { getWorkflowEvents, ApiError } from "../api";
import type { Paginated, WorkflowEvent, WorkflowEventKind } from "../types";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import { Panel, fmtDate, fmtBytes, duration } from "../components/ui";
import { LoadingState, FailedState, EmptyState, FilteredEmptyState } from "../components/StateBlock";
import { ImportStatusBadge, ResultBadge } from "../components/StatusBadge";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { usePipelinePolling } from "../hooks";
import AuditLogs from "./AuditLogs";

// The rest of the admin has no i18n layer, so this page carries its own small
// EN/FR dictionary and remembers the choice per browser.
type Lang = "en" | "fr";
const LANG_KEY = "admin.workflows.lang";

const TEXT = {
  en: {
    loading: "Loading activity",
    refresh: "Refresh",
    journal: "Activity journal",
    tabAll: "All activity", tabCleanup: "Deletions & cleanups", tabAudit: "Audit trail",
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
      found: "found", fresh: "new", refreshed: "updated", cached: "cached", skipped: "skipped", failed: "failed", enqueued: "enqueued",
      files: "files removed", freed: "freed", orphans: "orphan files", mode: "mode",
      archived: "archived", restored: "restored", matched: "matched", run: "Run",
      all: "in total", current: "current",
      sector: "sector", enabled: "enabled", disabled: "disabled", daily: "daily at", every: "every",
    },
  },
  fr: {
    loading: "Chargement de l'activité",
    refresh: "Actualiser",
    journal: "Journal d'activité",
    tabAll: "Toute l'activité", tabCleanup: "Suppressions et nettoyages", tabAudit: "Journal d'audit",
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
      found: "trouvés", fresh: "nouveaux", refreshed: "mis à jour", cached: "mis en cache", skipped: "ignorés", failed: "en échec", enqueued: "envoyés",
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

const CLEANUP_KINDS = "deletion,archive,restore";
const KIND_OPTIONS: WorkflowEventKind[] = ["run", "control", "deletion", "archive", "restore", "config"];
const PER_PAGE = 15;

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
      parts.push(`${num(d.tenders_found)} ${t.d.found}`, `${num(d.tenders_new)} ${t.d.fresh}`,
                 `${num(d.tenders_updated)} ${t.d.refreshed}`);
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

const selectCls = "select select-bordered select-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
const inputCls = "input input-bordered input-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";
const ghostBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed";

interface Filters { workflow: string; kind: string; origin: string; date_from: string; date_to: string; }
const NO_FILTERS: Filters = { workflow: "", kind: "", origin: "", date_from: "", date_to: "" };

/** Journal tabs. "audit" renders the folded-in audit-log explorer. */
type JournalTab = "all" | "cleanup" | "audit";

export default function WorkflowJournal({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [auditRefresh, setAuditRefresh] = useState(0);
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = TEXT[lang];

  const [tab, setTab] = useState<JournalTab>(
    () => (params.get("tab") === "audit" ? "audit" : "all"),
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<Paginated<WorkflowEvent> | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const loadEvents = useCallback(() => {
    if (tab === "audit") return;
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

  useEffect(() => { loadEvents(); }, [loadEvents, refreshKey]);
  usePipelinePolling(loadEvents, tab !== "audit", 15000);

  function switchLang(next: Lang) {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* storage unavailable */ }
  }

  function patchFilters(patch: Partial<Filters>) {
    setFilters((cur) => ({ ...cur, ...patch }));
    setPage(1);
  }

  function switchTab(next: JournalTab) {
    setTab(next);
    setPage(1);
  }

  const filtered = tab === "cleanup" || Object.values(filters).some(Boolean);

  const columns: Column<WorkflowEvent>[] = [
    { header: <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{t.colDate}</span>, cell: (e) => <span className="tabular-nums whitespace-nowrap">{fmtDate(e.at)}</span> },
    { header: t.colWorkflow, cell: (e) => {
      const Icon = ({ scrape_digest: DownloadCloud, dce_cache: Database, dce_extraction: FileSearch, dce_cache_cleanup: Trash2, tender_stats: Calculator } as Record<string, typeof Play>)[e.workflow ?? ""] ?? Activity;
      return <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" aria-hidden />{workflowName(t, e.workflow)}</span>;
    } },
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
    { header: <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden />{t.colOrigin} / {t.colActor}</span>, cell: (e) => {
      const Icon = e.origin === "manual" ? User : CalendarClock;
      return <div className="text-[var(--color-slate)]"><span className="inline-flex items-center gap-1"><Icon className="h-3 w-3" aria-hidden />{t.origins[e.origin]}</span><span className="block max-w-36 truncate text-xs" title={e.actor ?? undefined}>{e.actor || "—"}</span></div>;
    } },
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="activity-journal" className="flex scroll-mt-20 items-center gap-2 text-base font-semibold"><ScrollText className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />{t.journal}</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--color-border-subtle)]" role="group" aria-label="Language">
            {(["en", "fr"] as const).map((l) => <button key={l} onClick={() => switchLang(l)} aria-pressed={lang === l} className={`min-h-9 px-2.5 text-xs font-semibold uppercase rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${lang === l ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-slate)]"}`}>{l}</button>)}
          </div>
          <button onClick={() => tab === "audit" ? setAuditRefresh((value) => value + 1) : loadEvents()} className={ghostBtn}><RefreshCw className="h-3.5 w-3.5" aria-hidden />{t.refresh}</button>
        </div>
      </div>
      <Panel>
        <div className="px-3 pt-2 flex flex-wrap items-center gap-2" role="tablist">
          {([["all", t.tabAll, Activity], ["cleanup", t.tabCleanup, Trash2], ["audit", t.tabAudit, ShieldCheck]] as const).filter(([key]) => key !== "audit" || can(user?.role, "audit.view")).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={`inline-flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-xs font-sans rounded-lg border focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] ${
                tab === key
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white font-semibold"
                  : "border-[var(--color-border-subtle)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />{label}
            </button>
          ))}
        </div>

        {tab === "audit" ? (
          <div className="px-4 py-3">
            <AuditLogs key={`${refreshKey}:${auditRefresh}`} embedded />
          </div>
        ) : (
        <>
        <div className="px-3 py-2 flex flex-wrap items-end gap-2">
          <ListFilter className="mb-2 h-4 w-4 text-[var(--color-muted)]" aria-hidden />
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
              <span title={t.recentOnly}>{t.page(events.page, Math.max(1, events.pages), events.total)}</span>
              <div className="flex items-center gap-2">
                <button className={ghostBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />{t.previous}</button>
                <button className={ghostBtn} disabled={page >= events.pages} onClick={() => setPage((p) => p + 1)}>{t.next}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
              </div>
            </div>
          </>
        )}
        </>
        )}
      </Panel>

    </div>
  );
}
