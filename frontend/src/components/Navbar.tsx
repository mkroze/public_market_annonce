import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Search, BarChart3,
  CreditCard, BookOpen, Calculator, Scale, Bell, Heart, LogIn, LogOut, User, Menu,
  Sun, Moon, Sparkles, Handshake,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "academic-dark" : "academic");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const mainLinks = [
    { to: "/", label: "Apercu", icon: LayoutDashboard },
    { to: "/tenders", label: "Consultations", icon: Search },
    { to: "/stats", label: "Statistiques", icon: BarChart3 },
  ];

  const moreLinks = [
    { to: "/assistant", label: "Assistant", icon: Sparkles },
    { to: "/procedures", label: "Procedures", icon: Scale },
    { to: "/blog", label: "Blog", icon: BookOpen },
    { to: "/pricing", label: "Tarifs", icon: CreditCard },
    { to: "/calculator", label: "Calculateur", icon: Calculator },
    { to: "/partenaires", label: "Partenaires", icon: Handshake },
  ];

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-ivory)] border-b border-[var(--color-border-subtle)]">
      {/* Top bar — brand + auth */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--color-crimson)] flex items-center justify-center">
            <span className="text-white font-bold text-sm font-sans">MP</span>
          </div>
          <div>
            <span className="font-display text-lg font-bold text-[var(--color-charcoal)] tracking-tight">
              Marches Publics
            </span>
            <span className="hidden sm:inline text-xs text-[var(--color-slate)] ml-2 font-sans">
              Maroc
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark((d) => !d)}
            className="btn btn-ghost btn-sm btn-square"
            aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
            title={dark ? "Mode clair" : "Mode sombre"}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[var(--color-ivory-deep)] flex items-center justify-center">
                  <User size={13} className="text-[var(--color-slate)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-charcoal)] hidden sm:inline">
                  {user.name}
                </span>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-52 p-1.5 mt-2 shadow-sm z-50"
              >
                <li className="px-3 py-1.5 text-xs text-[var(--color-slate)]">
                  {user.email}
                </li>
                <div className="divider-academic my-1"></div>
                <li>
                  <Link to="/favorites" className="text-sm">
                    <Heart size={14} /> Mes favoris
                  </Link>
                </li>
                <li>
                  <Link to="/alerts" className="text-sm">
                    <Bell size={14} /> Mes alertes
                  </Link>
                </li>
                <div className="divider-academic my-1"></div>
                <li>
                  <button onClick={logout} className="text-sm text-[var(--color-crimson)]">
                    <LogOut size={14} /> Deconnexion
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary btn-sm font-sans font-semibold gap-1.5"
            >
              <LogIn size={14} />
              Commencer
            </Link>
          )}

          {/* Mobile menu */}
          <div className="dropdown dropdown-end lg:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square">
              <Menu size={18} />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-56 p-1.5 mt-2 shadow-sm z-50"
            >
              {[...mainLinks, ...moreLinks].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`text-sm ${isActive(l.to) ? "font-semibold text-[var(--color-crimson)]" : ""}`}
                  >
                    <l.icon size={14} />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom nav — main links */}
      <nav className="hidden lg:block border-t border-[var(--color-border-subtle)] bg-[var(--color-ivory)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-0">
          {mainLinks.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-sans font-medium
                  border-b-2 transition-colors duration-150
                  ${active
                    ? "border-[var(--color-crimson)] text-[var(--color-crimson)]"
                    : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                  }
                `}
              >
                <l.icon size={14} />
                {l.label}
              </Link>
            );
          })}

          <div className="ml-auto flex items-center">
            {moreLinks.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`
                    flex items-center gap-1.5 px-3 py-2.5 text-sm font-sans
                    border-b-2 transition-colors duration-150
                    ${active
                      ? "border-[var(--color-crimson)] text-[var(--color-crimson)] font-medium"
                      : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
                    }
                  `}
                >
                  <l.icon size={14} />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
