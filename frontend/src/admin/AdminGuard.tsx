import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "./permissions";
import { DeniedState } from "./components/StateBlock";
import { LoadingState } from "./components/StateBlock";

// Route-level protection: unauthenticated users go to /login (with return path);
// authenticated non-admins get a permission-aware denied screen rather than a
// redirect, so they understand why they can't proceed.
export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-ivory)]">
        <LoadingState label="Checking access" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.status === "suspended") {
    return (
      <div className="min-h-screen bg-[var(--color-ivory)]">
        <DeniedState message="Your account is suspended. Contact an owner to regain access." />
      </div>
    );
  }

  if (!isAdminRole(user.role)) {
    return (
      <div className="min-h-screen bg-[var(--color-ivory)]">
        <DeniedState message="This area is restricted to administrators." />
      </div>
    );
  }

  return <>{children}</>;
}
