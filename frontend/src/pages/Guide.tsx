import { Link } from "react-router-dom";
import { Gavel, Scale, ShieldCheck, Sparkles } from "lucide-react";
import PageShell from "../components/PageShell";
import { useAuth } from "../lib/auth";
import Procedures from "./Procedures";
import Eligibility from "./Eligibility";
import Recours from "./Recours";

const sections = [
  { id: "procedures", label: "Procédures", icon: Scale },
  { id: "eligibilite", label: "Éligibilité", icon: ShieldCheck },
  { id: "assistant", label: "Assistant", icon: Sparkles },
  { id: "recours", label: "Recours", icon: Gavel },
] as const;

export default function Guide() {
  const { user } = useAuth();

  return (
    <PageShell
      title="Guide & outils"
      section="Préparation"
      lead="Comprendre la procédure, vérifier l'éligibilité et préparer la candidature autour du catalogue."
      width="wide"
      breadcrumbs={[{ label: "Préparer" }]}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Sommaire de préparation">
          <ul className="sticky top-24 space-y-1 pl-0">
            {sections.map((section) => (
              <li key={section.id} className="list-none">
                <a
                  href={`#${section.id}`}
                  className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--color-muted)] no-underline transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
                >
                  <section.icon size={15} aria-hidden="true" />
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          <section id="procedures" className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-bold text-[var(--color-ink)]">Procédures de passation</h2>
            <Procedures embedded />
          </section>

          <section id="eligibilite" className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-bold text-[var(--color-ink)]">Vérificateur d'éligibilité</h2>
            <Eligibility embedded />
          </section>

          <section id="assistant" className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-bold text-[var(--color-ink)]">Assistant candidature</h2>
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Préparer le dossier avec l'IA juridique</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                    L'assistant analyse les paramètres du marché, les seuils et les pièces de candidature.
                  </p>
                </div>
                {user ? (
                  <Link to="/assistant" className="btn btn-primary min-h-11 shrink-0 normal-case">
                    Ouvrir l'assistant
                  </Link>
                ) : (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link to="/login" state={{ from: "/assistant" }} className="btn btn-primary min-h-11 normal-case">
                      Se connecter
                    </Link>
                    <Link to="/register" state={{ from: "/assistant" }} className="btn btn-outline min-h-11 normal-case">
                      Créer un compte
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="recours" className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-bold text-[var(--color-ink)]">Assistant recours</h2>
            <Recours embedded />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
