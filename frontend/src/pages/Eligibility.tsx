import { useMemo, useState } from "react";
import { HelpCircle, RotateCcw, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import PageShell from "../components/PageShell";
import { ELIGIBILITY_QUESTIONS, type EligibilityKind } from "../lib/procedures";

type Answer = "oui" | "non" | "nsp";
type Verdict = "eligible" | "preuves-manquantes" | "risque" | "non-eligible" | "incomplet";

const kindLabels: Record<EligibilityKind, string> = {
  capacite: "Capacités et activité",
  regularite: "Régularité fiscale et sociale",
  exclusion: "Causes d'exclusion",
};

const kindOrder: EligibilityKind[] = ["capacite", "regularite", "exclusion"];

const verdicts: Record<Verdict, { icon: typeof ShieldCheck; title: string; description: string; className: string }> = {
  eligible: {
    icon: ShieldCheck,
    title: "Éligible sur la base des informations déclarées",
    description: "Les conditions déclaratives sont remplies. Les attestations restent à produire selon le règlement de consultation.",
    className: "border-[var(--color-success)] text-[var(--color-success)]",
  },
  "preuves-manquantes": {
    icon: HelpCircle,
    title: "Probablement éligible - preuves à confirmer",
    description: "Aucune exclusion n'est déclarée, mais certains éléments doivent encore être documentés.",
    className: "border-[var(--color-warning)] text-[var(--color-warning)]",
  },
  risque: {
    icon: ShieldAlert,
    title: "Risque détecté",
    description: "Une incertitude porte sur une cause d'exclusion. Clarifiez la situation avant de soumissionner.",
    className: "border-[var(--color-warning)] text-[var(--color-warning)]",
  },
  "non-eligible": {
    icon: ShieldX,
    title: "Non éligible sur la base des informations déclarées",
    description: "Au moins une condition n'est pas remplie ou une cause d'exclusion s'applique.",
    className: "border-[var(--color-danger)] text-[var(--color-danger)]",
  },
  incomplet: {
    icon: HelpCircle,
    title: "Répondez aux questions",
    description: "Le résultat s'affiche au fur et à mesure de vos réponses.",
    className: "border-[var(--color-border-subtle)] text-[var(--color-muted)]",
  },
};

export default function Eligibility({ embedded = false }: { embedded?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const verdict: Verdict = useMemo(() => {
    const answered = ELIGIBILITY_QUESTIONS.filter((question) => answers[question.id]);
    if (!answered.length) return "incomplet";

    const failed = ELIGIBILITY_QUESTIONS.some((question) => {
      const answer = answers[question.id];
      return question.kind === "exclusion" ? answer === "oui" : answer === "non";
    });
    if (failed) return "non-eligible";

    const uncertainExclusion = ELIGIBILITY_QUESTIONS.some(
      (question) => question.kind === "exclusion" && answers[question.id] === "nsp",
    );
    if (uncertainExclusion) return "risque";

    const incomplete = ELIGIBILITY_QUESTIONS.some((question) => !answers[question.id] || answers[question.id] === "nsp");
    if (incomplete) return answered.length < ELIGIBILITY_QUESTIONS.length ? "incomplet" : "preuves-manquantes";

    return "eligible";
  }, [answers]);

  const current = verdicts[verdict];
  const VerdictIcon = current.icon;
  const answeredCount = ELIGIBILITY_QUESTIONS.filter((question) => answers[question.id]).length;

  const content = (
    <div className="space-y-6">
      <section className={`rounded-xl border-2 bg-[var(--color-surface)] p-5 shadow-card ${current.className}`}>
        <div className="flex items-start gap-3">
          <VerdictIcon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">{current.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{current.description}</p>
            <p className="mt-2 text-xs tabular-nums text-[var(--color-muted-light)]">
              {answeredCount}/{ELIGIBILITY_QUESTIONS.length} questions répondues
            </p>
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Réinitialiser
            </button>
          )}
        </div>
      </section>

      {kindOrder.map((kind) => (
        <section key={kind} className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">{kindLabels[kind]}</h2>
          <div className="mt-4 space-y-4">
            {ELIGIBILITY_QUESTIONS.filter((question) => question.kind === kind).map((question) => (
              <div key={question.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {question.question}
                    <span className="ml-2 text-xs font-semibold text-[var(--color-muted-light)]">{question.legalRef}</span>
                  </p>
                  {question.help && <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{question.help}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {(["oui", "non", "nsp"] as Answer[]).map((answer) => {
                    const active = answers[question.id] === answer;
                    const label = answer === "nsp" ? "Je ne sais pas" : answer === "oui" ? "Oui" : "Non";
                    return (
                      <button
                        key={answer}
                        type="button"
                        onClick={() => setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: answer }))}
                        className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none ${
                          active
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:border-[var(--color-border)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="border-t border-[var(--color-border-subtle)] pt-4 text-xs leading-relaxed text-[var(--color-muted-light)]">
        Résultat indicatif fondé sur vos déclarations. Les pièces exactes et équivalents éventuels dépendent
        du règlement de consultation.
      </p>
    </div>
  );

  if (embedded) return content;

  return (
    <PageShell
      title="Vérificateur d'éligibilité"
      section="Préparation"
      lead="Contrôlez les conditions de soumission de l'article 27 du décret n° 2.22.431."
      width="wide"
      breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Éligibilité" }]}
    >
      {content}
    </PageShell>
  );
}
