import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Users, Clock, FileCheck, BookMarked, AlertTriangle, Gavel, ShieldCheck,
} from "lucide-react";
import { getProcedure } from "../lib/procedures";
import type { ChecklistPhase } from "../lib/procedures";

const PHASE_LABELS: Record<ChecklistPhase, string> = {
  soumission: "À la soumission",
  attribution: "Si l'attribution est envisagée",
  reglement: "Selon le règlement de consultation",
};

const PHASE_ORDER: ChecklistPhase[] = ["soumission", "reglement", "attribution"];

function phaseBadgeClass(phase: ChecklistPhase) {
  if (phase === "soumission") return "bg-[var(--color-crimson)] text-white";
  if (phase === "attribution") return "bg-[var(--color-gold)] text-white";
  return "bg-[var(--color-charcoal)] text-white";
}

export default function ProcedureDetail() {
  const { slug } = useParams<{ slug: string }>();
  const procedure = slug ? getProcedure(slug) : undefined;

  if (!procedure) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Procédure introuvable.{" "}
          <Link to="/procedures" className="text-[var(--color-crimson)] underline">
            Retour aux procédures
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-8">
      <div>
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Procédures de passation
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            {procedure.name}
          </h1>
          {procedure.seuil && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-[var(--color-crimson)] text-white font-sans text-xs font-medium">
              {procedure.seuil}
            </span>
          )}
          {procedure.publiciteMin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]">
              <Clock size={12} className="text-[var(--color-gold)]" />
              Publicité min. {procedure.publiciteMin}
            </span>
          )}
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] mt-2 max-w-3xl leading-relaxed">
          {procedure.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: timeline + checklist */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stage timeline */}
          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[var(--color-charcoal)] mb-4">
                <Clock size={16} className="text-[var(--color-crimson)]" />
                Déroulement de la procédure
              </h2>
              <ol className="relative">
                {procedure.stages.map((stage, i) => {
                  const last = i === procedure.stages.length - 1;
                  return (
                    <li key={stage.label} className="relative pl-8 pb-5 last:pb-0">
                      {!last && (
                        <span className="absolute left-[9px] top-5 bottom-0 w-px bg-[var(--color-border-subtle)]" />
                      )}
                      <span className="absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full border-2 border-[var(--color-crimson)] bg-[var(--color-ivory)] flex items-center justify-center font-sans text-[10px] font-bold text-[var(--color-crimson)]">
                        {i + 1}
                      </span>
                      <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)]">
                        {stage.label}
                      </p>
                      {stage.detail && (
                        <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5 leading-relaxed">
                          {stage.detail}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* Document checklist */}
          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[var(--color-charcoal)] mb-1">
                <FileCheck size={16} className="text-[var(--color-crimson)]" />
                Pièces à fournir
              </h2>
              {procedure.checklistNote && (
                <p className="font-sans text-xs text-[var(--color-gold)] mb-3">{procedure.checklistNote}</p>
              )}
              <div className="space-y-4 mt-3">
                {PHASE_ORDER.map((phase) => {
                  const items = procedure.checklist.filter((i) => i.phase === phase);
                  if (items.length === 0) return null;
                  return (
                    <div key={phase}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded font-sans text-xs font-medium mb-2 ${phaseBadgeClass(phase)}`}>
                        {PHASE_LABELS[phase]}
                      </span>
                      <ul className="space-y-1.5">
                        {items.map((item) => (
                          <li
                            key={item.label}
                            className="flex items-start justify-between gap-3 p-2.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]"
                          >
                            <span className="font-sans text-sm text-[var(--color-charcoal)]">
                              {item.label}
                            </span>
                            {item.note && (
                              <span className="font-sans text-xs text-[var(--color-slate)] text-right shrink-0 max-w-[45%]">
                                {item.note}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Right column: commission, deadlines, legal refs, tools */}
        <div className="space-y-6">
          {/* Commission */}
          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-charcoal)] mb-2">
                <Users size={15} className="text-[var(--color-crimson)]" />
                Organe d'examen
              </h2>
              <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)] mb-2">
                {procedure.commission}
              </p>
              <ul className="space-y-1.5">
                {procedure.commissionDetail.map((d) => (
                  <li key={d} className="font-sans text-xs text-[var(--color-slate)] leading-relaxed pl-3 border-l-2 border-[var(--color-border-subtle)]">
                    {d}
                  </li>
                ))}
              </ul>
              {procedure.commissionNote && (
                <p className="flex items-start gap-1.5 font-sans text-xs text-[var(--color-gold)] mt-3">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {procedure.commissionNote}
                </p>
              )}
              <p className="font-sans text-xs text-[var(--color-slate)] mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                La commission propose l'offre au maître d'ouvrage ; l'approbation finale relève de
                l'autorité compétente.
              </p>
            </div>
          </section>

          {/* Deadlines */}
          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-charcoal)] mb-3">
                <Clock size={15} className="text-[var(--color-crimson)]" />
                Délais clés
              </h2>
              <ul className="space-y-2.5">
                {procedure.deadlines.map((d) => (
                  <li key={d.label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs text-[var(--color-slate)]">{d.label}</p>
                      {d.detail && (
                        <p className="font-sans text-[11px] text-[var(--color-slate)] opacity-80">{d.detail}</p>
                      )}
                    </div>
                    <span className="font-sans text-sm font-bold text-[var(--color-crimson)] tabular-nums whitespace-nowrap">
                      {d.days}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Legal references */}
          <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
            <div className="p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-charcoal)] mb-3">
                <BookMarked size={15} className="text-[var(--color-crimson)]" />
                Références légales
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {procedure.legalRefs.map((r) => (
                  <span
                    key={r.ref}
                    title={r.topic}
                    className="inline-flex items-center px-2 py-0.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] font-sans text-xs text-[var(--color-charcoal)]"
                  >
                    <span className="font-semibold">{r.ref}</span>
                    <span className="ml-1.5 text-[var(--color-slate)]">{r.topic}</span>
                  </span>
                ))}
              </div>
              <p className="font-sans text-[11px] text-[var(--color-slate)] mt-3">
                Décret n° 2.22.431 du 8 mars 2023 relatif aux marchés publics.
              </p>
            </div>
          </section>

          {/* Tools */}
          <div className="grid grid-cols-1 gap-2">
            <Link
              to="/eligibility"
              className="flex items-center gap-2 p-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)] transition-colors font-sans text-sm text-[var(--color-charcoal)]"
            >
              <ShieldCheck size={15} className="text-[var(--color-crimson)]" />
              Vérifier mon éligibilité
            </Link>
            <Link
              to="/recours"
              className="flex items-center gap-2 p-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)] transition-colors font-sans text-sm text-[var(--color-charcoal)]"
            >
              <Gavel size={15} className="text-[var(--color-crimson)]" />
              Délais de recours
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
