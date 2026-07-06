import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Building2, Layers, TrendingUp, ArrowRight } from "lucide-react";
import { getOverview, triggerScrape } from "../lib/api";
import type { OverviewResponse } from "../lib/types";

export default function Overview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleScrape() {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await triggerScrape();
      setScrapeResult(`${res.total_found} consultations trouvees, ${res.total_new} nouvelles`);
    } catch {
      setScrapeResult("Erreur lors du scraping");
    } finally {
      setScraping(false);
    }
  }

  const categories = ["Travaux", "Fournitures", "Services"];
  const categoryIcons: Record<string, typeof Building2> = {
    Travaux: Building2,
    Fournitures: Layers,
    Services: TrendingUp,
  };
  const categoryColors: Record<string, string> = {
    Travaux: "bg-[var(--color-crimson)]",
    Fournitures: "bg-[var(--color-gold)]",
    Services: "bg-[var(--color-charcoal)]",
  };

  return (
    <div className="px-4 sm:px-6 py-10 space-y-10">
      {/* Hero */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[var(--color-charcoal)] leading-tight">
            Portail des Marches Publics
          </h1>
          <p className="text-[var(--color-slate)] mt-2 text-base font-sans max-w-xl">
            Consultations en cours sur marchespublics.gov.ma — Donnees actualisees quotidiennement.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm gap-2 font-sans font-semibold shrink-0"
          onClick={handleScrape}
          disabled={scraping}
        >
          <RefreshCw size={14} className={scraping ? "animate-spin" : ""} />
          {scraping ? "Import..." : "Importer"}
        </button>
      </div>

      {scrapeResult && (
        <div className="px-4 py-3 border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] text-sm font-sans text-[var(--color-charcoal)]">
          {scrapeResult}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
        </div>
      ) : data ? (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
            <div className="bg-base-100 px-6 py-5">
              <p className="label-academic">Total actif</p>
              <p className="text-3xl font-bold font-display text-[var(--color-crimson)] mt-1 tabular-nums">
                {data.total_active.toLocaleString("fr-FR")}
              </p>
            </div>
            {categories.map((cat) => {
              const count = data.sectors
                .filter((s) => s.category === cat)
                .reduce((sum, s) => sum + s.count, 0);
              const sectorCount = data.sectors.filter((s) => s.category === cat).length;
              return (
                <div key={cat} className="bg-base-100 px-6 py-5 border-l border-[var(--color-border-subtle)]">
                  <p className="label-academic">{cat}</p>
                  <p className="text-2xl font-bold font-sans text-[var(--color-charcoal)] mt-1 tabular-nums">
                    {count.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-xs text-[var(--color-slate)] mt-0.5 font-sans">{sectorCount} secteurs</p>
                </div>
              );
            })}
          </div>

          {/* Sector cards by category */}
          {categories.map((cat) => {
            const sectors = data.sectors.filter((s) => s.category === cat);
            if (sectors.length === 0) return null;
            const Icon = categoryIcons[cat] || Layers;
            return (
              <section key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${categoryColors[cat]}`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)]">{cat}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectors
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <Link
                        key={s.sector_code}
                        to={`/tenders?sector=${s.sector_code}&category=${cat}`}
                        className="flex items-center justify-between px-4 py-3 border border-[var(--color-border-subtle)] rounded hover:border-[var(--color-border)] transition-colors group"
                      >
                        <span className="text-sm font-sans text-[var(--color-charcoal)] group-hover:text-[var(--color-crimson)] transition-colors">
                          {s.sector_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold font-sans tabular-nums text-[var(--color-crimson)]">
                            {s.count}
                          </span>
                          <ArrowRight size={14} className="text-[var(--color-border)] group-hover:text-[var(--color-crimson)] transition-colors" />
                        </div>
                      </Link>
                    ))}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        <div className="border border-[var(--color-border-subtle)] rounded px-6 py-8 text-center">
          <p className="font-display text-lg text-[var(--color-charcoal)]">Aucune donnee disponible</p>
          <p className="text-sm text-[var(--color-slate)] mt-1 font-sans">
            Cliquez sur "Importer" pour lancer la collecte des donnees.
          </p>
        </div>
      )}
    </div>
  );
}
