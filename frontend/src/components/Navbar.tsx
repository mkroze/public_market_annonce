import { Link, useLocation } from "react-router-dom";
import { Menu, Sun, Moon, LogIn, LogOut, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import logoFull from "../assets/logo-full.svg";

// Liens éditoriaux : à gauche du bandeau, en petites capitales espacées.
const navLinks = [
  { to: "/tenders", label: "Catalogue" },
  { to: "/about", label: "À propos" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

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

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const linkClass = (path: string) =>
    `editorial-label transition-colors ${
      isActive(path)
        ? "text-[var(--color-charcoal)]"
        : "text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-ivory)] border-b border-[var(--color-border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Left — primary nav (desktop) / hamburger (mobile) */}
        <div className="flex items-center gap-5 md:gap-7 min-w-0">
          {/* Mobile menu */}
          <div className="dropdown md:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square" aria-label="Menu">
              <Menu size={18} />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-56 p-1.5 mt-2 shadow-sm z-50"
            >
              {navLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkClass(l.to)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass(l.to)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center — wordmark */}
        <Link
          to="/tenders"
          className="justify-self-center text-center leading-none"
          aria-label="Marchés Publics Maroc — accueil"
        >
          <img
            src={logoFull}
            alt="Marches Publics Maroc"
            className="h-10 w-auto max-w-[190px] shrink-0"
          />
        </Link>

        {/* Right — actions */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0">
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
                className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors cursor-pointer"
              >
                <User size={13} className="text-[var(--color-slate)]" />
                <span className="editorial-label text-[var(--color-charcoal)] hidden sm:inline">
                  {user.name}
                </span>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-[var(--color-ivory)] border border-[var(--color-border-subtle)] rounded w-52 p-1.5 mt-2 shadow-sm z-50"
              >
                <li className="px-3 py-1.5 text-xs text-[var(--color-slate)] font-sans">{user.email}</li>
                <div className="divider-academic my-1"></div>
                <li>
                  <button onClick={logout} className="editorial-label text-[var(--color-accent)]">
                    <LogOut size={14} /> Déconnexion
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 border border-[var(--color-charcoal)] bg-[var(--color-charcoal)] text-[var(--color-ivory)] px-2.5 sm:px-3.5 py-1.5 editorial-label hover:bg-transparent hover:text-[var(--color-charcoal)] transition-colors"
              aria-label="Se connecter"
              title="Se connecter"
            >
              <LogIn size={13} />
              <span className="hidden sm:inline">Compte</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
