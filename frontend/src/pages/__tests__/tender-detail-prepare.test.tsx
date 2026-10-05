import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TenderDetail from "../TenderDetail";
import { getTender } from "../../lib/api";
import type { TenderWithDetails } from "../../lib/types";

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "pro@example.com", name: "Pro", role: "user" },
  }),
}));

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getTender: vi.fn(),
    downloadDce: vi.fn(),
    downloadPdf: vi.fn(),
    getFavoriteIds: vi.fn().mockResolvedValue({ ids: [] }),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  };
});

const tender: TenderWithDetails = {
  id: "AO-1",
  reference: "AO-1",
  title: "Travaux de voirie",
  entity: "Commune de Rabat",
  entity_code: "",
  sector_code: "",
  sector_name: "Voirie",
  category: "Travaux",
  deadline: "2030-01-10",
  publication_date: "2026-08-01",
  status: "active",
  procedure_type: "Appel d'offres ouvert",
  location: "Rabat",
  detail_url: "",
  scraped_at: "2026-08-01T10:00:00Z",
  details: {
    objet: "Travaux de voirie",
    acheteur: "Commune de Rabat",
    annonce_type: "Avis d'appel d'offres",
    procedure: "Appel d'offres ouvert",
    categorie: "Travaux",
    allotissement: "",
    lieu_execution: "Rabat",
    estimation: "1 200 000,00 DH",
    domaines: "Voirie",
    adresse_retrait: "",
    adresse_depot: "",
    lieu_ouverture: "",
    caution_provisoire: "",
    qualifications: "",
    agrements: "",
    variante: "",
    reunion: "",
    visite_lieux: "",
    contact: "",
    documents_url: "",
    dce_url: "",
    avis_url: "",
    reserved_pme: "",
    prix_plans: "",
  },
};

describe("TenderDetail candidacy CTA", () => {
  it("links a signed-in user from the tender to the tender-scoped assistant", async () => {
    vi.mocked(getTender).mockResolvedValue(tender);

    render(
      <MemoryRouter initialEntries={["/tenders/AO-1"]}>
        <Routes>
          <Route path="/tenders/:id" element={<TenderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const cta = await screen.findByRole("link", { name: /préparer ma candidature/i });
    expect(cta).toHaveAttribute("href", "/assistant?tender=AO-1");
  });
});
