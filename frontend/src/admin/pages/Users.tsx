import { useCallback, useEffect, useState } from "react";
import { ShieldX, ShieldCheck } from "lucide-react";
import { getUsers, setUserStatus, setUserRole, ApiError } from "../api";
import type { AdminUser } from "../types";
import { useAuth } from "../../lib/auth";
import { can, ASSIGNABLE_LABEL } from "../permissions";
import { PageHeader, Panel, fmtDate } from "../components/ui";
import { LoadingState, FailedState, DeniedState, EmptyState } from "../components/StateBlock";
import { UserStatusBadge, RoleBadge } from "../components/StatusBadge";
import ConfirmDialog, { type ConfirmConfig } from "../components/ConfirmDialog";
import ToastContainer from "../../components/Toast";
import { useToasts } from "../components/useToasts";

const ROLES = ["user", "support", "auditor", "operator", "admin", "owner"];

export default function Users() {
  const { user } = useAuth();
  const { toasts, push, dismiss } = useToasts();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const canManageRole = can(user?.role, "users.manage_role");
  const canSuspend = can(user?.role, "users.suspend");

  const load = useCallback(() => {
    setLoading(true);
    const p: Record<string, string> = {};
    if (roleFilter) p.role = roleFilter;
    if (statusFilter) p.status = statusFilter;
    if (q) p.q = q;
    getUsers(p)
      .then((res) => { setUsers(res.data); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [roleFilter, statusFilter, q]);

  useEffect(() => { load(); }, [load]);

  async function doSetStatus(u: AdminUser, status: string) {
    try {
      await setUserStatus(u.id, status);
      push(`${u.email} ${status === "suspended" ? "suspended" : "reactivated"}`, "success");
      load();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Action failed", "error");
    }
  }

  async function doSetRole(u: AdminUser, role: string) {
    try {
      await setUserRole(u.id, role);
      push(`${u.email} is now ${role}`, "success");
      load();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Role change failed", "error");
    }
  }

  function confirmSuspend(u: AdminUser) {
    const suspending = u.status !== "suspended";
    setConfirm({
      title: suspending ? "Suspend user" : "Reactivate user",
      action: suspending ? "Suspend user" : "Reactivate user",
      target: u.email,
      consequence: suspending
        ? "The user loses access immediately. Their data is retained and access can be restored."
        : "The user regains access with their existing role.",
      reversible: true,
      confirmLabel: suspending ? "Suspend user" : "Reactivate user",
      danger: suspending,
      onConfirm: () => doSetStatus(u, suspending ? "suspended" : "active"),
    });
  }

  function confirmRole(u: AdminUser, role: string) {
    if (role === u.role) return;
    const grantingOwner = role === "owner";
    setConfirm({
      title: "Assign role",
      action: `Change role to ${role}`,
      target: u.email,
      consequence: grantingOwner
        ? "Owner has full control, including managing roles, users, and high-risk operations."
        : `Grants the ${role} permission set (${ASSIGNABLE_LABEL[role] ?? role}).`,
      reversible: true,
      confirmLabel: `Assign ${role}`,
      danger: grantingOwner,
      typedConfirmation: grantingOwner ? "GRANT OWNER" : undefined,
      onConfirm: () => doSetRole(u, role),
    });
  }

  const inputCls = "input input-bordered input-sm font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

  return (
    <div>
      <PageHeader title="Admin users" description="Manage roles and account access. Suspension is preferred over deletion." />

      <div className="flex flex-wrap gap-2 mb-4">
        <input aria-label="Search users" placeholder="Search email, name, company" className={`${inputCls} w-64`}
          defaultValue={q} onKeyDown={(e) => { if (e.key === "Enter") setQ((e.target as HTMLInputElement).value); }} />
        <select aria-label="Role filter" className={`select select-bordered select-sm ${inputCls}`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Any role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Status filter" className={`select select-bordered select-sm ${inputCls}`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <Panel>
        {loading ? (
          <LoadingState label="Loading users" />
        ) : error?.status === 403 ? (
          <DeniedState message={error.message} />
        ) : error ? (
          <FailedState message={error.message} onRetry={load} />
        ) : users.length === 0 ? (
          <EmptyState title="No users match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-4 py-2 font-medium">User</th>
                  <th scope="col" className="px-4 py-2 font-medium">Role</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">MFA</th>
                  <th scope="col" className="px-4 py-2 font-medium">Last login</th>
                  <th scope="col" className="px-4 py-2 font-medium">Created</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                      <td className="px-4 py-2">
                        <div className="text-[var(--color-charcoal)] font-medium">{u.email}{isSelf && <span className="text-xs text-[var(--color-slate)]"> (you)</span>}</div>
                        <div className="text-xs text-[var(--color-slate)]">{u.name || "—"}{u.company ? ` · ${u.company}` : ""}</div>
                      </td>
                      <td className="px-4 py-2">
                        {canManageRole && !isSelf ? (
                          <select
                            aria-label={`Role for ${u.email}`}
                            value={u.role}
                            onChange={(e) => confirmRole(u, e.target.value)}
                            className="select select-bordered select-xs font-sans bg-base-100 border-[var(--color-border-subtle)] rounded"
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span title={isSelf ? "You cannot change your own role" : !canManageRole ? "Requires users.manage_role permission" : undefined}>
                            <RoleBadge role={u.role} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2"><UserStatusBadge status={u.status} /></td>
                      <td className="px-4 py-2 text-[var(--color-slate)]">{u.mfa_enabled ? "On" : "Off"}</td>
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap">{fmtDate(u.last_login)}</td>
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap">{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => confirmSuspend(u)}
                          disabled={!canSuspend || isSelf}
                          title={isSelf ? "You cannot change your own status" : !canSuspend ? "Requires users.suspend permission" : undefined}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.status === "suspended"
                            ? <><ShieldCheck className="w-3.5 h-3.5" aria-hidden /> Reactivate</>
                            : <><ShieldX className="w-3.5 h-3.5" aria-hidden /> Suspend</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
