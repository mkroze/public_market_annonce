import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  Gavel,
  Layers3,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";

const HERO_LINKS = [
  {
    to: "/procedures",
    icon: Scale,
    title: "Cadre réglementaire fiable",
    description: "Procédures, seuils, délais et commissions issus du décret n° 2.22.431.",
  },
  {
    to: "/eligibility",
    icon: ShieldCheck,
    title: "Éligibilité vérifiée",
    description: "Contrôlez les exclusions avant d'engager du temps sur un dossier.",
  },
  {
    to: "/recours",
    icon: Gavel,
    title: "Délais de recours maîtrisés",
    description: "Situez les fenêtres de réclamation et de saisine CNCP.",
  },
] as const;

const STEPS = [
  {
    icon: Search,
    title: "Choisir une consultation",
    description: "Repérez un appel d'offres, ouvrez sa fiche et gardez le règlement à portée de main.",
  },
  {
    icon: FileSearch,
    title: "Lire les exigences",
    description: "Identifiez les pièces, garanties, délais et contraintes de la procédure.",
  },
  {
    icon: ClipboardCheck,
    title: "Préparer le dossier",
    description: "Transformez l'analyse en plan de préparation clair, priorisé et vérifiable.",
  },
] as const;

function PartsMap() {
  return (
    <div
      className="relative mx-auto aspect-[1.08] w-full max-w-[22rem] overflow-hidden rounded-[2rem] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-border-subtle)_42%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--color-border-subtle)_42%,transparent)_1px,transparent_1px)] bg-[length:5.25rem_5.25rem]"
      aria-hidden="true"
    >
      <div className="absolute inset-6 opacity-70 [background-image:radial-gradient(circle,color-mix(in_srgb,var(--color-muted-light)_42%,transparent)_1.8px,transparent_2px)] [background-size:4.4rem_4.4rem]" />

      <div className="absolute left-[8%] top-[24%] h-[28%] w-[62%] rounded-[2rem] bg-[var(--color-surface-muted)]" />
      <div className="absolute left-[28%] top-[13%] h-[11%] w-[42%] rounded-[1.35rem] bg-[var(--color-primary)]" />
      <div className="absolute left-[47%] top-[54%] h-[10%] w-[21%] rounded-[1.3rem] bg-[var(--color-warning)]" />
      <div className="absolute right-[9%] top-[40%] h-[14%] w-[28%] rounded-[1.35rem] bg-[var(--color-primary-soft)]" />

      <div className="absolute left-[34%] top-[5%] h-[18%] w-[11%] rounded-[1.25rem] bg-[var(--color-primary)]" />
      <div className="absolute left-[44%] top-[13%] h-[10%] w-[18%] rounded-[1.25rem] bg-[var(--color-primary)]" />
      <div className="absolute left-[25%] top-[13%] h-[10%] w-[13%] rounded-[1.25rem] bg-[var(--color-warning)]" />
      <div className="absolute left-[35%] top-[22%] h-[18%] w-[10%] rounded-[1.2rem] bg-[var(--color-primary)]" />
      <div className="absolute right-[16%] top-[4%] h-[14%] w-[11%] rounded-[1.25rem] bg-[var(--color-primary)]" />
      <div className="absolute right-[3%] top-[7%] h-[24%] w-[11%] rounded-[1.3rem] bg-[var(--color-surface-muted)]" />

      <div className="absolute bottom-[11%] right-[22%] h-[26%] w-[20%] rounded-[1.7rem] bg-[var(--color-surface-muted)]" />
      <div className="absolute bottom-[8%] right-[34%] h-[11%] w-[10%] rounded-[1rem] bg-[var(--color-surface-muted)]" />
      <div className="absolute bottom-[26%] right-[35%] h-[9%] w-[10%] rounded-[1rem] bg-[var(--color-warning)]" />
      <div className="absolute bottom-[21%] right-[25%] h-[9%] w-[11%] rounded-[1rem] bg-[var(--color-warning)]" />

      <div className="absolute bottom-[35%] right-[2%] h-[11%] w-[14%] rounded-[1rem] bg-[var(--color-surface-muted)]" />
      <div className="absolute bottom-[25%] right-[13%] h-[12%] w-[9%] rounded-[1rem] bg-[var(--color-primary-soft)]" />
      <div className="absolute bottom-[45%] right-[0%] h-[11%] w-[9%] rounded-[1rem] bg-[var(--color-primary-soft)]" />
      <div className="absolute bottom-[40%] right-[9%] h-[11%] w-[18%] rounded-[1.1rem] bg-[var(--color-primary-soft)]" />

      <div className="absolute bottom-[7%] right-[19%] h-[24%] w-[25%] rounded-[1.8rem] border border-[var(--color-border-subtle)] bg-transparent" />
      <div className="absolute bottom-[7%] right-[33%] h-[24%] w-px bg-[var(--color-border-subtle)]" />
      <div className="absolute bottom-[19%] right-[19%] h-px w-[25%] bg-[var(--color-border-subtle)]" />

      <div className="absolute left-[10%] top-[8%] h-[45%] w-[38%] rounded-[1.25rem] border border-[var(--color-border-subtle)] bg-transparent opacity-70" />
      <div className="absolute left-[10%] top-[21%] h-px w-[38%] bg-[var(--color-border-subtle)]" />
      <div className="absolute left-[27%] top-[8%] h-[45%] w-px bg-[var(--color-border-subtle)]" />
    </div>
  );
}

export default function Guide() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      <section
        id="parcours"
        className="mx-auto overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card"
        aria-labelledby="guide-hero-title"
      >
        <div className="flex min-h-[calc(100svh-6.5rem)] flex-col">
          <div className="grid min-h-0 flex-1 items-center gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-8">
            <div className="max-w-[46rem]">
              <h1
                id="guide-hero-title"
                className="text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
              >
                Découvrez la voie simple pour{" "}
                <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                  préparer
                </span>{" "}
                vos{" "}
                <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                  marchés publics.
                </span>
              </h1>

              <p className="mt-5 max-w-[39rem] text-base leading-7 text-[var(--color-muted)]">
                Repérez la bonne consultation, vérifiez le cadre juridique et avancez vers un dossier clair,
                conforme et prêt à déposer.
              </p>
            </div>

            <div className="relative hidden min-h-0 items-center justify-center lg:flex">
              <div className="absolute left-[3%] top-[28%] rotate-[18deg] rounded-[1rem] bg-[var(--color-primary-soft)] p-2 text-[var(--color-primary)] shadow-card float-soft">
                <Layers3 size={40} aria-hidden="true" />
              </div>
              <PartsMap />
            </div>
          </div>

          <div
            id="outils"
            className="grid border-t border-[var(--color-border-subtle)] md:grid-cols-[minmax(15rem,0.75fr)_repeat(3,minmax(0,1fr))]"
          >
            <div className="flex items-center px-5 py-5 sm:px-8">
              <Link to="/tenders" className="btn btn-primary min-h-12 w-full max-w-52 justify-center rounded-full normal-case no-underline">
                Démarrer
              </Link>
            </div>

            {HERO_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-[6.5rem] gap-4 border-t border-[var(--color-border-subtle)] px-5 py-5 no-underline transition-colors  hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none md:border-l md:border-t-0 sm:px-8"
              >
                <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-accent/80 ">
                  <item.icon size={22} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.02em] text-[var(--color-ink)]">
                    {item.title}
                    <ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      

      <p className="mx-auto max-w-5xl border-t border-[var(--color-border-subtle)] py-5 text-xs leading-6 text-[var(--color-muted-light)]">
        Guide informatif fondé sur le décret n° 2.22.431 du 8 mars 2023. Le règlement de consultation et
        les textes applicables au lancement de la procédure font foi.
      </p>
    </div>
  );
}
