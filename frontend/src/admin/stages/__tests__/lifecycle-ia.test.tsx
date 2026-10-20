import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAGES, LIVE_STAGES, PLANNED_STAGES, stageWorkflowKeys, stageBySlug } from "../registry";
import { NAV_ITEMS } from "../../permissions";
import { ICONS } from "../../components/icons";

const api = vi.hoisted(() => ({ getWorkflows: vi.fn() }));
vi.mock("../../api", () => ({ ...api, ApiError: class extends Error { status = 0; } }));

beforeEach(() => {
  vi.clearAllMocks();
  api.getWorkflows.mockResolvedValue({ data: [] });
});

describe("lifecycle registry", () => {
  it("defines six stages numbered 1..6 with unique slugs", () => {
    expect(STAGES).toHaveLength(6);
    expect(STAGES.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(STAGES.map((s) => s.slug)).size).toBe(6);
  });

  it("gives every live stage a journal key and a steer target, and planned stages neither", () => {
    expect(LIVE_STAGES).toHaveLength(3);
    for (const s of LIVE_STAGES) {
      expect(s.workflow, `${s.slug} workflow`).not.toBeNull();
      expect(s.steer, `${s.slug} steer`).not.toBeNull();
    }
    expect(PLANNED_STAGES).toHaveLength(3);
    for (const s of PLANNED_STAGES) {
      expect(s.workflow, `${s.slug} workflow`).toBeNull();
      expect(s.steer, `${s.slug} steer`).toBeNull();
      expect(s.plannedNote, `${s.slug} note`).toBeTruthy();
    }
  });

  it("folds a stage's extra job keys into the keys it logs", () => {
    expect(stageWorkflowKeys(stageBySlug("dce-cache")!)).toEqual(["dce_cache", "dce_cache_cleanup"]);
    expect(stageWorkflowKeys(stageBySlug("scrape")!)).toEqual(["scrape_digest", "tender_stats"]);
    // Planned stages own no journal key, so their Logs view has nothing to fetch.
    expect(stageWorkflowKeys(stageBySlug("awards")!)).toEqual([]);
  });

  it("names only icons the shared registry can resolve", () => {
    for (const s of STAGES) expect(ICONS, `${s.slug} icon ${s.icon}`).toHaveProperty(s.icon);
  });
});

describe("sidebar", () => {
  it("lists the six lifecycle stages in order, under one group", () => {
    const lifecycle = NAV_ITEMS.filter((i) => i.group === "Tender lifecycle");
    expect(lifecycle.map((i) => i.path)).toEqual(STAGES.map((s) => `/admin/${s.slug}`));
    expect(lifecycle.map((i) => i.label)).toEqual([
      "01 · Collecte HTML",
      "02 · Dossiers ZIP",
      "03 · Fiches universelles",
      "04 · Video generation",
      "05 · Résultats & attributions",
      "06 · Campagnes",
    ]);
  });

  it("drops the pages folded into other owners", () => {
    const paths = NAV_ITEMS.map((i) => i.path);
    for (const gone of ["/admin/cron", "/admin/tenders", "/admin/audit-logs", "/admin/roles", "/admin/integrations", "/admin/workflows"]) {
      expect(paths, `${gone} should no longer be a nav entry`).not.toContain(gone);
    }
  });

  it("keeps dashboard and the administration group", () => {
    expect(NAV_ITEMS.map((i) => i.path)).toEqual(expect.arrayContaining([
      "/admin", "/admin/users", "/admin/costs", "/admin/settings",
    ]));
  });
});

describe("StageShell", () => {
  // Imported lazily so the api mock above is in place first.
  async function renderStage(slug: string, path: string) {
    const { default: StageShell } = await import("../StageShell");
    const { default: PlannedView } = await import("../PlannedView");
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={`/admin/${slug}`} element={<StageShell slug={slug as never} />}>
            <Route index element={<div>controls-view</div>} />
            <Route path="data" element={<div>data-view</div>} />
            <Route path="logs" element={<PlannedView />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("shows the stage's step, title and the shared view tabs", async () => {
    await renderStage("dce-cache", "/admin/dce-cache");
    expect(await screen.findByRole("heading", { name: "Dossiers ZIP" })).toBeInTheDocument();
    expect(screen.getByText(/step 02 of 06/)).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "Stage views" }));
    expect(tabs.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Vue d’ensemble", "Données", "Journal", "Planification"]);
  });

  it("renders the view matching the route", async () => {
    await renderStage("dce-cache", "/admin/dce-cache/data");
    expect(await screen.findByText("data-view")).toBeInTheDocument();
    expect(screen.queryByText("controls-view")).not.toBeInTheDocument();
  });

  it("walks the lifecycle with previous/next links", async () => {
    await renderStage("dce-cache", "/admin/dce-cache");
    expect(await screen.findByTitle("Previous stage: Collecte HTML")).toHaveAttribute("href", "/admin/scrape");
    expect(screen.getByTitle("Next stage: Fiches universelles")).toHaveAttribute("href", "/admin/dce-extraction");
  });

  it("reports a planned stage as planned rather than idle", async () => {
    await renderStage("awards", "/admin/awards/logs");
    // "Planned" appears twice by design: the shell's status pill and the view's
    // own notice. Both matter, so assert the count rather than a single node.
    expect(await screen.findByRole("heading", { name: "Résultats & attributions" })).toBeInTheDocument();
    expect(screen.getAllByText("Planned")).toHaveLength(2);
    expect(screen.getByText(/award PDFs after the deadline/)).toBeInTheDocument();
  });
});
