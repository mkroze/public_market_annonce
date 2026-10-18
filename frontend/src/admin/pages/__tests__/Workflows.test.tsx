import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkflowJournal from "../WorkflowJournal";

const mocks = vi.hoisted(() => ({
  getWorkflows: vi.fn(),
  getWorkflowEvents: vi.fn(),
  getAuditLogs: vi.fn(),
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
  getAuditLogs: mocks.getAuditLogs,
}));

function seedApi() {
  mocks.getAuditLogs.mockResolvedValue({ data: [], total: 0, pages: 1 });
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
}

function renderPage() {
  return render(<MemoryRouter><WorkflowJournal /></MemoryRouter>);
}

describe("Dashboard activity journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("admin.workflows.lang", "en");
    mocks.role = "owner";
    seedApi();
  });

  it("shows the merged journal without treatment cards", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Activity journal" })).toBeInTheDocument();
    const clearRow = (await screen.findByText("Cache cleared")).closest("tr")!;
    expect(within(clearRow).getByText(/7 files removed · 5\.0 MB freed · mode outdated · 2 orphan files/)).toBeInTheDocument();
    expect(screen.getByText(/40 found · 3 new · 2m 5s/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pipelines" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run now|Pause/ })).not.toBeInTheDocument();
    expect(mocks.getWorkflows).not.toHaveBeenCalled();
  });

  it("filters the journal to deletions and cleanups", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Deletions & cleanups" }));
    expect(mocks.getWorkflowEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "deletion,archive,restore", page: "1", per_page: "15" }),
    );
  });

  it("switches the journal to French", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "fr" }));
    expect(screen.getByRole("heading", { name: "Journal d'activité" })).toBeInTheDocument();
    expect(screen.getByText("Cache vidé")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Traitements" })).not.toBeInTheDocument();
  });

  it("opens and refreshes the embedded audit trail", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Audit trail" }));
    expect(await screen.findByText("No audit events")).toBeInTheDocument();
    expect(mocks.getAuditLogs).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mocks.getAuditLogs).toHaveBeenCalledTimes(2);
  });

  it("allows auditors to inspect activity", async () => {
    mocks.role = "auditor";
    renderPage();
    expect(await screen.findByText("Cache cleared")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Audit trail" })).toBeInTheDocument();
  });
});
