import { Link } from "react-router-dom";
import { ChevronRight, Clock, Gavel, ShieldCheck, Users } from "lucide-react";
import PageShell from "../components/PageShell";
import { PROCEDURES, STAGES_COMMON } from "../lib/procedures";

const toolLinks = [
  {
    to: "/eligibility",
    icon: ShieldCheck,
    title: "Vérifier l'éligibilité",
    description: "Contrôlez les conditions de l'article 27 avant de préparer le dossier administratif.",
  },
  {
    to: "/recours",
    icon: Gavel,
    title: "Calculer les recours",
    description: "Repérez les délais de réclamation et de saisine CNCP depuis une date de référence.",
  },
];

export default function Procedures({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
        <p className="editorial-label mb-3 text-[var(--color-primary)]">Étapes communes</p>
        <div className="flex flex-wrap items-center gap-2">
          {STAGES_COMMON.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                {stage}
              </span>
              {index < STAGES_COMMON.length - 1 && (
                <ChevronRight size={14} className="text-[var(--color-muted-light)]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
          La commission propose l'offre au maître d'ouvrage. Le marché ne devient définitif qu'après
          approbation par l'autorité compétente.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PROCEDURES.map((procedure) => (
          <Link
            key={procedure.slug}
            to={`/procedures/${procedure.slug}`}
            className="group rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card transition-all hover:border-[var(--color-border)] hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-[var(--color-ink)]">{procedure.name}</h2>
              <ChevronRight
                size={18}
                className="mt-1 shrink-0 text-[var(--color-muted-light)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{procedure.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]">
                <Users size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
                {procedure.commission.length > 46 ? `${procedure.commission.slice(0, 46)}...` : procedure.commission}
              </span>
              {procedure.publiciteMin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]">
                  <Clock size={12} className="text-[var(--color-warning)]" aria-hidden="true" />
                  {procedure.publiciteMin}
                </span>
              )}
              {procedure.seuil && (
                <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {procedure.seuil}
                </span>
              )}
            </div>
          </Link>
        ))}
      </section>

      {!embedded && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-[var(--color-ink)]">Outils associés</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {toolLinks.map((tool) => (
              <Link
                key={tool.to}
                to={tool.to}
                className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card transition-all hover:border-[var(--color-border)] hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
              >
                <tool.icon size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
                <h3 className="mt-2 font-semibold text-[var(--color-ink)]">{tool.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{tool.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-[var(--color-border-subtle)] pt-4 text-xs leading-relaxed text-[var(--color-muted-light)]">
        Guide informatif fondé sur le décret n° 2.22.431 du 8 mars 2023. Le règlement de consultation et
        les textes applicables au lancement de la procédure font foi.
      </p>
    </div>
  );

  if (embedded) return content;

  return (
    <PageShell
      title="Procédures de passation"
      section="Préparation"
      lead="Guide opérationnel des modes de passation, délais, commissions et pièces attendues."
      width="wide"
      breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Procédures" }]}
    >
      {content}
    </PageShell>
  );
}
