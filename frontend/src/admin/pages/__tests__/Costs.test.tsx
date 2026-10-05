import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Costs from "../Costs";

const mocks = vi.hoisted(() => ({
  getCostSummary: vi.fn(),
  getCosts: vi.fn(),
  createCost: vi.fn(),
  updateCost: vi.fn(),
  markCostPaid: vi.fn(),
  archiveCost: vi.fn(),
  role: "admin",
}));

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@x.com", role: mocks.role },
  }),
}));

vi.mock("../../api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getCostSummary: mocks.getCostSummary,
  getCosts: mocks.getCosts,
  createCost: mocks.createCost,
  updateCost: mocks.updateCost,
  markCostPaid: mocks.markCostPaid,
  archiveCost: mocks.archiveCost,
}));

function seedApi() {
  mocks.getCostSummary.mockResolvedValue({
    current_month: { USD: 4320, MAD: 19000 },
    upcoming_unpaid: { USD: 4320 },
    overdue: {},
    annualized_recurring: { MAD: 228000 },
    largest_current_month_category: {
      USD: { currency: "USD", category: "ai_api", amount_minor: 4320 },
    },
  });
  mocks.getCosts.mockResolvedValue({
    total: 1,
    page: 1,
    per_page: 25,
    pages: 1,
    data: [{
      id: 1,
      provider: "OpenAI",
      category: "ai_api",
      description: "Assistant usage",
      amount_minor: 4320,
      currency: "USD",
      billing_cycle: "usage_based",
      service_period_start: "2026-09-01",
      service_period_end: "2026-09-30",
      due_date: "2026-10-05",
      paid_date: null,
      status: "due",
      reference: "OPENAI-2026-09",
      notes: "",
      created_at: "2026-09-13 10:00:00",
      updated_at: "2026-09-13 10:00:00",
      created_by: "admin@x.com",
      updated_by: "admin@x.com",
      archived_at: null,
    }],
  });
}

function renderCosts() {
  return render(
    <MemoryRouter>
      <Costs />
    </MemoryRouter>,
  );
}

describe("Costs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = "admin";
    seedApi();
  });

  it("renders summaries and cost rows", async () => {
    renderCosts();
    expect(await screen.findByRole("heading", { name: "Costs" })).toBeInTheDocument();
    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Assistant usage")).toBeInTheDocument();
    expect(screen.getAllByText("43,20 USD").length).toBeGreaterThan(0);
  });

  it("opens the add cost form for managers", async () => {
    const user = userEvent.setup();
    renderCosts();
    await screen.findByText("OpenAI");
    await user.click(screen.getByRole("button", { name: /add cost/i }));
    expect(screen.getByRole("dialog", { name: /add cost/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
  });

  it("keeps partial and invalid amount text in the form field", async () => {
    const user = userEvent.setup();
    renderCosts();
    await screen.findByText("OpenAI");
    await user.click(screen.getByRole("button", { name: /add cost/i }));
    await user.type(screen.getByLabelText("Provider"), "OpenAI");

    const amount = screen.getByLabelText("Amount");
    await user.type(amount, "1.");
    expect(amount).toHaveValue("1.");

    await user.clear(amount);
    await user.type(amount, "abc");
    expect(amount).toHaveValue("abc");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("confirms before archiving a cost", async () => {
    const user = userEvent.setup();
    renderCosts();
    await screen.findByText("OpenAI");

    await user.click(screen.getByRole("button", { name: /archive openai/i }));

    expect(mocks.archiveCost).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: /archive cost/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    expect(mocks.archiveCost).toHaveBeenCalledWith(1);
  });

  it("keeps mutation controls disabled for auditors", async () => {
    mocks.role = "auditor";
    renderCosts();
    await screen.findByText("OpenAI");
    expect(screen.getByRole("button", { name: /add cost/i })).toBeDisabled();
  });
});
