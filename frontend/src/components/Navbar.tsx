import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, BarChart3 } from "lucide-react";

export default function Navbar() {
  const { pathname } = useLocation();

  const links = [
    { to: "/", label: "Aperçu", icon: LayoutDashboard },
    { to: "/tenders", label: "Consultations", icon: Search },
    { to: "/stats", label: "Statistiques", icon: BarChart3 },
  ];

  return (
    <div className="navbar bg-base-200 px-4 shadow-sm">
      <div className="flex-1">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-primary">MP</span> Maroc
        </Link>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1 gap-1">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className={pathname === l.to ? "active" : ""}
              >
                <l.icon size={16} />
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
