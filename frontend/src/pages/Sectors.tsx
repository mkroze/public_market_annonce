import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Building2, Package, Briefcase } from "lucide-react";
import { getSectors } from "../lib/api";
import type { SectorCategory } from "../lib/types";

const categoryIcons: Record<string, typeof Building2> = {
  Travaux: Building2,
  Fournitures: Package,
  Services: Briefcase,
};

function categoryBadgeClass(category: string) {
  if (category === "Travaux") return "bg-[var(--color-crimson)] text-white";
  if (category === "Fournitures") return "bg-[var(--color-gold)] text-white";
  return "bg-[var(--color-charcoal)] text-white";
}

export default function Sectors() {
  const [categories, setCategories] = useState<SectorCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getSectors()
      .then((res) => {
        setCategories(res.categories);
        const initial: Record<string, boolean> = {};
        res.categories.forEach((c) => (initial[c.name] = true));
        setOpen(initial);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(name: string) {
    setOpen((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Secteurs</h1>
        <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
          Consultations par secteur d'activite
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : categories.length === 0 ? (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Aucun secteur trouve.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.name] || Briefcase;
            const isOpen = open[cat.name] ?? false;
            return (
              <div key={cat.name} className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
                <div
                  className="flex items-center justify-between p-5 cursor-pointer select-none"
                  onClick={() => toggle(cat.name)}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-[var(--color-crimson)]" />
                    <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">{cat.name}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded font-sans text-xs font-bold tabular-nums ${categoryBadgeClass(cat.name)}`}>
                      {cat.total}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={18} className="text-[var(--color-slate)]" />
                  ) : (
                    <ChevronRight size={18} className="text-[var(--color-slate)]" />
                  )}
                </div>
                {isOpen && (
                  <div className="px-5 pb-5">
                    <div className="divider-academic mb-3"></div>
                    <div className="space-y-2">
                      {cat.sectors
                        .sort((a, b) => b.count - a.count)
                        .map((s) => (
                          <Link
                            key={s.sector_code}
                            to={`/sectors/${encodeURIComponent(s.sector_code)}`}
                            className="flex items-center justify-between p-3 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] bg-[var(--color-ivory-dim)] transition-colors"
                          >
                            <span className="font-sans text-sm text-[var(--color-charcoal)]">{s.sector_name}</span>
                            <span className="tabular-nums font-sans text-sm font-bold text-[var(--color-crimson)]">{s.count}</span>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
