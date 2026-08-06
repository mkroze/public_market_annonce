// Mirror of the backend RBAC matrix (backend/admin.py). Kept in sync manually.
// Used only to gate UI affordances; the backend is the source of truth and
// re-checks every request.

export type Permission =
  | "overview.view"
  | "tenders.view" | "tenders.moderate" | "tenders.export"
  | "imports.view" | "imports.run" | "imports.retry"
  | "audit.view" | "audit.export"
  | "users.view" | "users.suspend" | "users.manage_role"
  | "roles.view";

export const ADMIN_ROLES = ["owner", "admin", "operator", "auditor", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const ALL: Permission[] = [
  "overview.view",
  "tenders.view", "tenders.moderate", "tenders.export",
  "imports.view", "imports.run", "imports.retry",
  "audit.view", "audit.export",
  "users.view", "users.suspend", "users.manage_role",
  "roles.view",
];

export const ROLE_PERMISSIONS: Record<AdminRole, Set<Permission>> = {
  owner: new Set(ALL),
  admin: new Set<Permission>([
    "overview.view",
    "tenders.view", "tenders.moderate", "tenders.export",
    "imports.view", "imports.run", "imports.retry",
    "audit.view", "audit.export",
    "users.view", "roles.view",
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
  auditor: "read-only + audit export",
  operator: "imports + record moderation",
  admin: "tenders, imports, exports",
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
  disabled?: boolean;
  disabledReason?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "LayoutDashboard", permission: "overview.view" },
  { label: "Imports", path: "/admin/imports", icon: "DownloadCloud", permission: "imports.view" },
  { label: "Tenders", path: "/admin/tenders", icon: "Table2", permission: "tenders.view" },
  { label: "Audit logs", path: "/admin/audit-logs", icon: "ScrollText", permission: "audit.view" },
  { label: "Users", path: "/admin/users", icon: "Users", permission: "users.view" },
  { label: "Roles", path: "/admin/roles", icon: "ShieldCheck", permission: "roles.view" },
  { label: "Settings", path: "/admin/settings", icon: "Settings", permission: "overview.view", disabled: true, disabledReason: "Coming soon" },
  { label: "Integrations", path: "/admin/integrations", icon: "Plug", permission: "overview.view", disabled: true, disabledReason: "Coming soon" },
];
