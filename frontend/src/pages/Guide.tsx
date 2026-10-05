import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, Gavel, Scale, Search, ShieldCheck, Sparkles } from "lucide-react";
import PageShell from "../components/PageShell";
import { useAuth } from "../lib/auth";

// Étapes du parcours de préparation — le cœur du produit est la préparation
// d'une candidature à partir d'une consultation précise.
const STEPS = [
  {
    icon: Search,
    title: "Choisir une consultation",
    description: "Repérez un appel d'offres dans le catalogue et ouvrez sa fiche.",
  },
  {
    icon: Sparkles,
    title: "Ouvrir l'assistant",
    description: "L'assistant détecte la procédure, les seuils et les pièces attendues.",
  },
  {
    icon: ClipboardCheck,
    title: "Obtenir votre plan",
    description: "Un plan de préparation : risques, délais, pièces à réunir et prochaines actions.",
  },
] as const;

// Outils de référence — publics, sans IA, pour la découverte et l'approfondissement.
const REFERENCES = [
  {
    to: "/procedures",
    icon: Scale,
    title: "Procédures de passation",
    description: "Modes de passation, délais, commissions et pièces attendues par procédure.",
  },
  {
    to: "/eligibility",
    icon: ShieldCheck,
    title: "Vérifier l'éligibilité",
    description: "Contrôlez les conditions de soumission de l'article 27 avant de constituer le dossier.",
  },
  {
    to: "/recours",
    icon: Gavel,
    title: "Délais de recours",
    description: "Estimez les fenêtres de réclamation et de saisine CNCP à partir d'une date de référence.",
  },
] as const;

export default function Guide() {
  const { user } = useAuth();

  return (
    <PageShell
      title="Préparer ma candidature"
      section="Préparation"
      lead="Du repérage d'un appel d'offres à un dossier conforme : procédure, seuils, pièces, délais et un assistant juridique adossé au décret n° 2.22.431."
      width="wide"
      breadcrumbs={[{ label: "Préparer" }]}
    >
      <div className="space-y-10">
        {/* Point d'entrée principal — l'atelier de préparation d'une candidature. */}
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-primary-soft)] shadow-card">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                <Sparkles size={13} aria-hidden="true" />
                Atelier de candidature
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold leading-tight text-[var(--color-ink)]">
                Un parcours guidé, une consultation à la fois
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
                L'assistant reprend les paramètres du marché depuis la fiche de consultation et vous
                accompagne jusqu'à un plan de préparation actionnable.
              </p>

              <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--color-on-primary)]">
                        {index + 1}
                      </span>
                      <step.icon size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
                    </div>
                    <p className="mt-2.5 text-sm font-semibold text-[var(--color-ink)]">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex shrink-0 flex-col gap-2 lg:w-56">
              <Link to="/tenders" className="btn btn-primary min-h-11 justify-between normal-case">
                Parcourir les consultations
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {user ? (
                <Link to="/assistant" className="btn btn-outline min-h-11 normal-case">
                  Ouvrir l'assistant
                </Link>
              ) : (
                <>
                  <Link to="/login" state={{ from: "/assistant" }} className="btn btn-outline min-h-11 normal-case">
                    Se connecter
                  </Link>
                  <p className="text-center text-xs text-[var(--color-muted)]">
                    Pas de compte ?{" "}
                    <Link
                      to="/register"
                      state={{ from: "/assistant" }}
                      className="font-semibold text-[var(--color-primary)] underline underline-offset-2"
                    >
                      Créer un compte
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Outils de référence — approfondir un point précis, sans consultation liée. */}
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-[var(--color-ink)]">Outils de référence</h2>
            <span className="text-xs text-[var(--color-muted-light)]">Accès libre — sans connexion</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {REFERENCES.map((tool) => (
              <Link
                key={tool.to}
                to={tool.to}
                className="group flex flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card transition-all hover:border-[var(--color-border)] hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">
                  <tool.icon size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold text-[var(--color-ink)]">{tool.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">{tool.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]">
                  Consulter
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="border-t border-[var(--color-border-subtle)] pt-4 text-xs leading-relaxed text-[var(--color-muted-light)]">
          Guide informatif fondé sur le décret n° 2.22.431 du 8 mars 2023. Le règlement de consultation et
          les textes applicables au lancement de la procédure font foi.
        </p>
      </div>
    </PageShell>
  );
}
