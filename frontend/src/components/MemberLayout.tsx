import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, BookmarkCheck, Home, LogOut, Search, Settings } from "lucide-react";
import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/member/overview", label: "Accueil", icon: Home },
  { to: "/member/consultations", label: "Mes consultations", icon: BookmarkCheck },
  { to: "/member/alerts", label: "Mes alertes", icon: Bell },
  { to: "/member/saved-searches", label: "Recherches enregistrées", icon: Search },
  { to: "/member/account", label: "Profil & préférences", icon: Settings },
];

function itemClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${
    isActive
      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
  }`;
}

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 px-4 py-6 lg:block">
        <div className="mb-6 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{user?.name || "Membre"}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)] truncate">{user?.email}</p>
          <p className="mt-3 inline-flex rounded-full bg-[var(--color-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
            Compte actif
          </p>
        </div>
        <nav className="space-y-1" aria-label="Navigation espace membre">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={itemClass}>
              <item.icon size={17} aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          <LogOut size={17} aria-hidden />
          Se déconnecter
        </button>
      </aside>

      <section className="min-w-0">
        <nav
          className="sticky top-16 z-30 flex gap-2 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 px-4 py-3 backdrop-blur lg:hidden"
          aria-label="Navigation espace membre"
        >
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={itemClass}>
              <item.icon size={16} aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
