// Chrome shared by every lifecycle stage: the step position, the live run
// state, and the Controls / Data / Logs switcher. The views themselves are
// routed children, so only the active one mounts and polls.
//
// The status pill reads from /admin/workflows, which returns the same
// WorkflowState shape for every stage — that is what lets one shell serve all
// six without per-stage special-casing.
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { getWorkflows } from "../api";
import type { WorkflowState } from "../types";
import { ProgressBar, fmtDate } from "../components/ui";
import { EmptyState } from "../components/StateBlock";
import { resolveIcon } from "../components/icons";
import { usePipelinePolling } from "../hooks";
import { STAGES, stageBySlug, stagePath, type StageDescriptor, type StageSlug } from "./registry";

/** Run state of a stage, in the vocabulary the dashboard diagram already uses. */
function runState(w: WorkflowState | null, planned: boolean): string {
  if (planned) return "Planned";
  if (!w) return "Status unavailable";
  if (!w.active) return "Idle";
  return w.paused ? "Paused" : "Running";
}

function StatusPill({ state }: { state: string }) {
  const live = state === "Running";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-sans font-medium">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[var(--color-success)] motion-safe:animate-pulse" : "bg-[var(--color-muted-light)]"}`}
      />
      {state}
    </span>
  );
}

/** Previous / next stage links, so the lifecycle is walkable in order. */
function StepNav({ stage }: { stage: StageDescriptor }) {
  const prev = STAGES.find((s) => s.step === stage.step - 1);
  const next = STAGES.find((s) => s.step === stage.step + 1);
  return (
    <div className="flex items-center gap-1 text-sm font-sans">
      {prev ? (
        <NavLink
          to={stagePath(prev.slug)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]"
          title={`Previous stage: ${prev.title}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{prev.title}</span>
        </NavLink>
      ) : <span />}
      {next && (
        <NavLink
          to={stagePath(next.slug)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]"
          title={`Next stage: ${next.title}`}
        >
          <span className="hidden sm:inline">{next.title}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </NavLink>
      )}
    </div>
  );
}

const VIEWS = [
  { to: ".", label: "Controls", end: true },
  { to: "data", label: "Data", end: false },
  { to: "logs", label: "Logs", end: false },
] as const;

function ViewTabs() {
  return (
    <div role="tablist" aria-label="Stage views" className="mb-5 flex flex-wrap items-center gap-1 border-b border-[var(--color-border-subtle)]">
      {VIEWS.map((v) => (
        <NavLink
          key={v.label}
          to={v.to}
          end={v.end}
          role="tab"
          className={({ isActive }) =>
            `-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-sans font-semibold focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] ${
              isActive
                ? "border-[var(--color-crimson)] text-[var(--color-charcoal)]"
                : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
            }`
          }
        >
          {v.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function StageShell({ slug }: { slug: StageSlug }) {
  const stage = stageBySlug(slug);
  const [workflows, setWorkflows] = useState<WorkflowState[] | null>(null);

  const load = useCallback(() => {
    // Best-effort: the shell still renders its chrome without live state.
    getWorkflows().then((r) => setWorkflows(r.data)).catch(() => setWorkflows(null));
  }, []);

  useEffect(load, [load]);

  const w = stage?.workflow ? workflows?.find((x) => x.key === stage.workflow) ?? null : null;
  const active = w?.active ?? false;
  usePipelinePolling(load, active);

  if (!stage) {
    return <EmptyState title="Unknown stage" hint="This lifecycle stage does not exist." />;
  }

  const Icon = resolveIcon(stage.icon);
  const state = runState(w, !!stage.planned);
  const step = String(stage.step).padStart(2, "0");
  const progress = w?.progress ?? null;
  const progressEntries = progress ? Object.entries(progress) : [];
  const schedule = w?.schedule ?? null;

  return (
    <div>
      <div className="mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-sans font-semibold uppercase tracking-[0.12em] text-[var(--color-slate)]">
            Tender lifecycle · step {step} of {String(STAGES.length).padStart(2, "0")}
          </span>
          <StepNav stage={stage} />
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)]">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--color-charcoal)]">{stage.title}</h1>
              <StatusPill state={state} />
            </div>
            <p className="mt-1 text-sm font-sans text-[var(--color-slate)]">{stage.description}</p>
            <p className="mt-1 text-xs font-sans font-medium text-[var(--color-gold)]">{stage.detail}</p>
          </div>
        </div>

        {active && progressEntries.length > 0 && (
          <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-3">
            <span className="mb-2 inline-flex items-center gap-1.5 text-sm font-sans text-[var(--color-gold)]">
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
              {w?.paused ? "Paused" : "Running"} — refreshes automatically
            </span>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-sans tabular-nums text-[var(--color-slate)]">
              {progressEntries.map(([k, v]) => (
                <span key={k}>
                  {k.replace(/_/g, " ")} <strong className="text-[var(--color-charcoal)]">{v.toLocaleString("fr-FR")}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {!active && schedule?.enabled && schedule.next_run_at && (
          <p className="mt-3 text-xs font-sans text-[var(--color-slate)]">
            Next automatic run <strong className="text-[var(--color-charcoal)]">{fmtDate(schedule.next_run_at)}</strong>
          </p>
        )}
      </div>

      <ViewTabs />
      <Outlet context={{ stage, workflow: w, reloadStatus: load }} />
    </div>
  );
}

/** Progress bar helper reused by stage Controls views that have a bounded total. */
export function StageProgress({ value, max, label }: { value: number; max: number; label?: React.ReactNode }) {
  if (max <= 0) return null;
  return <ProgressBar value={value} max={max} label={label} />;
}
