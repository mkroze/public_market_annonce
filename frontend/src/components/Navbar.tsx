import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, LogIn, LogOut, Menu, Scale, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "../admin/permissions";
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
    { to: "/stats", label: "Statistiques", icon: BarChart3, public: true },
    { to: "/guide", label: "Préparer", icon: Scale, public: true },
    { to: "/alerts", label: "Alertes", icon: Bell, public: false },
  ].filter((link) => link.public || user);

  const isAdmin = isAdminRole(user?.role);
  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <header className="sticky top-0 z-50 bg-transparent px-3 py-3 sm:px-6">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <Link to="/" className="flex h-11 min-w-0 items-center no-underline" aria-label="Marchés Publics Maroc">
          <img src={logoFull} alt="" className="h-5 w-auto max-w-[9rem] shrink sm:h-6 sm:max-w-[12rem]" aria-hidden="true" />
        </Link>

        {/* Floating glass "dock" — a white-tinted frosted pill (slightly visible),
            with blue tab labels; icons are white and shift to yellow on the active
            tab, which is marked by a soft white fill (flat, no elevation). */}
        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-1 rounded-full border border-white/15 bg-primary/10 p-1.5 shadow-[0_20px_44px_-26px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl md:flex"
        >
          {navLinks.map((link) => {
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? "page" : undefined}
                className={`group inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-[var(--color-neutral)] no-underline transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${
                  active
                    ? "bg-white/30"
                    : "hover:bg-white/15"
                }`}
                title={link.label}
              >
                <link.icon size={17} aria-hidden="true" className={active ? "text-[var(--color-warning)]" : "text-primary/80"} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <div className="dropdown dropdown-end hidden md:block">
              <button
                type="button"
                tabIndex={0}
                className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-card transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
                aria-label="Mon compte"
              >
                <UserRound size={18} aria-hidden="true" />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-50 mt-2 w-60 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2 shadow-pop"
              >
                <li className="px-3 py-2 text-xs text-[var(--color-muted)] pointer-events-none truncate">{user.email}</li>
                <li><Link to="/member/overview"><UserRound size={14} />Espace membre</Link></li>
                <li><Link to="/member/account"><Settings size={14} />Profil</Link></li>
                {isAdmin && <li><Link to="/admin"><ShieldCheck size={14} />Admin</Link></li>}
                <li><button type="button" onClick={handleLogout}><LogOut size={14} />Déconnexion</button></li>
              </ul>
            </div>
          ) : (
            <Link to="/login" className="hidden h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] no-underline shadow-[0_14px_34px_-24px_rgba(0,35,111,0.8)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] md:inline-flex motion-reduce:transition-none">
              <LogIn size={16} className="text-[var(--color-warning)]" aria-hidden="true" />
              Se connecter
            </Link>
          )}

          <div className="dropdown dropdown-end md:hidden">
            <button tabIndex={0} type="button" className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card" aria-label="Menu">
              <Menu size={18} aria-hidden="true" />
            </button>
            <ul tabIndex={0} className="dropdown-content menu z-50 mt-2 w-60 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2 shadow-pop">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={isActive(link.to) ? "font-semibold text-[var(--color-primary)]" : ""}>
                    <link.icon size={14} />
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="my-1 border-t border-[var(--color-border-subtle)]" aria-hidden="true"></li>
              {user ? (
                <>
                  <li><Link to="/member/overview"><UserRound size={14} />Espace membre</Link></li>
                  <li><Link to="/member/account"><Settings size={14} />Profil</Link></li>
                  {isAdmin && <li><Link to="/admin"><ShieldCheck size={14} />Admin</Link></li>}
                  <li><button type="button" onClick={handleLogout}><LogOut size={14} />Déconnexion</button></li>
                </>
              ) : (
                <li><Link to="/login"><LogIn size={14} />Se connecter</Link></li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
