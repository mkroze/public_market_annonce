import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import Footer from "../Footer";
import Navbar from "../Navbar";
import PageShell from "../PageShell";
import TenderCard from "../TenderCard";
import TenderTable from "../TenderTable";
import Login from "../../pages/Login";
import type { Tender } from "../../lib/types";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    login: vi.fn(),
  };
});

const tender: Tender = {
  id: "AO-001",
  reference: "AO-001",
  title: "Travaux de réhabilitation du centre culturel",
  entity: "Commune de Rabat",
  entity_code: "RBT",
  sector_code: "45000000",
  sector_name: "Travaux",
  category: "Travaux",
  deadline: "2026-10-18",
  publication_date: "2026-09-01",
  status: "open",
  procedure_type: "Appel d'offres ouvert",
  location: "Rabat",
  detail_url: "",
  scraped_at: "2026-09-15",
  estimation: "1 200 000 MAD",
  caution_provisoire: "20 000 MAD",
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("smooth UI component replacements", () => {
  it("uses blue and gold brand tokens instead of temporary black or pink accents", () => {
    const rendered = [
      renderWithRouter(<Navbar />).container,
      renderWithRouter(<Footer />).container,
      renderWithRouter(
        <PageShell title="Procédures" section="Guide" lead="Texte court">
          <p>Contenu utile</p>
        </PageShell>,
      ).container,
      renderWithRouter(<TenderCard tender={tender} />).container,
      renderWithRouter(<TenderTable tenders={[tender]} sort="deadline" order="desc" onSort={vi.fn()} />).container,
      renderWithRouter(<Login />).container,
    ]
      .map((container) => container.innerHTML)
      .join("\n");

    expect(rendered).toContain("var(--color-primary)");
    expect(rendered).toContain("var(--color-warning)");
    expect(rendered).not.toMatch(/#10141b|#4f7fb1|#f4c8d8/i);
  });

  it("uses a compact floating navbar with accessible icon links", () => {
    renderWithRouter(<Navbar />);

    const nav = screen.getByRole("navigation", { name: /navigation principale/i });
    expect(nav).toHaveClass("rounded-full");
    const consultationsLink = within(nav).getByRole("link", { name: /consultations/i });
    expect(consultationsLink).toHaveAttribute("href", "/tenders");
    expect(nav.className).toMatch(/primary/);
    expect(nav.innerHTML).toContain("var(--color-warning)");
  });

  it("removes breadcrumb chrome from PageShell", () => {
    renderWithRouter(
      <PageShell title="Procédures" section="Guide" lead="Texte court">
        <p>Contenu utile</p>
      </PageShell>,
    );

    expect(screen.queryByRole("navigation", { name: /fil d'ariane/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Procédures" })).toBeInTheDocument();
  });

  it("turns the footer into a minimal action surface", () => {
    renderWithRouter(<Footer />);

    expect(screen.getByRole("link", { name: /suivre les consultations/i })).toHaveAttribute("href", "/tenders");
    expect(screen.queryByText(/informations fournies à titre indicatif/i)).not.toBeInTheDocument();
  });

  it("renders tender cards with less explanatory copy", () => {
    renderWithRouter(<TenderCard tender={tender} />);

    expect(screen.getByRole("heading", { name: /travaux de réhabilitation/i })).toBeInTheDocument();
    expect(screen.queryByText(/caution provisoire/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /travaux de réhabilitation/i })).toHaveAttribute("href", "/tenders/AO-001");
  });

  it("renders the tender table as a clean order-list style table", () => {
    renderWithRouter(
      <TenderTable tenders={[tender]} sort="deadline" order="desc" onSort={vi.fn()} />,
    );

    expect(screen.getByRole("columnheader", { name: /consultation/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /acheteur/i })).toBeInTheDocument();
    expect(screen.queryByText(/faites défiler/i)).not.toBeInTheDocument();
  });

  it("reduces the login page to a minimal split form", () => {
    renderWithRouter(<Login />);

    expect(screen.getByRole("heading", { name: /bon retour/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe$/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.queryByText(/une recherche intuitive/i)).not.toBeInTheDocument();
  });
});
