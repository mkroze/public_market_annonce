import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, Archive, DownloadCloud, FileSearch, FileCheck2, Mail, Table2, ScrollText, Video } from "lucide-react";
import type { ImportsStatus, DceCacheStatus, DceExtractionStatus } from "../types";
import { fmtDate } from "./ui";

export interface PipelineSnapshot {
  imports: ImportsStatus | null;
  cache: DceCacheStatus | null;
  extraction: DceExtractionStatus | null;
}

function runState(stage: { active: boolean; paused: boolean } | null) {
  if (!stage) return "Status unavailable";
  return stage.active ? stage.paused ? "Paused" : "Running" : "Idle";
}

export default function PipelineDiagram({ total, snapshot }: { total: number; snapshot: PipelineSnapshot | null }) {
  const stages = [
    { title: "Collecte HTML", icon: DownloadCloud, path: "/admin/scrape", description: "Collect tender notices and refresh the catalog.", detail: "Light HTML scraping", count: total, unit: "tenders in catalog", state: runState(snapshot?.imports ?? null), tone: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" },
    { title: "Dossiers ZIP", icon: Archive, path: "/admin/dce-cache", description: "Associate each tender with its consultation archive.", detail: "Download → cache", count: snapshot?.cache?.cached_total, unit: "ZIP archives cached", state: runState(snapshot?.cache ?? null), tone: "bg-[var(--color-warning-soft)] text-[var(--color-ink)]" },
    { title: "Fiches universelles", icon: FileSearch, path: "/admin/dce-extraction", description: "Turn consultation documents into structured information.", detail: "Unzip → text / OCR if needed → AI analysis", count: snapshot?.extraction?.extracted_count, unit: "extraction results stored", state: runState(snapshot?.extraction ?? null), tone: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
    { title: "Video generation", icon: Video, path: "/admin/video-generation", description: "Create a short reel from the fiche universelle.", detail: "Fiche universelle → video reel", count: undefined, unit: "Video generation is not available yet", state: "Planned", tone: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" },
  ];

  return (
    <section aria-labelledby="pipeline-title" className="relative isolate mb-4 overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-3 sm:p-4">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[40px] border-[var(--color-primary-soft)]/60" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">From source to insight</span>
          <h2 id="pipeline-title" className="mt-1 text-base font-bold tracking-tight">Tender lifecycle</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Choose a stage to open its controls, data, and run history.</p>
        </div>
        <a href="#activity-journal" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]">
          <ScrollText className="h-4 w-4" aria-hidden /> Activity journal <ArrowDown className="h-4 w-4" aria-hidden />
        </a>
      </div>

      <nav aria-label="Tender lifecycle pipeline">
        <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {stages.map((stage, index) => (
            <Fragment key={stage.path}>
              {index > 0 && <li aria-hidden className="flex items-center justify-center text-[var(--color-primary)]"><ArrowDown className="h-5 w-5 lg:hidden" /><ArrowRight className="hidden h-5 w-5 lg:block" /></li>}
              <li className="min-w-0 flex-1">
                <Link to={stage.path} className="group flex h-full flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`grid h-9 w-9 place-items-center rounded-2xl ${stage.tone}`}><stage.icon className="h-4 w-4" aria-hidden /></span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium">
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${stage.state === "Running" ? "bg-[var(--color-success)] motion-safe:animate-pulse" : "bg-[var(--color-muted-light)]"}`} />{stage.state}
                    </span>
                  </div>
                  <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Step 0{index + 1}</span>
                  <h3 className="mt-1 text-base font-bold">{stage.title}</h3>
                  <p className="mb-3 mt-2 text-xs font-medium text-[var(--color-primary)]">{stage.detail}</p>
                  <div className="mt-auto border-t border-[var(--color-border-subtle)] pt-3">
                    <span className="block text-2xl font-bold tabular-nums">{stage.count?.toLocaleString("fr-FR") ?? "—"}</span>
                    <span className="text-xs text-[var(--color-muted)]">{stage.unit}</span>
                    <span className="mt-2 flex items-center justify-between text-sm font-semibold text-[var(--color-primary)]">Open stage <ArrowRight className="h-4 w-4" aria-hidden /></span>
                  </div>
                </Link>
              </li>
            </Fragment>
          ))}
        </ol>

        <div className="my-3 flex items-center gap-3 text-xs font-medium text-[var(--color-muted)]"><ArrowDown className="h-4 w-4" aria-hidden /><span>After the deadline · planned continuation</span><span className="h-px flex-1 bg-[var(--color-border-subtle)]" /></div>
        <ol start={5} className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Résultats & attributions", path: "/admin/awards", icon: FileCheck2, description: "Find the award PDF, verify the winner and awarded amount, and build supplier history." },
            { title: "Campagnes", path: "/admin/campaigns", icon: Mail, description: "Prepare award-result emails and track delivery before final archiving." },
          ].map((stage, index) => (
            <li key={stage.path}>
              <Link to={stage.path} className="flex h-full gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-white/75 p-3 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]">
                <stage.icon className="mt-1 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">0{index + 5} · {stage.title}</h3><span className="rounded-full bg-[var(--color-warning-soft)] px-2 py-1 text-xs">Planned</span></div><p className="mt-2 text-sm text-[var(--color-muted)]">{stage.description}</p></div>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--color-border-subtle)] pt-3 text-sm">
        <Link to="/admin/tenders" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"><Table2 className="h-4 w-4" aria-hidden /> Browse & maintain catalog</Link>
        <Link to="/admin/dce-cache" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"><Archive className="h-4 w-4" aria-hidden /> ZIP storage & cleanup</Link>
        <span className="text-xs text-[var(--color-muted)] sm:ml-auto">Next import: {fmtDate(snapshot?.imports?.next_scheduled_run)}</span>
      </div>
    </section>
  );
}
