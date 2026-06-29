import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, TrendingUp, Building2, Layers } from "lucide-react";
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
      setScrapeResult(`${res.total_found} consultations trouvées, ${res.total_new} nouvelles`);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portail des Marchés Publics</h1>
          <p className="text-base-content/60 mt-1">
            Consultations en cours sur marchespublics.gov.ma
          </p>
        </div>
        <button
          className={`btn btn-primary ${scraping ? "loading" : ""}`}
          onClick={handleScrape}
          disabled={scraping}
        >
          <RefreshCw size={16} className={scraping ? "animate-spin" : ""} />
          {scraping ? "Scraping..." : "Importer les données"}
        </button>
      </div>

      {scrapeResult && (
        <div className="alert alert-info">
          <span>{scrapeResult}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : data ? (
        <>
          <div className="stats shadow w-full">
            <div className="stat">
              <div className="stat-title">Consultations actives</div>
              <div className="stat-value text-primary">{data.total_active}</div>
              <div className="stat-desc">Tous secteurs confondus</div>
            </div>
            {categories.map((cat) => {
              const count = data.sectors
                .filter((s) => s.category === cat)
                .reduce((sum, s) => sum + s.count, 0);
              return (
                <div className="stat" key={cat}>
                  <div className="stat-title">{cat}</div>
                  <div className="stat-value">{count}</div>
                  <div className="stat-desc">
                    {data.sectors.filter((s) => s.category === cat).length} secteurs
                  </div>
                </div>
              );
            })}
          </div>

          {categories.map((cat) => {
            const sectors = data.sectors.filter((s) => s.category === cat);
            if (sectors.length === 0) return null;
            const Icon = categoryIcons[cat] || Layers;
            return (
              <div key={cat} className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title">
                    <Icon size={20} />
                    {cat}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {sectors
                      .sort((a, b) => b.count - a.count)
                      .map((s) => (
                        <Link
                          key={s.sector_code}
                          to={`/tenders?sector=${s.sector_code}&category=${cat}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
                        >
                          <span className="text-sm">{s.sector_name}</span>
                          <span className="badge badge-primary badge-sm">{s.count}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <div className="alert alert-warning">
          Impossible de charger les données. Cliquez sur "Importer les données" pour lancer le scraping.
        </div>
      )}
    </div>
  );
}
