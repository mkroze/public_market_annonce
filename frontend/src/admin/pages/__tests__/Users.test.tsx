import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import Users from "../Users";

const api = vi.hoisted(() => ({ getUsers: vi.fn(), getRoles: vi.fn() }));
vi.mock("../../api", async (original) => ({ ...await original<object>(), ...api }));
vi.mock("../../../lib/auth", () => ({ useAuth: () => ({ user: { id: 1, role: "owner" } }) }));
beforeEach(() => {
  vi.clearAllMocks();
  api.getRoles.mockResolvedValue({ roles: [], all_permissions: [] });
  api.getUsers.mockResolvedValue({ data: [{ id: 1, email: "owner@example.com", name: "Owner", company: "", role: "owner", status: "active", mfa_enabled: 1, last_login: null, created_at: null }] });
});
it("submits a search from the controls pane and resets the filters", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><Users /></MemoryRouter>);
  await screen.findByText("owner@example.com");
  await user.type(screen.getByRole("textbox", { name: "Search users" }), "company");
  expect(api.getUsers).toHaveBeenLastCalledWith({});
  await user.click(screen.getByRole("button", { name: "Rechercher" }));
  expect(api.getUsers).toHaveBeenLastCalledWith({ q: "company" });
  await user.click(screen.getByRole("button", { name: "Réinitialiser" }));
  expect(api.getUsers).toHaveBeenLastCalledWith({});
  expect(screen.getByRole("textbox", { name: "Search users" })).toHaveValue("");
});
it("preserves the protection against suspending your own account", async () => {
  render(<MemoryRouter><Users /></MemoryRouter>);
  expect(await screen.findByRole("button", { name: "Suspend" })).toBeDisabled();
});
