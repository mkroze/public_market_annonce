import { Link, useLocation } from "react-router-dom";
import { Search, Menu, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import logoFull from "../assets/logo-full.svg";

export default function Navbar() {
  const { pathname } = useLocation();

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

  const navLinks = [
    { to: "/tenders", label: "Toutes les consultations", icon: Search },
  ];

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-ivory)] border-b border-[var(--color-border-subtle)]">
      {/* Top bar — brand + auth */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/tenders" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <img
            src={logoFull}
            alt="Marches Publics Maroc"
            className="h-10 w-auto max-w-[190px] shrink-0"
          />
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
      <nav className="hidden md:block border-t border-[var(--color-border-subtle)] bg-[var(--color-ivory)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {navLinks.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`
                    flex shrink-0 items-center gap-1.5 px-3 xl:px-4 py-2.5 text-sm font-sans font-medium
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
          </div>
        </div>
      </nav>
    </header>
  );
}
