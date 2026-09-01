import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Menu, LogIn, LogOut, UserRound, Bell, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "../admin/permissions";
import MotionToggle from "./MotionToggle";
import logoFull from "../assets/logo-full.svg";

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navLinks = [
    { to: "/tenders", label: "Consultations", icon: Search, public: true },
    { to: "/alerts", label: "Alertes", icon: Bell, public: false },
  ].filter((link) => link.public || user);

  // Lien réservé : n'apparaît que pour un compte administrateur connecté.
  // Le rôle est re-vérifié côté backend à chaque requête ; ceci ne gate que l'UI.
  const isAdmin = isAdminRole(user?.role);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 border-b border-[color-mix(in_srgb,var(--color-border-subtle)_60%,transparent)] bg-[var(--color-surface)]/75 shadow-card backdrop-blur-xl">
      {/* Top bar — brand + auth */}
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Link to="/tenders" className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-2.5">
          <img
            src={logoFull}
            alt="Marchés Publics Maroc"
            className="h-5 w-auto max-w-[160px] min-w-0 shrink sm:h-6 sm:max-w-[210px]"
          />
        </Link>

        <nav className="ml-6 hidden flex-1 items-center gap-1 md:flex" aria-label="Navigation principale">
          {navLinks.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all motion-reduce:transition-none ${
                  active
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                <l.icon size={14} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MotionToggle className="hidden sm:inline-grid" />
          {/* Auth — desktop */}
          {user ? (
            <div className="dropdown dropdown-end hidden md:block">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm gap-1.5 normal-case font-sans"
                aria-label="Mon compte"
              >
                <UserRound size={16} />
                <span className="max-w-[10rem] truncate">{user.name || user.email}</span>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-56 p-1.5 mt-2 shadow-sm z-50"
              >
                <li className="px-2 py-1.5 text-xs text-[var(--color-slate)] font-sans truncate pointer-events-none">
                  {user.email}
                </li>
                <li>
                  <Link to="/alerts" className="text-sm">
                    <UserRound size={14} />
                    Espace membre
                  </Link>
                </li>
                {isAdmin && (
                  <li>
                    <Link to="/admin" className="text-sm font-semibold text-[var(--color-crimson)]">
                      <ShieldCheck size={14} />
                      Espace admin
                    </Link>
                  </li>
                )}
                <li>
                  <button type="button" onClick={handleLogout} className="text-sm">
                    <LogOut size={14} />
                    Se déconnecter
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link to="/login" className="hidden md:inline-flex btn btn-primary btn-sm gap-1.5 normal-case font-sans">
              <LogIn size={15} />
              Se connecter
            </Link>
          )}

          {/* Mobile menu */}
          <div className="dropdown dropdown-end md:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square">
              <Menu size={18} />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-56 p-1.5 mt-2 shadow-sm z-50"
            >
              {navLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`text-sm ${isActive(l.to) ? "font-semibold text-[var(--color-primary)]" : ""}`}
                  >
                    <l.icon size={14} />
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="my-1 border-t border-[var(--color-border-subtle)]" aria-hidden="true"></li>
              {user ? (
                <>
                  <li className="px-2 py-1 text-xs text-[var(--color-slate)] font-sans truncate pointer-events-none">
                    {user.email}
                  </li>
                  <li>
                    <Link to="/alerts" className="text-sm">
                      <UserRound size={14} />
                      Espace membre
                    </Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link to="/admin" className="text-sm font-semibold text-[var(--color-crimson)]">
                        <ShieldCheck size={14} />
                        Espace admin
                      </Link>
                    </li>
                  )}
                  <li>
                    <button type="button" onClick={handleLogout} className="text-sm">
                      <LogOut size={14} />
                      Se déconnecter
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    to="/login"
                    className={`text-sm ${isActive("/login") ? "font-semibold text-[var(--color-primary)]" : ""}`}
                  >
                    <LogIn size={14} />
                    Se connecter
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
