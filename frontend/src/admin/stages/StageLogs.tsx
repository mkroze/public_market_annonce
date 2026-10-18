// The Logs view, shared by every stage. It reads the same journal the Workflows
// page shows, narrowed to the job keys the stage owns (its own run key plus any
// folded-in job such as the cache cleanup), so "what has this stage been doing"
// is answerable without leaving the stage.
import { useCallback, useEffect, useState } from "react";
import { Play, SlidersHorizontal, Trash2, Archive, RotateCcw, Settings2 } from "lucide-react";
import { getWorkflowEvents, ApiError } from "../api";
import type { Paginated, WorkflowEvent, WorkflowEventKind } from "../types";
import { Panel, fmtDate, duration } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { RunHistoryTable, type Column } from "../components/RunHistoryTable";
import { ImportStatusBadge, ResultBadge } from "../components/StatusBadge";
import { usePipelinePolling } from "../hooks";
import { useStageContext } from "./useStageContext";
import { stageWorkflowKeys } from "./registry";

const PER_PAGE = 25;

const KIND_ICON: Record<WorkflowEventKind, typeof Play> = {
  run: Play,
  control: SlidersHorizontal,
  deletion: Trash2,
  archive: Archive,
  restore: RotateCcw,
  config: Settings2,
};

/** Turn an event's details blob into one scannable line. */
function detailsText(e: WorkflowEvent): string {
  const d = e.details ?? {};
  const parts = Object.entries(d)
    .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" ? v.toLocaleString("fr-FR") : String(v)}`);
  if (e.error) parts.unshift(e.error);
  return parts.length ? parts.join(" · ") : "—";
}

export default function StageLogs() {
  const { stage, workflow } = useStageContext();
  // Comma-separated so one request covers the stage's own key plus folded-in jobs.
  const keyParam = stageWorkflowKeys(stage).join(",");

  const [events, setEvents] = useState<Paginated<WorkflowEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [page, setPage] = useState(1);

  const active = workflow?.active ?? false;

  const load = useCallback((showSpinner = false) => {
    if (!keyParam) { setLoading(false); return; }
    if (showSpinner) setLoading(true);
    getWorkflowEvents({ workflow: keyParam, page: String(page), per_page: String(PER_PAGE) })
      .then((res) => { setEvents(res); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, String(e))))
      .finally(() => setLoading(false));
  }, [page, keyParam]);

  useEffect(() => { load(true); }, [load]);
  usePipelinePolling(() => load(false), active);

  if (stage.planned) {
    return <EmptyState title="Nothing logged yet" hint={stage.plannedNote} />;
  }
  if (loading) return <LoadingState label={`Loading ${stage.title} logs`} />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={() => load(true)} />;

  const rows = events?.data ?? [];
  const pages = events?.pages ?? 1;

  const columns: Column<WorkflowEvent>[] = [
    {
      header: "When",
      cell: (e) => <span className="tabular-nums whitespace-nowrap">{fmtDate(e.at)}</span>,
    },
    {
      header: "Event",
      cell: (e) => {
        const Icon = KIND_ICON[e.kind] ?? Play;
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-slate)]" aria-hidden />
            <span className="capitalize">{e.action.replace(/[._]/g, " ")}</span>
          </span>
        );
      },
    },
    {
      header: "Status",
      cell: (e) => e.kind === "run"
        ? <ImportStatusBadge status={e.status} />
        : <ResultBadge result={e.status} />,
    },
    { header: "Origin", cell: (e) => <span className="capitalize text-[var(--color-slate)]">{e.origin}</span> },
    { header: "Actor", cell: (e) => <span className="text-[var(--color-slate)]">{e.actor || "—"}</span> },
    {
      header: "Took",
      cell: (e) => (
        <span className="tabular-nums">
          {e.finished_at ? duration({ started_at: e.at, finished_at: e.finished_at }) : "—"}
        </span>
      ),
    },
    {
      header: "Details",
      cell: (e) => <span className="tabular-nums text-[var(--color-slate)]">{detailsText(e)}</span>,
    },
  ];

  return (
    <div>
      <Panel title={`${stage.title} journal`}>
        <div className="px-1 pb-1">
          <RunHistoryTable
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            empty={<EmptyState title="Nothing logged yet" hint={`No runs or actions recorded for ${stage.title} so far.`} />}
          />
        </div>
      </Panel>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm font-sans">
          <span className="text-[var(--color-slate)] tabular-nums">
            Page {events?.page ?? 1} of {pages} · {events?.total ?? 0} events
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={(events?.page ?? 1) <= 1}
              className="inline-flex min-h-9 items-center rounded-lg border border-[var(--color-border-subtle)] px-3 hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={(events?.page ?? 1) >= pages}
              className="inline-flex min-h-9 items-center rounded-lg border border-[var(--color-border-subtle)] px-3 hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
