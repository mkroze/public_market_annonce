import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, X, ExternalLink, AlertTriangle, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { NAV_ITEMS, can } from "./permissions";
import { resolveIcon } from "./components/icons";
import "./admin.css";

const ENV = import.meta.env.MODE === "production" ? "production" : "development";

function NavList({ role, onNavigate }: { role: string | undefined; onNavigate?: () => void }) {
  let previousGroup: string | undefined;
  return <nav className="admin-sections" aria-label="Admin sections">
    {NAV_ITEMS.filter((item) => item.disabled || can(role, item.permission)).map((item) => {
      const Icon = resolveIcon(item.icon);
      const showGroup = item.group && item.group !== previousGroup;
      previousGroup = item.group;
      return <Fragment key={item.path}>
        {showGroup && <span className="admin-nav-group">{item.group === "Tender lifecycle" ? "Pipeline des marchés" : item.group}</span>}
        {item.disabled ? <span aria-disabled="true" title={item.disabledReason}><Icon size={15} aria-hidden />{item.label}</span>
        : <NavLink to={item.path} end={item.path === "/admin"} onClick={onNavigate} className={({ isActive }) => isActive ? "is-active" : ""}>
            <Icon size={15} aria-hidden /><span>{item.label}</span>
          </NavLink>}
      </Fragment>;
    })}
  </nav>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const toggle = navigationToggle.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; toggle?.focus(); };
  }, [mobileOpen]);
  const [animations, setAnimations] = useState(() => localStorage.getItem("admin.animations") !== "off");
  function toggleAnimations() {
    setAnimations((value) => { localStorage.setItem("admin.animations", value ? "off" : "on"); return !value; });
  }
  return <div className="admin-workbench" data-theme="academic" data-animations={animations ? "on" : "off"}>
    <div className="admin-ambient" aria-hidden />
    <div className="admin-frame">
    <aside className="admin-sidebar" aria-label="Navigation principale">
      <NavLink to="/admin" className="admin-brand"><span className="admin-brand-mark">MP</span><span>Marchés Publics<small>Centre des opérations</small></span></NavLink>
      <NavList role={user?.role} />
      <a className="admin-sidebar-public" href="/"><ExternalLink size={15} aria-hidden />Voir le site public</a>
      <div className="admin-sidebar-note"><span className="admin-sidebar-dot" />Votre poste de pilotage<small>Chaque étape, au même endroit.</small></div>
    </aside>
    <div className="admin-window">
      <header className="admin-topbar">
        <button ref={navigationToggle} className="admin-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Ouvrir la navigation" aria-expanded={mobileOpen}><Menu size={20} aria-hidden /></button>
        <NavLink to="/admin" className="admin-brand"><span className="admin-brand-mark">MP</span><span>Marchés Publics<small>Centre des opérations</small></span></NavLink>
        <span className="admin-workspace-label">Espace administrateur</span>
        <span className={`admin-env ${ENV === "production" ? "is-production" : ""}`} title={ENV === "production" ? "Les actions affectent les données de production" : "Environnement de développement"}>
          {ENV === "production" ? <AlertTriangle size={12} aria-hidden /> : <i aria-hidden />}{ENV === "production" ? "Production" : "Développement"}
        </span>
        <div className="admin-account">
          <button className="admin-icon-button" onClick={toggleAnimations} aria-pressed={!animations} aria-label={animations ? "Désactiver les animations" : "Activer les animations"} title={animations ? "Désactiver les animations" : "Activer les animations"}><Sparkles size={16} aria-hidden /></button>
          <a className="admin-icon-button" href="/" aria-label="Voir le site public" title="Voir le site public"><ExternalLink size={16} aria-hidden /></a>
          <span className="admin-avatar" aria-hidden>{user?.email?.slice(0, 1).toUpperCase() || "A"}</span>
          <div className="admin-identity"><strong>{user?.email}</strong><small>{user?.role}</small></div>
          <button className="admin-icon-button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} aria-hidden /></button>
        </div>
      </header>
      {mobileOpen && <div className="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation administrateur" onKeyDown={(e) => {
        if (e.key === "Escape") setMobileOpen(false);
        if (e.key === "Tab") {
          const focusable = e.currentTarget.querySelectorAll<HTMLElement>('aside a[href], aside button:not([disabled])');
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
        <button className="admin-drawer-backdrop" aria-label="Fermer la navigation" onClick={() => setMobileOpen(false)} />
        <aside><div className="admin-drawer-heading"><strong>Navigation</strong><button autoFocus onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={20} aria-hidden /></button></div><NavList role={user?.role} onNavigate={() => setMobileOpen(false)} /></aside>
      </div>}
      <main key={location.pathname} className="admin-main">{children}</main>
      <footer className="admin-footer"><span>Marchés Publics · Poste de pilotage</span><span>Collecter. Contrôler. Publier.</span></footer>
    </div>
    </div>
  </div>;
}
