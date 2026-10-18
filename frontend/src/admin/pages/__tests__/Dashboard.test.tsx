import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import Dashboard from "../Dashboard";
import { NAV_ITEMS } from "../../permissions";

const api = vi.hoisted(() => ({
  getOverview: vi.fn(), getImports: vi.fn(), getDceCache: vi.fn(),
  getDceExtraction: vi.fn(), updateCron: vi.fn(), getWorkflowEvents: vi.fn(),
}));
vi.mock("../../api", () => ({ ...api, ApiError: class extends Error {} }));
vi.mock("../../../lib/auth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("admin.workflows.lang", "en");
  api.getWorkflowEvents.mockResolvedValue({ data: [], total: 0, page: 1, pages: 1, per_page: 15 });
  api.getOverview.mockResolvedValue({
    freshness: { tender_count: 120, active_tender_count: 100, detail_coverage_pct: 90, detail_count: 108 },
    failure_queues: {}, health: {}, governance: [], last_import: null,
  });
  api.getImports.mockResolvedValue({ active: true, paused: false });
  api.getDceCache.mockResolvedValue({ cached_total: 80, active: false, paused: false });
  api.getDceExtraction.mockResolvedValue({ extracted_count: 30, active: false, paused: false });
});

it("links pipeline stages to their dedicated pages and identifies planned operations", async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  const diagram = await screen.findByRole("navigation", { name: "Tender lifecycle pipeline" });
  const links = within(diagram);
  expect(links.getByRole("link", { name: /Collecte HTML/ })).toHaveAttribute("href", "/admin/scrape");
  expect(links.getByRole("link", { name: /Dossiers ZIP/ })).toHaveAttribute("href", "/admin/dce-cache");
  expect(links.getByRole("link", { name: /Fiches universelles/ })).toHaveAttribute("href", "/admin/dce-extraction");
  expect(links.getByRole("link", { name: /Video generation/ })).toHaveAttribute("href", "/admin/video-generation");
  expect(within(links.getAllByRole("list")[0]).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/admin/scrape", "/admin/dce-cache", "/admin/dce-extraction", "/admin/video-generation"]);
  expect(links.getByRole("link", { name: /Résultats/ })).toHaveAttribute("href", "/admin/awards");
  expect(links.getByRole("link", { name: /Campagnes/ })).toHaveAttribute("href", "/admin/campaigns");
  expect(links.getAllByText("Planned")).toHaveLength(3);
});

it("keeps available stage counts when another stage cannot be loaded", async () => {
  api.getDceExtraction.mockRejectedValue(new Error("Unavailable"));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  const diagram = await screen.findByRole("navigation", { name: "Tender lifecycle pipeline" });
  expect(await within(diagram).findByText("80")).toBeInTheDocument();
  expect(within(diagram).getByText("Status unavailable")).toBeInTheDocument();
});

it("replaces obsolete dashboard sections with the activity journal, without treatment cards", async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Activity journal" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /All activity/ })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Deletions & cleanups/ })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Audit trail/ })).toBeInTheDocument();
  for (const heading of ["System health", "Latest import", "Recent governance activity", "Failure & exception queues", "Pipelines", "Traitements"]) {
    expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
  }
  expect(screen.queryByText("Tenders (all)")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /All workflows/ })).not.toBeInTheDocument();
  expect(NAV_ITEMS.some((item) => item.path === "/admin/workflows")).toBe(false);
});
