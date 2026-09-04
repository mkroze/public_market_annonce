import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import type { Procedure, ChecklistPhase } from "../lib/procedures";

const PHASE_LABELS: Record<ChecklistPhase, string> = {
  soumission: "À la soumission",
  attribution: "Au stade de l'attribution",
  reglement: "Selon le règlement de consultation",
};

const PHASE_ORDER: ChecklistPhase[] = ["soumission", "reglement", "attribution"];

interface Props {
  procedure: Procedure;
  checked: Set<string>;
  onToggle: (label: string) => void;
}

/**
 * Checklist dynamique des pièces légalement exigées pour la procédure
 * sélectionnée (art. 28-31, 53, 87 selon le mode de passation).
 */
export default function ComplianceChecklist({ procedure, checked, onToggle }: Props) {
  const total = procedure.checklist.length;
  const done = procedure.checklist.filter((i) => checked.has(i.label)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)]">
        <ListChecks size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        <h2 className="font-display text-base font-bold text-[var(--color-ink)]">
          Pièces exigées — {procedure.shortName}
        </h2>
        <span
          className={`ml-auto text-xs font-sans font-semibold tabular-nums ${
            done === total ? "text-[var(--color-success)]" : "text-[var(--color-primary)]"
          }`}
        >
          {done}/{total}
        </span>
      </div>

      <div className="px-5 pt-3">
        <div className="h-1.5 rounded-full bg-[var(--color-surface-strong)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${
              done === total ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {PHASE_ORDER.map((phase) => {
          const items = procedure.checklist.filter((i) => i.phase === phase);
          if (items.length === 0) return null;
          return (
            <div key={phase}>
              <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
                {PHASE_LABELS[phase]}
              </p>
              <ul className="space-y-1.5">
                {items.map((item) => {
                  const isChecked = checked.has(item.label);
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => onToggle(item.label)}
                        className="group flex min-h-11 w-full items-start gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                      >
                        {isChecked ? (
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[var(--color-success)]" aria-hidden="true" />
                        ) : (
                          <Circle size={16} className="shrink-0 mt-0.5 text-[var(--color-primary)] opacity-70 group-hover:opacity-100" aria-hidden="true" />
                        )}
                        <span
                          className={`font-sans text-sm leading-snug ${
                            isChecked
                              ? "text-[var(--color-muted)] line-through decoration-1"
                              : "text-[var(--color-ink)]"
                          }`}
                        >
                          {item.label}
                          {item.note && (
                            <span className="block text-xs text-[var(--color-muted)] no-underline">
                              {item.note}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {procedure.checklistNote && (
          <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-3">
            {procedure.checklistNote}
          </p>
        )}
      </div>
    </div>
  );
}
