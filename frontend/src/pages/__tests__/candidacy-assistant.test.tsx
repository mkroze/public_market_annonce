import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidacyAssistant from "../CandidacyAssistant";
import { getTender } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getTender: vi.fn(),
    askAssistant: vi.fn().mockResolvedValue({ answer: "Réponse juridique test" }),
  };
});

describe("CandidacyAssistant", () => {
  it("prefills tender procedure, prestation type, and estimate from the tender query", async () => {
    vi.mocked(getTender).mockResolvedValue({
      id: "AO-1",
      reference: "AO-1",
      title: "Travaux de voirie",
      entity: "Commune",
      entity_code: "",
      sector_code: "",
      sector_name: "",
      category: "Travaux",
      deadline: "",
      publication_date: "",
      status: "active",
      procedure_type: "Appel d'offres ouvert simplifié",
      location: "Rabat",
      detail_url: "",
      scraped_at: "",
      details: {
        objet: "Travaux de voirie",
        acheteur: "Commune",
        annonce_type: "",
        procedure: "Appel d'offres ouvert simplifié",
        categorie: "Travaux",
        allotissement: "",
        lieu_execution: "",
        estimation: "900 000,00 DH",
        domaines: "",
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
    });

    render(
      <MemoryRouter initialEntries={["/assistant?tender=AO-1"]}>
        <CandidacyAssistant />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("900000")).toBeInTheDocument();
    expect(screen.getByText(/AO-1/)).toBeInTheDocument();
  });

  it("shows an excessive price alert when the offer is more than 20 percent above estimate", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CandidacyAssistant />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/estimation du coût/i), "1000000");
    await user.type(screen.getByLabelText(/votre offre/i), "1250000");

    expect(screen.getByRole("alert", { name: /offre excessive/i })).toBeInTheDocument();
  });
});
