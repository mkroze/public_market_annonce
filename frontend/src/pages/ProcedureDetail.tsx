import { type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CalendarClock,
  Clock,
  FileCheck,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getProcedure, type ChecklistPhase } from "../lib/procedures";

const phaseLabels: Record<ChecklistPhase, string> = {
  soumission: "À la soumission",
  reglement: "Selon le règlement",
  attribution: "Si l'attribution est envisagée",
};

const phaseOrder: ChecklistPhase[] = ["soumission", "reglement", "attribution"];

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";

const PRIMARY_PILL =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none";

const OUTLINE_PILL =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none";

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Framed panel with a bordered icon header — matches new-hot-design.md §3. */
function Panel({ title, icon: Icon, children }: { title: string; icon: IconType; children: ReactNode }) {
  return (
    <section className={FRAME}>
      <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4">
        <Icon size={17} className="text-[var(--color-primary)]" aria-hidden={true} />
        <h2 className="text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export default function ProcedureDetail() {
  const { slug } = useParams<{ slug: string }>();
  const procedure = slug ? getProcedure(slug) : undefined;

  if (!procedure) {
    return (
      <div className="px-3 py-3 sm:px-5 sm:py-4">
        <section className={`mx-auto ${FRAME}`}>
          <div className="px-5 py-7 sm:px-8">
            <Link
              to="/procedures"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-primary-strong)]"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Toutes les procédures
            </Link>
            <h1 className="mt-4 text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]">
              Procédure introuvable.
            </h1>
            <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
              Ce mode de passation n'existe pas ou a été renommé.{" "}
              <Link to="/procedures" className="font-semibold text-[var(--color-primary)] underline underline-offset-2">
                Retour aux procédures
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── Header card ──────────────────────────────────────── */}
      <section className={`mx-auto ${FRAME}`} aria-labelledby="procedure-title">
        <div className="px-5 py-7 sm:px-8">
          <Link
            to="/procedures"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-primary-strong)]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Toutes les procédures
          </Link>

          <h1
            id="procedure-title"
            className="mt-4 max-w-2xl text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
          >
            {procedure.name}
          </h1>

          <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
            {procedure.description}
          </p>

          {(procedure.seuil || procedure.publiciteMin) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {procedure.seuil && (
                <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {procedure.seuil}
                </span>
              )}
              {procedure.publiciteMin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
                  <Clock size={12} className="text-[var(--color-warning)]" aria-hidden="true" />
                  Publicité min. {procedure.publiciteMin}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Déroulement de la procédure" icon={Clock}>
            <ol className="space-y-4">
              {procedure.stages.map((stage, index) => (
                <li key={`${stage.label}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold tabular-nums text-[var(--color-primary)]">
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
          </Panel>

          {procedure.deadlines.length > 0 && (
            <Panel title="Délais clés" icon={CalendarClock}>
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {procedure.deadlines.map((deadline, index) => (
                  <li
                    key={`${deadline.label}-${index}`}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{deadline.label}</p>
                      {deadline.detail && (
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">{deadline.detail}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--color-primary)]">
                      {deadline.days}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Pièces à fournir" icon={FileCheck}>
            {procedure.checklistNote && (
              <p className="-mt-1 mb-5 text-sm leading-relaxed text-[var(--color-muted)]">{procedure.checklistNote}</p>
            )}
            <div className="space-y-5">
              {phaseOrder.map((phase) => {
                const items = procedure.checklist.filter((item) => item.phase === phase);
                if (!items.length) return null;
                return (
                  <div key={phase}>
                    <div className="mb-2 flex items-center gap-2">
                      <ListChecks size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
                      <p className={LABEL}>{phaseLabels[phase]}</p>
                    </div>
                    <ul className="space-y-2 pl-0">
                      {items.map((item) => (
                        <li
                          key={item.label}
                          className="list-none rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-3 py-2"
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
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Organe d'examen" icon={Users}>
            <p className="text-sm font-semibold text-[var(--color-ink)]">{procedure.commission}</p>
            <ul className="mt-3 space-y-2 pl-0">
              {procedure.commissionDetail.map((detail) => (
                <li
                  key={detail}
                  className="list-none border-l-2 border-[var(--color-border-subtle)] pl-3 text-xs leading-relaxed text-[var(--color-muted)]"
                >
                  {detail}
                </li>
              ))}
            </ul>
            {procedure.commissionNote && (
              <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-light)]">{procedure.commissionNote}</p>
            )}
          </Panel>

          <Panel title="Références légales" icon={BookMarked}>
            <div className="flex flex-wrap gap-2">
              {procedure.legalRefs.map((ref) => (
                <span
                  key={`${ref.ref}-${ref.topic}`}
                  className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-muted)]"
                >
                  <strong className="text-[var(--color-ink)]">{ref.ref}</strong> {ref.topic}
                </span>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-2">
            <Link to="/eligibility" className={PRIMARY_PILL}>
              <ShieldCheck size={16} aria-hidden="true" />
              Vérifier mon éligibilité
            </Link>
            <Link to="/recours" className={`group ${OUTLINE_PILL}`}>
              Calculer mes recours
              <ArrowRight
                size={16}
                className="text-[var(--color-muted-light)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-warning)] motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
