import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../Home";
import type { Tender } from "../../lib/types";

const mocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  getTenders: vi.fn(),
  user: null as null | { id: number; email: string },
}));

vi.mock("../../lib/auth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/api", () => ({ getStats: mocks.getStats, getTenders: mocks.getTenders }));

function tender(id: string, title: string, category: string): Tender {
  return {
    id, title, category, reference: id, entity: `Acheteur ${id}`, entity_code: "", sector_code: "1.12",
    sector_name: "Voirie", deadline: "31/12/2099 10:00", publication_date: "", status: "en_cours",
    procedure_type: "AOO", location: "RABAT", detail_url: "", scraped_at: "",
  };
}

const STATS = {
  total: 300,
  by_category: [
    { category: "Fournitures", count: 160 },
    { category: "Travaux", count: 100 },
    { category: "Services", count: 40 },
  ],
  top_sectors: [{ sector_code: "1.12", sector_name: "Travaux de voiries", category: "Travaux", count: 25 }],
  top_entities: [],
  kpis: { active: 300, closing_7d: 12, new_7d: 45, distinct_buyers: 180 },
  by_procedure: [{ procedure_type: "AOO", count: 250 }],
};

function seedLive() {
  mocks.getStats.mockResolvedValue(STATS);
  mocks.getTenders.mockImplementation(({ category }: { category?: string }) => {
    const all = [tender("T1", "TRAVAUX DE VOIRIE", "Travaux"), tender("F1", "FOURNITURE DE MOBILIER", "Fournitures")];
    const data = category ? all.filter((t) => t.category === category) : all;
    return Promise.resolve({ total: category ? data.length : 300, page: 1, per_page: 4, pages: 1, data });
  });
}

function renderHome() {
  window.scrollTo = vi.fn();
  return render(<MemoryRouter><Home /></MemoryRouter>);
}

describe("Home landing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    localStorage.clear();
    delete document.documentElement.dataset.themePreference;
    seedLive();
  });

  it("leads visitors to sign-up with one consistent primary CTA", async () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/ne ratez plus aucun marché public fait pour vous/i);
    const primary = screen.getAllByRole("link", { name: /créer mon compte gratuit/i });
    expect(primary.length).toBeGreaterThanOrEqual(2); // hero + final CTA (+ mobile bar)
    primary.forEach((link) => expect(link).toHaveAttribute("href", "/register"));
    expect(screen.getAllByText("Sans carte bancaire").length).toBeGreaterThan(0);
    expect(await screen.findByLabelText("Chiffres en direct")).toBeInTheDocument();
  });

  it("plays the real product recording in the hero, with a poster fallback and a pause control", () => {
    const { container } = renderHome();
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("poster");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("loop");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("preload", "metadata");
    expect(screen.getByRole("button", { name: /lire la démonstration/i })).toBeInTheDocument();
    expect(screen.getByText(/enregistrement réel de l'application/i)).toBeInTheDocument();
  });

  it("swaps the video for its poster image if the file cannot be played", () => {
    const { container } = renderHome();
    fireEvent.error(container.querySelector("video")!);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("figure img")).toHaveAttribute("src");
  });

  it("tells the product story in five steps, each with a real screen", () => {
    renderHome();
    const story = screen.getByRole("region", { name: /tout commence par ce que vous cherchez/i });
    expect(within(story).getAllByRole("listitem")).toHaveLength(5);
    expect(within(story).getByRole("heading", { name: "Vérifiez votre éligibilité." })).toBeInTheDocument();
    expect(within(story).getAllByAltText(/formulaire de création d'alerte/i).length).toBeGreaterThan(0);
  });

  it("uses real consultations in the product demos", async () => {
    renderHome();
    const row = (await screen.findAllByRole("link", { name: /travaux de voirie/i }))[0];
    expect(row).toHaveAttribute("href", "/tenders/T1");
    expect(screen.getAllByText("En direct").length).toBeGreaterThan(0);
  });

  it("falls back to a clearly labelled illustrative preview when the API is down", async () => {
    mocks.getStats.mockRejectedValue(new Error("down"));
    mocks.getTenders.mockRejectedValue(new Error("down"));
    renderHome();
    expect((await screen.findAllByText("Aperçu illustratif")).length).toBeGreaterThan(0);
    expect(screen.queryByText("En direct")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chiffres en direct")).not.toBeInTheDocument();
    // Illustrative rows are never links to a (non-existent) consultation.
    expect(screen.queryByRole("link", { name: /voirie communale/i })).not.toBeInTheDocument();
  });

  it("switches between light and dark from the hero", async () => {
    renderHome();
    await userEvent.click(screen.getByRole("button", { name: "Passer au mode sombre" }));
    expect(document.documentElement.dataset.themePreference).toBe("dark");
    expect(localStorage.getItem("mp-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: "Passer au mode clair" }));
    expect(document.documentElement.dataset.themePreference).toBe("light");
  });

  it("keeps the official-source disclaimer visible", () => {
    renderHome();
    expect(screen.getByText(/ne remplace pas la vérification sur le portail officiel/i)).toBeInTheDocument();
  });

  it("sends signed-in users to their space instead of sign-up", () => {
    mocks.user = { id: 1, email: "a@b.c" };
    renderHome();
    expect(screen.queryByRole("link", { name: /créer mon compte gratuit/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /ouvrir mon espace/i })[0]).toHaveAttribute("href", "/member/overview");
    expect(screen.queryByText("Sans carte bancaire")).not.toBeInTheDocument();
  });
});
