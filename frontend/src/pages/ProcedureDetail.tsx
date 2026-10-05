import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookMarked, Clock, FileCheck, ShieldCheck, Users } from "lucide-react";
import PageShell from "../components/PageShell";
import { getProcedure, type ChecklistPhase } from "../lib/procedures";

const phaseLabels: Record<ChecklistPhase, string> = {
  soumission: "À la soumission",
  reglement: "Selon le règlement",
  attribution: "Si l'attribution est envisagée",
};

const phaseOrder: ChecklistPhase[] = ["soumission", "reglement", "attribution"];

export default function ProcedureDetail() {
  const { slug } = useParams<{ slug: string }>();
  const procedure = slug ? getProcedure(slug) : undefined;

  if (!procedure) {
    return (
      <PageShell
        title="Procédure introuvable"
        section="Préparation"
        width="wide"
        breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Procédures", to: "/procedures" }, { label: "Introuvable" }]}
      >
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
          <p className="text-sm text-[var(--color-muted)]">
            Procédure introuvable.{" "}
            <Link to="/procedures" className="font-semibold text-[var(--color-primary)] underline underline-offset-2">
              Retour aux procédures
            </Link>
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={procedure.name}
      section="Procédure"
      lead={procedure.description}
      width="wide"
      breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Procédures", to: "/procedures" }, { label: procedure.name }]}
    >
      <div className="space-y-6">
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Toutes les procédures
        </Link>

        <div className="flex flex-wrap gap-2">
          {procedure.seuil && (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              {procedure.seuil}
            </span>
          )}
          {procedure.publiciteMin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
              <Clock size={12} aria-hidden="true" />
              Publicité min. {procedure.publiciteMin}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-ink)]">
                <Clock size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
                Déroulement de la procédure
              </h2>
              <ol className="mt-5 space-y-4">
                {procedure.stages.map((stage, index) => (
                  <li key={`${stage.label}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-primary)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-ink)]">{stage.label}</span>
                      {stage.detail && (
                        <span className="mt-1 block text-sm leading-relaxed text-[var(--color-muted)]">{stage.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-ink)]">
                <FileCheck size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
                Pièces à fournir
              </h2>
              {procedure.checklistNote && (
                <p className="mt-2 text-sm text-[var(--color-muted)]">{procedure.checklistNote}</p>
              )}
              <div className="mt-5 space-y-5">
                {phaseOrder.map((phase) => {
                  const items = procedure.checklist.filter((item) => item.phase === phase);
                  if (!items.length) return null;
                  return (
                    <div key={phase}>
                      <p className="editorial-label mb-2 text-[var(--color-primary)]">{phaseLabels[phase]}</p>
                      <ul className="space-y-2 pl-0">
                        {items.map((item) => (
                          <li
                            key={item.label}
                            className="list-none rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-3 py-2"
                          >
                            <span className="text-sm font-medium text-[var(--color-ink)]">{item.label}</span>
                            {item.note && <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{item.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
                <Users size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
                Organe d'examen
              </h2>
              <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">{procedure.commission}</p>
              <ul className="mt-3 space-y-2 pl-0">
                {procedure.commissionDetail.map((detail) => (
                  <li key={detail} className="list-none border-l-2 border-[var(--color-border-subtle)] pl-3 text-xs leading-relaxed text-[var(--color-muted)]">
                    {detail}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
                <BookMarked size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
                Références légales
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {procedure.legalRefs.map((ref) => (
                  <span key={`${ref.ref}-${ref.topic}`} className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
                    <strong className="text-[var(--color-ink)]">{ref.ref}</strong> {ref.topic}
                  </span>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-2">
              <Link to="/eligibility" className="btn btn-outline justify-start normal-case">
                <ShieldCheck size={15} aria-hidden="true" />
                Vérifier mon éligibilité
              </Link>
              <Link to="/recours" className="btn btn-outline justify-start normal-case">
                Calculer mes recours
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
