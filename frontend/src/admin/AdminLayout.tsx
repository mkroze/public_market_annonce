import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DownloadCloud, Table2, ScrollText, Users, ShieldCheck,
  Settings, Plug, LogOut, Menu, X, ExternalLink,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { NAV_ITEMS, can, type NavItem } from "./permissions";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, DownloadCloud, Table2, ScrollText, Users, ShieldCheck, Settings, Plug,
};

const ENV = import.meta.env.MODE === "production" ? "production" : "development";

function NavList({ role, onNavigate }: { role: string | undefined; onNavigate?: () => void }) {
  const visible = NAV_ITEMS.filter((item) => item.disabled || can(role, item.permission));

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
      {visible.map((item) => (
        <NavEntry key={item.path} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;

  if (item.disabled) {
    return (
      <span
        className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-sans text-[var(--color-slate)] opacity-50 cursor-not-allowed"
        title={item.disabledReason}
        aria-disabled="true"
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] uppercase tracking-wide">{item.disabledReason}</span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === "/admin"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] ${
          isActive
            ? "bg-[var(--color-crimson)] text-white font-semibold"
            : "text-[var(--color-charcoal)] hover:bg-[var(--color-ivory-dim)]"
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen text-[var(--color-charcoal)] flex" data-theme="academic">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-ivory)] sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-[var(--color-border-subtle)]">
          <NavLink to="/admin" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-primary)] text-[11px] font-bold text-white">
              MP
            </span>
            <span className="font-display text-[15px] font-bold leading-tight text-[var(--color-charcoal)]">
              Marchés Publics
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                Espace admin
              </span>
            </span>
          </NavLink>
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          <NavList role={user?.role} />
        </div>
        <div className="p-3 border-t border-[var(--color-border-subtle)]">
          <a
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-sans text-[var(--color-slate)] hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]"
          >
            <ExternalLink className="w-4 h-4" aria-hidden /> Public site
          </a>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="relative w-64 bg-[var(--color-ivory)] border-r border-[var(--color-border-subtle)] flex flex-col">
            <div className="px-4 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-primary)] text-[10px] font-bold text-white">MP</span>
                <span className="font-display text-sm font-bold leading-tight">Marchés Publics<span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">Espace admin</span></span>
              </span>
              <button onClick={closeMobile} aria-label="Close navigation" className="p-1">
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              <NavList role={user?.role} onNavigate={closeMobile} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory)]/95 backdrop-blur">
          <button
            className="lg:hidden p-1.5 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" aria-hidden />
          </button>

          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-sans font-medium ${
              ENV === "production"
                ? "border-[var(--color-crimson)]/40 text-[var(--color-crimson)] bg-[var(--color-crimson)]/5"
                : "border-[var(--color-gold)]/40 text-[var(--color-gold)] bg-[var(--color-gold)]/5"
            }`}
            title="Current environment"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
            {ENV}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-sans font-medium text-[var(--color-charcoal)]">{user?.email}</div>
              <div className="text-xs font-sans text-[var(--color-slate)] uppercase tracking-wide">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden /> Log out
            </button>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
