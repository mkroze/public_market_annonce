import { describe, expect, it } from "vitest";
import { NAV_ITEMS, can } from "../permissions";

describe("cost admin permissions", () => {
  it("grants costs view/manage to owner and admin only where specified", () => {
    expect(can("owner", "costs.view")).toBe(true);
    expect(can("owner", "costs.manage")).toBe(true);
    expect(can("admin", "costs.view")).toBe(true);
    expect(can("admin", "costs.manage")).toBe(true);
    expect(can("auditor", "costs.view")).toBe(true);
    expect(can("auditor", "costs.manage")).toBe(false);
    expect(can("operator", "costs.view")).toBe(false);
    expect(can("support", "costs.view")).toBe(false);
  });

  it("exposes a costs nav item guarded by costs.view", () => {
    expect(NAV_ITEMS).toContainEqual({
      label: "Costs",
      path: "/admin/costs",
      icon: "Receipt",
      permission: "costs.view",
    });
  });
});
