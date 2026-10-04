import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Workflows from "../Workflows";

const mocks = vi.hoisted(() => ({
  getWorkflows: vi.fn(),
  getWorkflowEvents: vi.fn(),
  runImport: vi.fn(),
  runDceCache: vi.fn(),
  runDceExtraction: vi.fn(),
  runCron: vi.fn(),
  updateCron: vi.fn(),
  steerPipeline: vi.fn(),
  role: "owner",
}));

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "owner@x.com", role: mocks.role } }),
}));

vi.mock("../../api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getWorkflows: mocks.getWorkflows,
  getWorkflowEvents: mocks.getWorkflowEvents,
  runImport: mocks.runImport,
  runDceCache: mocks.runDceCache,
  runDceExtraction: mocks.runDceExtraction,
  runCron: mocks.runCron,
  updateCron: mocks.updateCron,
  steerPipeline: mocks.steerPipeline,
}));

const schedule = {
  job: "scrape_digest", label: "Scrape", enabled: true, schedule_kind: "daily", hour: 7,
  interval_minutes: 1440, last_run_at: null, last_status: null,
  next_run_at: "2026-10-05T07:00:00+01:00", updated_at: null, updated_by: null,
};

function flow(key: string, stage: string | null, over: Record<string, unknown> = {}) {
  return {
    key, label: key, stage, active: false, paused: false, cancel_requested: false,
    progress: null, last_run: null, schedule: { ...schedule, job: key, enabled: key === "scrape_digest" },
    ...over,
  };
}

function seedApi() {
  mocks.getWorkflows.mockResolvedValue({
    data: [
      flow("scrape_digest", "imports"),
      flow("dce_cache", "dce-cache", {
        active: true,
        last_run: {
          id: "run:dce_cache:3", at: "2026-10-04 09:00:00", finished_at: null, workflow: "dce_cache",
          kind: "run", action: "dce_cache.run", origin: "manual", actor: "owner@x.com", status: "running",
          run_id: 3, error: null, details: { total: 10, cached: 4, skipped: 1, failed: 0 },
        },
      }),
      flow("dce_extraction", "dce-extraction"),
      flow("dce_cache_cleanup", null),
      flow("tender_stats", null, {
        last_run: {
          id: "run:tender_stats", at: "2026-10-04 06:00:00", finished_at: null, workflow: "tender_stats",
          kind: "run", action: "tender_stats.run", origin: "scheduled", actor: "scheduler", status: "done",
          run_id: null, error: null, details: { tender_count: 288, active_tender_count: 250 },
        },
      }),
    ],
  });
  mocks.getWorkflowEvents.mockResolvedValue({
    total: 2, page: 1, per_page: 25, pages: 1,
    data: [
      {
        id: "audit:9", at: "2026-10-04 10:00:00", finished_at: null, workflow: "dce_cache", kind: "deletion",
        action: "dce_cache.clear", origin: "manual", actor: "owner@x.com", status: "success", run_id: null,
        error: null, details: { removed: 7, freed_bytes: 5 * 1024 * 1024, mode: "outdated", orphans_removed: 2 },
      },
      {
        id: "run:scrape_digest:1", at: "2026-10-04 07:00:00", finished_at: "2026-10-04 07:02:05",
        workflow: "scrape_digest", kind: "run", action: "scrape_digest.run", origin: "scheduled",
        actor: "scheduler", status: "done", run_id: 1, error: null,
        details: { tenders_found: 40, tenders_new: 3 },
      },
    ],
  });
  mocks.updateCron.mockResolvedValue({ ...schedule, job: "dce_cache_cleanup" });
  mocks.steerPipeline.mockResolvedValue({ status: "pause", paused: true, cancel_requested: false });
}

function renderPage() {
  return render(<MemoryRouter><Workflows /></MemoryRouter>);
}

describe("Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("admin.workflows.lang", "en");
    mocks.role = "owner";
    seedApi();
  });

  it("shows each pipeline's state and the merged journal", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "DCE caching" })).toBeInTheDocument();
    expect(screen.getAllByText("Idle")).toHaveLength(4);
    expect(screen.getByText("288 in total · 250 current")).toBeInTheDocument();
    expect(screen.getByText(/5\/10 · 4 cached/)).toBeInTheDocument();

    const clearRow = (await screen.findByText("Cache cleared")).closest("tr")!;
    expect(within(clearRow).getByText(/7 files removed · 5\.0 MB freed · mode outdated · 2 orphan files/)).toBeInTheDocument();
    const runRow = screen.getByText(/40 found · 3 new · 2m 5s/).closest("tr")!;
    expect(within(runRow).getByText("Scheduled")).toBeInTheDocument();
  });

  it("steers the active pipeline through its own stage", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Pause/ }));
    expect(mocks.steerPipeline).toHaveBeenCalledWith("dce-cache", "pause");
  });

  it("filters the journal to deletions and cleanups", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Deletions & cleanups" }));
    expect(mocks.getWorkflowEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "deletion,archive,restore", page: "1" }),
    );
  });

  it("enables the automatic cache cleanup from its card", async () => {
    renderPage();
    const toggle = await screen.findByRole("checkbox", { name: "Automatic daily cleanup" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(mocks.updateCron).toHaveBeenCalledWith("dce_cache_cleanup", { enabled: true });
  });

  it("switches the tender count to hourly from its card", async () => {
    renderPage();
    const toggle = await screen.findByRole("checkbox", { name: "Recompute every hour" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(mocks.updateCron).toHaveBeenCalledWith(
      "tender_stats", { enabled: true, schedule_kind: "interval", interval_minutes: 60 },
    );
  });

  it("switches to French", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "fr" }));
    expect(screen.getByRole("heading", { name: "Mise en cache des DCE" })).toBeInTheDocument();
    expect(screen.getByText("Cache vidé")).toBeInTheDocument();
  });

  it("disables run controls without imports.run", async () => {
    mocks.role = "auditor";
    renderPage();
    await screen.findByRole("heading", { name: "DCE caching" });
    for (const button of screen.getAllByRole("button", { name: /Run now/ })) expect(button).toBeDisabled();
  });
});
