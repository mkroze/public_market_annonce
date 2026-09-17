import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Tenders from "../Tenders";
import { getTenders } from "../../lib/api";
import type { Tender } from "../../lib/types";

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getTenders: vi.fn(),
    getFilters: vi.fn().mockResolvedValue({
      categories: [
        { code: "travaux", name: "Travaux" },
        { code: "fournitures", name: "Fournitures" },
        { code: "services", name: "Services" },
      ],
      sectors: [
        { code: "45000000", name: "Construction" },
        { code: "72000000", name: "Services IT" },
      ],
      entities: ["Commune de Rabat"],
      locations: ["Rabat"],
      regions: ["Rabat-Salé-Kénitra"],
      statuses: ["en_cours", "cloture"],
      procedure_types: ["AOO", "AMI"],
    }),
    getFavoriteIds: vi.fn().mockResolvedValue({ ids: [] }),
    exportTenders: vi.fn(),
    createSavedSearch: vi.fn(),
  };
});

const tenders: Tender[] = [
  {
    id: "AO-001",
    reference: "AO-001",
    title: "Travaux de réhabilitation du centre culturel",
    entity: "Commune de Rabat",
    entity_code: "RBT",
    sector_code: "45000000",
    sector_name: "Construction",
    category: "Travaux",
    deadline: "2026-10-18",
    publication_date: "2026-09-01",
    status: "en_cours",
    procedure_type: "AOO",
    location: "Rabat",
    detail_url: "",
    scraped_at: "2026-09-15",
    estimation: "1 200 000 MAD",
  },
];

function renderCatalog(path = "/tenders") {
  vi.mocked(getTenders).mockResolvedValue({
    total: 145,
    page: 1,
    per_page: 20,
    pages: 8,
    data: tenders,
  });

  window.history.pushState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Tenders />
    </MemoryRouter>,
  );
}

describe("catalog UI from smooth catalog reference", () => {
  it("uses a white catalog layout with category rail, filter sidebar, chips, and sort", async () => {
    renderCatalog();

    expect(await screen.findByRole("heading", { name: /145 consultations trouvées/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /fil d'ariane/i })).not.toBeInTheDocument();

    const categories = screen.getByRole("navigation", { name: /types de marchés/i });
    expect(within(categories).getByRole("button", { name: /filtrer par travaux/i })).toBeInTheDocument();
    expect(within(categories).getByRole("button", { name: /filtrer par fournitures/i })).toBeInTheDocument();

    expect(screen.getByRole("complementary", { name: /filtres du catalogue/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /trier par/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /statut en cours/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /travaux de réhabilitation/i })).toBeInTheDocument();
  });

  it("applies category filtering from the top catalog strip", async () => {
    renderCatalog();

    fireEvent.click(await screen.findByRole("button", { name: /filtrer par travaux/i }));

    await waitFor(() => {
      expect(vi.mocked(getTenders)).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "Travaux", page: 1 }),
      );
    });
  });
});
