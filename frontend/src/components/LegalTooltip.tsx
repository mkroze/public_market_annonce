import { HelpCircle } from "lucide-react";
import { FIELD_ANNOTATIONS } from "../lib/compliance";

/**
 * Icône « ? » affichant en popover l'annotation juridique d'un champ
 * (article du décret 2.22.431 + résumé pratique + avertissement éventuel).
 */
export default function LegalTooltip({ field }: { field: string }) {
  const annotation = FIELD_ANNOTATIONS[field];
  if (!annotation) return null;

  return (
    <span className="dropdown dropdown-hover dropdown-top align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={`Aide juridique (${annotation.legalRef})`}
        className="inline-flex items-center text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors ml-1.5 align-middle"
      >
        <HelpCircle size={14} />
      </button>
      <div
        tabIndex={0}
        className="dropdown-content z-50 w-72 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] shadow-md p-3 text-left normal-case tracking-normal"
      >
        <span className="inline-block px-1.5 py-0.5 mb-2 text-[11px] font-semibold font-sans rounded bg-[var(--color-crimson)] text-white">
          {annotation.legalRef}
        </span>
        <p className="font-sans text-xs leading-relaxed text-[var(--color-charcoal)]">
          {annotation.summary}
        </p>
        {annotation.warning && (
          <p className="mt-2 font-sans text-xs leading-relaxed text-[var(--color-crimson)] border-l-2 border-[var(--color-crimson)] pl-2">
            {annotation.warning}
          </p>
        )}
      </div>
    </span>
  );
}
