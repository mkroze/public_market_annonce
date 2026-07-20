import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Layers, RefreshCw, Search, TrendingUp } from "lucide-react";
import TenderCard from "../components/TenderCard";
import { getOverview, getTenders, triggerScrape } from "../lib/api";
import { buildGuidedTenderQuery, type GuidedTenderInput } from "../lib/tenderGuidance";
import type { OverviewResponse, Tender } from "../lib/types";

export default function Overview() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [previewTenders, setPreviewTenders] = useState<Tender[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [guidedInput, setGuidedInput] = useState<GuidedTenderInput>({
    activity: "",
    location: "",
    deadlineWindow: "any",
    budgetRange: "any",
  });

  const guidedQuery = useMemo(() => buildGuidedTenderQuery(guidedInput), [guidedInput]);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getTenders({ status: "en_cours", sort: "deadline", order: "asc", page: 1, per_page: 6 })
      .then((res) => {
        setPreviewTenders(res.data.slice(0, 6));
        setPreviewError("");
      })
      .catch(() => setPreviewError("Impossible de charger les consultations actives."));
  }, []);

  function startGuidedSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(guidedQuery).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        params.set(key, String(value));
      }
    });
    params.set("view", "guided");
    navigate(`/tenders?${params.toString()}`);
  }

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
      {/* Guided discovery hero */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="label-academic mb-2">Je decouvre les marches publics</p>
          <h1 className="font-display text-3xl font-bold leading-tight text-[var(--color-charcoal)] sm:text-4xl">
            Trouvez des consultations publiques que vous pouvez comprendre et verifier.
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-base text-[var(--color-slate)]">
            Commencez avec quelques questions simples. L'application vous montre ensuite les opportunites actives et les points a verifier avant de preparer une candidature.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/tenders?status=en_cours&view=guided" className="btn btn-primary gap-2 font-sans font-semibold">
              <Search size={16} /> Voir les opportunites
            </Link>
            <Link to="/guide" className="btn btn-outline gap-2 font-sans font-semibold">
              Comprendre les etapes
            </Link>
          </div>
        </div>

        <form onSubmit={startGuidedSearch} className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Recherche guidee</h2>
          <div className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="label-academic text-xs">Que vendez-vous ?</span>
              <input className="input input-bordered w-full" value={guidedInput.activity} onChange={(event) => setGuidedInput((current) => ({ ...current, activity: event.target.value }))} placeholder="Ex: nettoyage, travaux, fournitures..." />
            </label>
            <label className="block space-y-1">
              <span className="label-academic text-xs">Ou pouvez-vous intervenir ?</span>
              <input className="input input-bordered w-full" value={guidedInput.location} onChange={(event) => setGuidedInput((current) => ({ ...current, location: event.target.value }))} placeholder="Ville ou region" />
            </label>
            <label className="block space-y-1">
              <span className="label-academic text-xs">Delai de reponse</span>
              <select className="select select-bordered w-full" value={guidedInput.deadlineWindow} onChange={(event) => setGuidedInput((current) => ({ ...current, deadlineWindow: event.target.value as GuidedTenderInput["deadlineWindow"] }))}>
                <option value="any">Tous les delais</option>
                <option value="7d">Cette semaine</option>
                <option value="14d">Deux semaines</option>
                <option value="30d">Un mois</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary w-full gap-2 font-sans font-semibold">
              Chercher <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primary btn-sm gap-2 font-sans font-semibold shrink-0"
          onClick={handleScrape}
          disabled={scraping}
        >
          <RefreshCw size={14} className={scraping ? "animate-spin" : ""} />
          {scraping ? "Import..." : "Importer"}
        </button>
        {scrapeResult && (
          <div className="flex-1 px-4 py-2 border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] text-sm font-sans text-[var(--color-charcoal)]">
            {scrapeResult}
          </div>
        )}
      </div>

      {/* Active tender preview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)]">Opportunites actives a verifier</h2>
            <p className="font-sans text-sm text-[var(--color-slate)]">Un premier apercu pour comprendre ce qui est disponible maintenant.</p>
          </div>
          <Link to="/tenders?status=en_cours&view=guided" className="hidden font-sans text-sm font-semibold text-[var(--color-crimson)] hover:underline sm:inline">
            Voir tout
          </Link>
        </div>
        {previewError ? (
          <div className="rounded border border-[var(--color-crimson)] border-l-4 px-4 py-3 font-sans text-sm text-[var(--color-charcoal)]">{previewError}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {previewTenders.map((tender) => <TenderCard key={tender.id} tender={tender} compact />)}
          </div>
        )}
      </section>

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
