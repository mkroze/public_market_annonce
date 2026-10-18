import { STAGES } from "./stages/registry";

// Mirror of the backend RBAC matrix (backend/admin.py). Kept in sync manually.
// Used only to gate UI affordances; the backend is the source of truth and
// re-checks every request.

export type Permission =
  | "overview.view"
  | "tenders.view" | "tenders.moderate" | "tenders.export"
  | "imports.view" | "imports.run" | "imports.retry"
  | "audit.view" | "audit.export"
  | "users.view" | "users.suspend" | "users.manage_role" | "users.edit_profile"
  | "roles.view"
  | "settings.view" | "settings.manage"
  | "costs.view" | "costs.manage";

export const ADMIN_ROLES = ["owner", "admin", "operator", "auditor", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const ALL: Permission[] = [
  "overview.view",
  "tenders.view", "tenders.moderate", "tenders.export",
  "imports.view", "imports.run", "imports.retry",
  "audit.view", "audit.export",
  "users.view", "users.suspend", "users.manage_role", "users.edit_profile",
  "roles.view",
  "settings.view", "settings.manage",
  "costs.view", "costs.manage",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Set<Permission>> = {
  owner: new Set(ALL),
  admin: new Set<Permission>([
    "overview.view",
    "tenders.view", "tenders.moderate", "tenders.export",
    "imports.view", "imports.run", "imports.retry",
    "audit.view", "audit.export",
    "users.view", "users.edit_profile", "roles.view",
    "costs.view", "costs.manage",
  ]),
  operator: new Set<Permission>([
    "overview.view",
    "tenders.view", "tenders.moderate",
    "imports.view", "imports.run", "imports.retry",
    "audit.view",
  ]),
  auditor: new Set<Permission>([
    "overview.view",
    "tenders.view",
    "imports.view",
    "audit.view", "audit.export",
    "users.view", "roles.view",
    "costs.view",
  ]),
  support: new Set<Permission>([
    "overview.view",
    "tenders.view", "tenders.moderate",
    "imports.view",
    "audit.view",
  ]),
};

export const ASSIGNABLE_LABEL: Record<string, string> = {
  user: "no admin access",
  support: "limited tender review + diagnostics",
  auditor: "read-only + audit/cost export",
  operator: "imports + record moderation",
  admin: "tenders, imports, exports, costs",
  owner: "full control",
};

export function isAdminRole(role: string | undefined | null): role is AdminRole {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function can(role: string | undefined | null, perm: Permission): boolean {
  if (!isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(perm);
}

export interface NavItem {
  label: string;
  path: string;
  icon: string; // lucide icon name, resolved in AdminLayout
  permission: Permission;
  group?: string; // optional sidebar section heading
  disabled?: boolean;
  disabledReason?: string;
}

// Sidebar, in lifecycle order. The six lifecycle entries are generated from the
// stage registry so the nav cannot drift from the routes or the dashboard
// diagram. Cron jobs, Tenders, Audit logs, Roles and Integrations are no longer
// nav entries: the first three were folded into the stage or journal that owns
// their subject, Roles became a panel on Users, and Integrations was an empty
// placeholder. AdminApp still redirects their old paths.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "LayoutDashboard", permission: "overview.view" },
  { label: "Workflows", path: "/admin/workflows", icon: "Workflow", permission: "imports.view" },

  ...STAGES.map((stage): NavItem => ({
    label: `${String(stage.step).padStart(2, "0")} · ${stage.title}`,
    path: `/admin/${stage.slug}`,
    icon: stage.icon,
    permission: "imports.view",
    group: "Tender lifecycle",
  })),

  { label: "Users", path: "/admin/users", icon: "Users", permission: "users.view", group: "Administration" },
  { label: "Costs", path: "/admin/costs", icon: "Receipt", permission: "costs.view", group: "Administration" },
  { label: "Settings", path: "/admin/settings", icon: "Settings", permission: "settings.view", group: "Administration" },
];
