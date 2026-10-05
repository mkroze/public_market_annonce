import { render, screen, waitFor } from "@testing-library/react";
import App from "../../App";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getTender: vi.fn(),
    getTenders: vi.fn().mockResolvedValue({ total: 0, page: 1, per_page: 20, pages: 0, data: [] }),
    getFavoriteIds: vi.fn().mockResolvedValue({ ids: [] }),
    createSavedSearch: vi.fn(),
  };
});

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  localStorage.clear();
  return render(<App />);
}

describe("legal candidacy routes", () => {
  it("shows the preparation nav link", async () => {
    renderAt("/tenders");

    const links = await screen.findAllByRole("link", { name: /préparer/i });
    expect(links.some((link) => link.getAttribute("href") === "/guide")).toBe(true);
  });

  it("keeps static legal guidance public", async () => {
    renderAt("/procedures");

    expect(await screen.findByRole("heading", { name: /procédures de passation/i })).toBeInTheDocument();
  });

  it("redirects signed-out users away from the assistant", async () => {
    renderAt("/assistant");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/login");
    });
  });
});
