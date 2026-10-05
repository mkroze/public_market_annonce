import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Eligibility from "../Eligibility";
import Recours from "../Recours";
import ProcedureDetail from "../ProcedureDetail";
import Guide from "../Guide";

describe("Eligibility", () => {
  it("marks the user non eligible when a liquidation exclusion applies", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Eligibility />
      </MemoryRouter>,
    );

    const question = screen.getByText(/êtes-vous en liquidation judiciaire/i);
    const row = question.parentElement?.parentElement;
    expect(row).toBeInstanceOf(HTMLElement);
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Oui" }));

    expect(screen.getByText(/non éligible/i)).toBeInTheDocument();
  });
});

describe("Recours", () => {
  it("calculates administrative and CNCP deadlines from the reference date", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Recours />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/date de publication du résultat/i), "2026-09-01");

    expect(screen.getByText(/réclamation au maître d'ouvrage/i)).toBeInTheDocument();
    expect(screen.getByText(/6 septembre 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/8 septembre 2026/i)).toBeInTheDocument();
  });
});

describe("ProcedureDetail", () => {
  it("shows an unknown procedure fallback", () => {
    render(
      <MemoryRouter initialEntries={["/procedures/inconnue"]}>
        <Routes>
          <Route path="/procedures/:slug" element={<ProcedureDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /procédure introuvable/i })).toBeInTheDocument();
  });
});

describe("Guide", () => {
  it("presents a concise preparation hub without the old calculator section", () => {
    render(
      <MemoryRouter>
        <Guide />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /préparer ma candidature/i })).toBeInTheDocument();
    expect(screen.queryByText(/calculateur/i)).not.toBeInTheDocument();
  });

  it("links to the reference tools and the assistant entry point", () => {
    render(
      <MemoryRouter>
        <Guide />
      </MemoryRouter>,
    );

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/procedures", "/eligibility", "/recours", "/tenders"]));
  });
});
