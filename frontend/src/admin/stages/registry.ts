// The tender lifecycle, in order. This is the single source of truth for the
// admin information architecture: the sidebar, the dashboard diagram, the stage
// routes and the per-stage Controls / Data / Logs views all read from here, so a
// stage is added or reordered in one place.
//
// `workflow` ties a stage to its backend journal key (mpm/api/admin.py WorkflowKey) and
// drives both the status pill and the Logs view. `steer` ties it to the
// pause/resume/cancel endpoint. Planned stages have neither yet.
import type { PipelineStage, WorkflowKey } from "../types";

export type StageSlug =
  | "scrape" | "dce-cache" | "dce-extraction"
  | "video-generation" | "awards" | "campaigns";

export interface StageDescriptor {
  slug: StageSlug;
  step: number;
  /** Lifecycle name, as it reads on the dashboard diagram. */
  title: string;
  /** What the stage does, one sentence. */
  description: string;
  /** The transformation it performs, as a pipeline fragment. */
  detail: string;
  /** lucide icon name, resolved by ICONS in AdminLayout / StageShell. */
  icon: string;
  /** Backend journal key — null until the stage is implemented. */
  workflow: WorkflowKey | null;
  /** Pause/resume/cancel target — null when there is nothing to steer. */
  steer: PipelineStage | null;
  /** Extra journal keys folded into this stage's Logs (e.g. its cleanup job). */
  alsoLogs?: WorkflowKey[];
  /** True while the stage has no implementation behind it. */
  planned?: boolean;
  /** Shown in place of the three views while planned. */
  plannedNote?: string;
}

export const STAGES: StageDescriptor[] = [
  {
    slug: "scrape",
    step: 1,
    title: "Collecte HTML",
    description: "Collect tender notices from marchespublics.gov.ma and refresh the catalog.",
    detail: "Light HTML scraping",
    icon: "DownloadCloud",
    workflow: "scrape_digest",
    steer: "imports",
    alsoLogs: ["tender_stats"],
  },
  {
    slug: "dce-cache",
    step: 2,
    title: "Dossiers ZIP",
    description: "Pre-download each tender's consultation archive so users get instant, form-free downloads.",
    detail: "Download → cache",
    icon: "Archive",
    workflow: "dce_cache",
    steer: "dce-cache",
    alsoLogs: ["dce_cache_cleanup"],
  },
  {
    slug: "dce-extraction",
    step: 3,
    title: "Fiches universelles",
    description: "Turn consultation documents into structured, redacted information.",
    detail: "Unzip → text / OCR if needed → AI analysis",
    icon: "FileSearch",
    workflow: "dce_extraction",
    steer: "dce-extraction",
  },
  {
    slug: "video-generation",
    step: 4,
    title: "Video generation",
    description: "Create a short reel from the fiche universelle.",
    detail: "Fiche universelle → video reel",
    icon: "Video",
    workflow: null,
    steer: null,
    planned: true,
    plannedNote: "Planned: use the fiche universelle to generate a short reel for the tender. No rendering runs here yet.",
  },
  {
    slug: "awards",
    step: 5,
    title: "Résultats & attributions",
    description: "Retrieve award results after the deadline and build supplier history.",
    detail: "Award PDF → winner + amount",
    icon: "FileCheck2",
    workflow: null,
    steer: null,
    planned: true,
    plannedNote: "Planned: retrieve award PDFs after the deadline, verify winning suppliers and amounts, and retain the source evidence.",
  },
  {
    slug: "campaigns",
    step: 6,
    title: "Campagnes",
    description: "Prepare award-result campaigns and track delivery before archiving.",
    detail: "Results → email campaign",
    icon: "Mail",
    workflow: null,
    steer: null,
    planned: true,
    plannedNote: "Planned: prepare award-result campaigns, track delivery, and retain campaign history before final archiving.",
  },
];

/** Route base for a stage. The three views hang off it as /controls-less index, /data, /logs. */
export const stagePath = (slug: StageSlug): string => `/admin/${slug}`;

export const stageBySlug = (slug: string | undefined): StageDescriptor | undefined =>
  STAGES.find((s) => s.slug === slug);

/** Every journal key a stage owns — its own plus any folded-in jobs. */
export const stageWorkflowKeys = (stage: StageDescriptor): WorkflowKey[] =>
  [stage.workflow, ...(stage.alsoLogs ?? [])].filter((k): k is WorkflowKey => k !== null);

/** The live stages, in order — used where planned stages make no sense. */
export const LIVE_STAGES = STAGES.filter((s) => !s.planned);

/** Stages with no implementation yet; routed to the planned notice. */
export const PLANNED_STAGES = STAGES.filter((s) => s.planned);
