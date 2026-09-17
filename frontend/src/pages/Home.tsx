import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ClipboardCheck,
  FileSearch,
  Layers3,
  Map,
  MapPin,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import heroIllustration from "../assets/hero-illustration.png";

/** Highlight pill — the signature headline treatment (see new-hot-design.md §2.2). */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const QUICK_LINKS = [
  {
    to: "/tenders",
    icon: Search,
    title: "Consultations",
    description: "Parcourez les appels d'offres publics, filtrés et tenus à jour.",
  },
  {
    to: "/stats",
    icon: BarChart3,
    title: "Statistiques",
    description: "Visualisez la commande publique par secteur, ville et région.",
  },
  {
    to: "/guide",
    icon: Scale,
    title: "Préparer",
    description: "Cadre juridique, éligibilité et plan de candidature clair.",
  },
] as const;

const VALUE_PROPS = [
  {
    icon: Search,
    title: "Un catalogue clair",
    description: "Toutes les consultations réunies, filtrables par secteur, ville et échéance.",
  },
  {
    icon: Bell,
    title: "Des alertes ciblées",
    description: "Soyez prévenu dès qu'une consultation correspond à votre activité.",
  },
  {
    icon: ShieldCheck,
    title: "Une préparation guidée",
    description: "Vérifiez votre éligibilité et construisez un dossier conforme, sans zone d'ombre.",
  },
] as const;

const STEPS = [
  {
    icon: Search,
    title: "Repérer",
    description: "Trouvez la consultation pertinente et ouvrez sa fiche complète.",
  },
  {
    icon: FileSearch,
    title: "Analyser",
    description: "Lisez les exigences : pièces, garanties, délais et critères de sélection.",
  },
  {
    icon: ClipboardCheck,
    title: "Préparer",
    description: "Transformez l'analyse en un plan de candidature priorisé et vérifiable.",
  },
] as const;

const DIRECTORIES = [
  { to: "/stats", icon: BarChart3, label: "Statistiques" },
  { to: "/cities", icon: MapPin, label: "Villes" },
  { to: "/regions", icon: Map, label: "Régions" },
  { to: "/sectors", icon: Layers3, label: "Secteurs" },
] as const;

export default function Home() {
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className={`mx-auto ${FRAME}`} aria-labelledby="home-hero-title">
        <div className="flex min-h-[calc(100svh-6.5rem)] flex-col">
          <div className="grid min-h-0 flex-1 items-center gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-8">
            <div className="max-w-[46rem]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
                <Sparkles size={14} aria-hidden="true" />
                Veille des marchés publics · Maroc
              </div>

              <h1
                id="home-hero-title"
                className="text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
              >
                Toute la commande publique marocaine,{" "}
                <Pill>réunie</Pill> et <Pill>claire</Pill>.
              </h1>

              <p className="mt-5 max-w-[40rem] text-base leading-7 text-[var(--color-muted)]">
                Repérez les bonnes consultations, suivez-les par alerte et préparez des dossiers
                conformes — le tout réuni en un seul endroit lisible.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/tenders"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] no-underline shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none"
                >
                  Explorer les consultations
                  <ArrowUpRight size={17} className="text-[var(--color-warning)]" aria-hidden="true" />
                </Link>
                <Link
                  to={user ? "/member/overview" : "/register"}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-sm font-semibold text-[var(--color-ink)] no-underline transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none"
                >
                  {user ? "Mon espace" : "Créer un compte"}
                </Link>
              </div>
            </div>

            <div className="relative hidden min-h-0 items-center justify-center lg:flex">
              <img
                src={heroIllustration}
                alt=""
                aria-hidden="true"
                className="mx-auto w-full max-w-[24rem] select-none float-soft"
              />
            </div>
          </div>

          {/* Border-grid quick links (new-hot-design.md §3.2) */}
          <div className="grid divide-y divide-[var(--color-border-subtle)] border-t border-[var(--color-border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-[6.5rem] gap-4 px-5 py-5 no-underline transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none sm:px-6"
              >
                <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]">
                  <item.icon size={22} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">
                    {item.title}
                    <ArrowRight
                      size={17}
                      className="shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VALUE PROPS ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl py-12" aria-labelledby="home-why-title">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]">
          Pourquoi MP Maroc
        </p>
        <h2
          id="home-why-title"
          className="mt-2 max-w-2xl text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.15] text-[var(--color-ink)]"
        >
          Moins d'éparpillement, plus de <Pill>marchés gagnés</Pill>.
        </h2>

        <div className={`mt-7 grid divide-y divide-[var(--color-border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 ${FRAME}`}>
          {VALUE_PROPS.map((item) => (
            <div key={item.title} className="px-6 py-7">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                <item.icon size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl py-4" aria-labelledby="home-how-title">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]">
          Comment ça marche
        </p>
        <h2
          id="home-how-title"
          className="mt-2 max-w-2xl text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.15] text-[var(--color-ink)]"
        >
          Du repérage au dépôt, en <Pill>trois étapes</Pill>.
        </h2>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <article key={step.title} className={`p-6 ${FRAME}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-[var(--color-on-primary)]">
                  {index + 1}
                </span>
                <step.icon size={19} className="text-[var(--color-primary)]" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── DIRECTORIES ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl py-12" aria-labelledby="home-explore-title">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]">
          Explorer les données
        </p>
        <h2
          id="home-explore-title"
          className="mt-2 max-w-2xl text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.15] text-[var(--color-ink)]"
        >
          La commande publique, <Pill>par angle</Pill>.
        </h2>

        <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-border-subtle)] shadow-card lg:grid-cols-4">
          {DIRECTORIES.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-center gap-3 bg-[var(--color-surface)] px-6 py-6 no-underline transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                <item.icon size={19} aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">
                {item.label}
              </span>
              <ArrowRight
                size={17}
                className="text-[var(--color-muted-light)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
