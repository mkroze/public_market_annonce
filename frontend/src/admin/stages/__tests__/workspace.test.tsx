import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import AdminApp from "../../AdminApp";
import userEvent from "@testing-library/user-event";

const auth = vi.hoisted(() => ({ role: "owner" }));
const api = vi.hoisted(() => ({
  getWorkflows: vi.fn(), getOverview: vi.fn(), getImports: vi.fn(),
  getDceCache: vi.fn(), getDceExtraction: vi.fn(), getCron: vi.fn(),
  getWorkflowEvents: vi.fn(), getAdminTenders: vi.fn(),
  runImport: vi.fn(), cleanupExpired: vi.fn(), clearDceCache: vi.fn(),
}));
vi.mock("../../api", async (original) => ({ ...await original<object>(), ...api }));
vi.mock("../../../lib/auth", () => ({ useAuth: () => ({ user: { role: auth.role, email: "owner@example.com" }, logout: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = "owner";
  api.getWorkflows.mockResolvedValue({ data: [] });
  api.getOverview.mockResolvedValue({ freshness: { tender_count: 120, active_tender_count: 90, detail_count: 100 }, failure_queues: { stale_records: 12 } });
  api.getImports.mockResolvedValue({ active: false, paused: false, progress: null, data: [] });
  api.getDceCache.mockResolvedValue({ active: false, paused: false, cached_total: 42, cached_bytes: 1024, data: [] });
  api.getDceExtraction.mockResolvedValue({ active: false, paused: false, simulate_enabled: true, extracted_count: 3, simulated_count: 0, recent: [], data: [] });
  api.getCron.mockResolvedValue({ data: [] });
  api.getWorkflowEvents.mockResolvedValue({ data: [], page: 1, pages: 1, total: 0 });
  api.getAdminTenders.mockResolvedValue({ data: [], page: 1, pages: 1, total: 0 });
});

function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminApp />} /></Routes></MemoryRouter>);
}

it.each(["scrape", "dce-cache", "dce-extraction", "video-generation", "awards", "campaigns"])("keeps every pane visible on %s", async (slug) => {
  open(`/admin/${slug}`);
  for (const name of ["Indicateurs", "Commandes", "Flux en direct", "Planification", "Données de l’étape"]) {
    expect(await screen.findByRole("region", { name })).toBeInTheDocument();
  }
});

it("shows real tender counts and keeps the unavailable step 5 transfer visible", async () => {
  open("/admin/scrape");
  const metrics = within(await screen.findByRole("region", { name: "Indicateurs" }));
  expect(await metrics.findByText("120")).toBeInTheDocument();
  expect(metrics.getByText("12")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Transférer les expirés/ })).toBeDisabled();
});

it("keeps idle steering controls visible and disables the unconfigured n8n endpoint", async () => {
  open("/admin/dce-extraction");
  expect(await screen.findByRole("button", { name: "Lancer une exécution" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
  expect(screen.getAllByText(/Endpoint n8n non configuré/).length).toBeGreaterThan(0);
});

it("shows only schedules owned by the selected step", async () => {
  const job = { enabled: false, schedule_kind: "daily", hour: 6, interval_minutes: 60, running: false };
  api.getCron.mockResolvedValue({ data: [
    { ...job, job: "scrape_digest", label: "Collecte quotidienne" },
    { ...job, job: "dce_cache", label: "Téléchargement ZIP" },
  ] });
  open("/admin/scrape");
  const schedules = within(await screen.findByRole("region", { name: "Planification" }));
  expect(await schedules.findByText("Collecte quotidienne")).toBeInTheDocument();
  expect(schedules.queryByText("Téléchargement ZIP")).not.toBeInTheDocument();
});

it("keeps action buttons visible but disabled when the backend cannot be reached", async () => {
  api.getImports.mockRejectedValue(new Error("Backend indisponible"));
  open("/admin/scrape");
  expect(await screen.findByRole("button", { name: "Lancer une exécution" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
  expect((await screen.findAllByText(/Backend indisponible/)).length).toBeGreaterThan(0);
});

it("cannot bypass the unavailable n8n endpoint from the scheduler", async () => {
  api.getCron.mockResolvedValue({ data: [{ job: "dce_extraction", label: "Extraction n8n", enabled: false, schedule_kind: "daily", hour: 6, interval_minutes: 60, running: false }] });
  open("/admin/dce-extraction/schedules");
  expect(await screen.findByRole("button", { name: "Exécuter" })).toBeDisabled();
  expect(screen.getByRole("checkbox")).toBeDisabled();
});

it("refreshes the adjacent feed after an administrator confirms a run", async () => {
  const user = userEvent.setup();
  api.runImport.mockImplementation(async () => {
    api.getWorkflowEvents.mockResolvedValue({ data: [{ id: "run-1", action: "Collecte démarrée", status: "running", origin: "manual", at: "2026-10-19T10:00:00Z", details: {} }], pages: 1, total: 1 });
    return { status: "started" };
  });
  open("/admin/scrape");
  const run = await screen.findByRole("button", { name: "Lancer une exécution" });
  await vi.waitFor(() => expect(run).toBeEnabled());
  await user.click(run);
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Run import" }));
  expect(api.runImport).toHaveBeenCalledOnce();
  expect(await within(screen.getByRole("region", { name: "Flux en direct" })).findByText("Collecte démarrée")).toBeInTheDocument();
});

it("refreshes scheduler runtime state while retaining unsaved settings", async () => {
  const job = { job: "scrape_digest", label: "Collecte quotidienne", enabled: true, schedule_kind: "daily", hour: 6, interval_minutes: 60, running: true };
  api.getCron.mockResolvedValue({ data: [job] });
  open("/admin/scrape/schedules");
  const kind = await screen.findByRole("combobox", { name: /Schedule kind/ });
  fireEvent.change(kind, { target: { value: "interval" } });
  expect(screen.getByRole("button", { name: "Exécuter" })).toBeDisabled();
  api.getCron.mockResolvedValue({ data: [{ ...job, running: false, last_status: "ok" }] });
  await vi.waitFor(() => expect(screen.getByRole("button", { name: "Exécuter" })).toBeEnabled(), { timeout: 6000, interval: 100 });
  expect(kind).toHaveValue("interval");
  expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
}, 8000);

it.each(["scrape", "dce-cache", "dce-extraction", "video-generation", "awards", "campaigns"])("offers the same control actions on %s", async (slug) => {
  open(`/admin/${slug}`);
  const commands = within(await screen.findByRole("region", { name: "Commandes" }));
  for (const name of ["Lancer une exécution", "Pause", "Annuler", "Relancer les erreurs", "Retraiter les données", "Actualiser l’état", "Nettoyer les expirés", "Supprimer les données", "Exporter les résultats"]) {
    expect(commands.getByRole("button", { name })).toBeInTheDocument();
  }
  expect(commands.getByRole("button", { name: "Exporter les résultats" })).toBeDisabled();
  if (slug !== "dce-cache") expect(commands.getByRole("button", { name: "Supprimer les données" })).toBeDisabled();
});

it("requires typed confirmation before archiving expired tenders", async () => {
  const user = userEvent.setup();
  api.cleanupExpired.mockResolvedValue({ archived: 12 });
  open("/admin/scrape");
  const commands = within(await screen.findByRole("region", { name: "Commandes" }));
  const cleanup = commands.getByRole("button", { name: "Nettoyer les expirés" });
  await vi.waitFor(() => expect(cleanup).toBeEnabled());
  await user.click(cleanup);
  const dialog = within(screen.getByRole("alertdialog"));
  expect(api.cleanupExpired).not.toHaveBeenCalled();
  expect(dialog.getByRole("button", { name: "Archiver les expirés" })).toBeDisabled();
  await user.type(dialog.getByRole("textbox"), "ARCHIVE EXPIRED");
  await user.click(dialog.getByRole("button", { name: "Archiver les expirés" }));
  expect(api.cleanupExpired).toHaveBeenCalledExactlyOnceWith(false);
});

it("confirms deletion of ZIP data and preserves the other stages", async () => {
  const user = userEvent.setup();
  api.clearDceCache.mockResolvedValue({ removed: 42, freed_bytes: 1024 });
  open("/admin/dce-cache");
  const button = within(await screen.findByRole("region", { name: "Commandes" })).getByRole("button", { name: "Supprimer les données" });
  await vi.waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(api.clearDceCache).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear all" }));
  expect(api.clearDceCache).toHaveBeenCalledExactlyOnceWith("all");
  expect(api.cleanupExpired).not.toHaveBeenCalled();
});

it.each(["support", "auditor"])("gates expired cleanup independently of run permissions for %s", async (role) => {
  auth.role = role;
  open("/admin/scrape");
  const commands = within(await screen.findByRole("region", { name: "Commandes" }));
  await vi.waitFor(() => expect(api.getImports).toHaveResolved());
  expect(commands.getByRole("button", { name: "Lancer une exécution" })).toBeDisabled();
  const cleanup = commands.getByRole("button", { name: "Nettoyer les expirés" });
  if (role === "support") await vi.waitFor(() => expect(cleanup).toBeEnabled());
  else expect(cleanup).toBeDisabled();
});
