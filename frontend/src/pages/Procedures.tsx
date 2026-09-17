import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock, FileText, Gavel, ShieldCheck, Users } from "lucide-react";
import { PROCEDURES, STAGES_COMMON } from "../lib/procedures";

/** Highlight pill — signature headline treatment (new-hot-design.md §2.2). */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const CARD =
  "group flex flex-col rounded-[1.5rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-[var(--color-border)] hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transform-none motion-reduce:transition-none";

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
    <div className="space-y-6">
      {/* ─── Étapes communes — stepper ─────────────────────────── */}
      <section className={FRAME}>
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4 sm:px-6">
          <FileText size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">Étapes communes</h2>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {STAGES_COMMON.map((stage, index) => (
              <li key={stage} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] py-1.5 pl-1.5 pr-3 text-xs font-semibold text-[var(--color-ink)]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary)] text-[0.65rem] font-bold tabular-nums text-[var(--color-on-primary)]">
                    {index + 1}
                  </span>
                  {stage}
                </span>
                {index < STAGES_COMMON.length - 1 && (
                  <ChevronRight size={14} className="text-[var(--color-muted-light)]" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--color-muted)]">
            La commission propose l'offre au maître d'ouvrage. Le marché ne devient définitif qu'après
            approbation par l'autorité compétente.
          </p>
        </div>
      </section>

      {/* ─── Modes de passation ────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PROCEDURES.map((procedure) => (
          <Link key={procedure.slug} to={`/procedures/${procedure.slug}`} className={CARD}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <FileText size={18} aria-hidden="true" />
                </span>
                <h2 className="text-lg font-bold leading-tight text-[var(--color-ink)]">{procedure.name}</h2>
              </div>
              <ArrowRight
                size={18}
                className="mt-1.5 shrink-0 text-[var(--color-muted-light)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-warning)] motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{procedure.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]">
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

      {/* ─── Outils associés ───────────────────────────────────── */}
      {!embedded && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-[var(--color-ink)]">Outils associés</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {toolLinks.map((tool) => (
              <Link key={tool.to} to={tool.to} className={CARD}>
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <tool.icon size={18} aria-hidden="true" />
                  </span>
                  <ArrowRight
                    size={18}
                    className="mt-1.5 shrink-0 text-[var(--color-muted-light)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-warning)] motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-3 font-semibold text-[var(--color-ink)]">{tool.title}</h3>
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
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── Header card ──────────────────────────────────────── */}
      <section className={`mx-auto ${FRAME}`} aria-labelledby="procedures-title">
        <div className="px-5 py-7 sm:px-8">
          <Link
            to="/guide"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-primary-strong)]"
          >
            <FileText size={14} aria-hidden="true" />
            Préparer votre candidature
          </Link>

          <h1
            id="procedures-title"
            className="mt-4 max-w-2xl text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
          >
            Les procédures de <Pill>passation</Pill>.
          </h1>

          <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
            Guide opérationnel des modes de passation, délais, commissions et pièces attendues.
          </p>
        </div>
      </section>

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="mt-6">{content}</div>
    </div>
  );
}
