import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Settings from "../Settings";

const api = vi.hoisted(() => ({ getEmailSettings: vi.fn(), updateEmailSettings: vi.fn(), testEmailSettings: vi.fn() }));
vi.mock("../../api", async (original) => ({ ...await original<object>(), ...api }));
vi.mock("../../../lib/auth", () => ({ useAuth: () => ({ user: { role: "owner" } }) }));
const settings = { configured: true, password_set: true, smtp_host: "smtp.example.com", smtp_port: "587", smtp_user: "login", smtp_from: "alerts@example.com", smtp_from_name: "Marchés Publics" };
beforeEach(() => {
  vi.clearAllMocks();
  api.getEmailSettings.mockResolvedValue(settings);
  api.updateEmailSettings.mockResolvedValue(settings);
  api.testEmailSettings.mockResolvedValue({ to: "owner@example.com" });
});
it("sends a test email without saving the form", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  await user.click(await screen.findByRole("button", { name: "Envoyer un test" }));
  expect(api.testEmailSettings).toHaveBeenCalledOnce();
  expect(api.updateEmailSettings).not.toHaveBeenCalled();
});
it("saves SMTP edits without sending an unchanged password", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  const host = await screen.findByLabelText("Hôte SMTP");
  await user.clear(host);
  await user.type(host, "smtp.updated.com");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(api.updateEmailSettings).toHaveBeenCalledWith(expect.objectContaining({ smtp_host: "smtp.updated.com" }));
  expect(api.updateEmailSettings.mock.calls[0][0]).not.toHaveProperty("smtp_password");
});
