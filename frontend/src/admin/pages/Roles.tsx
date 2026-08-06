import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getRoles, ApiError } from "../api";
import type { RoleInfo } from "../types";
import { PageHeader, Panel } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";

export default function Roles() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [allPerms, setAllPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  function load() {
    setLoading(true);
    getRoles()
      .then((res) => { setRoles(res.roles); setAllPerms(res.all_permissions); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading roles" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Roles are defined in code and enforced server-side. This matrix is read-only."
      />

      <Panel className="overflow-x-auto">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
              <th scope="col" className="px-4 py-2 font-medium sticky left-0 bg-base-100">Permission</th>
              {roles.map((r) => (
                <th key={r.name} scope="col" className="px-3 py-2 font-medium text-center capitalize">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPerms.map((perm) => (
              <tr key={perm} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <th scope="row" className="px-4 py-2 font-mono text-xs text-[var(--color-charcoal)] text-left sticky left-0 bg-base-100">{perm}</th>
                {roles.map((r) => (
                  <td key={r.name} className="px-3 py-2 text-center">
                    {r.permissions.includes(perm) ? (
                      <Check className="w-4 h-4 text-green-700 inline" aria-label="granted" />
                    ) : (
                      <span className="text-[var(--color-slate)]" aria-label="not granted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {roles.map((r) => (
          <Panel key={r.name} title={r.name.charAt(0).toUpperCase() + r.name.slice(1)}>
            <p className="px-4 py-3 text-sm font-sans text-[var(--color-slate)]">{r.description}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
