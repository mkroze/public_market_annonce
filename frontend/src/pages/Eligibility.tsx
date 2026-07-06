import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldX, HelpCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { ELIGIBILITY_QUESTIONS } from "../lib/procedures";
import type { EligibilityKind } from "../lib/procedures";

type Answer = "oui" | "non" | "nsp";

const KIND_LABELS: Record<EligibilityKind, string> = {
  capacite: "Capacités et activité",
  regularite: "Régularité fiscale et sociale",
  exclusion: "Causes d'exclusion",
};

const KIND_ORDER: EligibilityKind[] = ["capacite", "regularite", "exclusion"];

type Verdict = "eligible" | "preuves-manquantes" | "risque" | "non-eligible" | "incomplet";

const VERDICTS: Record<Verdict, { icon: typeof ShieldCheck; title: string; description: string; className: string }> = {
  eligible: {
    icon: ShieldCheck,
    title: "Éligible sur la base des informations déclarées",
    description:
      "Vous remplissez les conditions de l'article 27. Les attestations fiscale et CNSS restent à produire au plus tard si l'attribution est envisagée.",
    className: "border-green-700 text-green-800",
  },
  "preuves-manquantes": {
    icon: HelpCircle,
    title: "Probablement éligible — preuves manquantes",
    description:
      "Aucune cause d'exclusion déclarée, mais certaines conditions restent à confirmer ou à justifier. Rassemblez les pièces correspondantes avant de soumissionner.",
    className: "border-[var(--color-gold)] text-[var(--color-gold)]",
  },
  risque: {
    icon: ShieldAlert,
    title: "Risque détecté",
    description:
      "Une réponse incertaine porte sur une cause d'exclusion. Clarifiez votre situation avant de soumissionner : une déclaration sur l'honneur inexacte expose aux mesures coercitives de l'article 152.",
    className: "border-[var(--color-gold)] text-[var(--color-gold)]",
  },
  "non-eligible": {
    icon: ShieldX,
    title: "Non éligible sur la base des informations déclarées",
    description:
      "Au moins une condition de l'article 27 n'est pas remplie ou une cause d'exclusion s'applique. Vérifiez si votre situation peut être régularisée avant la date limite.",
    className: "border-[var(--color-crimson)] text-[var(--color-crimson)]",
  },
  incomplet: {
    icon: HelpCircle,
    title: "Répondez aux questions",
    description: "Le résultat s'affiche au fur et à mesure de vos réponses.",
    className: "border-[var(--color-border-subtle)] text-[var(--color-slate)]",
  },
};

export default function Eligibility() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const verdict: Verdict = useMemo(() => {
    const answered = ELIGIBILITY_QUESTIONS.filter((q) => answers[q.id]);
    if (answered.length === 0) return "incomplet";

    // Pour les capacités/régularité, "oui" est requis ; pour les exclusions, "non" est requis.
    const failed = ELIGIBILITY_QUESTIONS.some((q) => {
      const a = answers[q.id];
      return q.kind === "exclusion" ? a === "oui" : a === "non";
    });
    if (failed) return "non-eligible";

    const exclusionUnsure = ELIGIBILITY_QUESTIONS.some(
      (q) => q.kind === "exclusion" && answers[q.id] === "nsp"
    );
    if (exclusionUnsure) return "risque";

    const incomplete = ELIGIBILITY_QUESTIONS.some((q) => !answers[q.id] || answers[q.id] === "nsp");
    if (incomplete) return answered.length < ELIGIBILITY_QUESTIONS.length ? "incomplet" : "preuves-manquantes";

    return "eligible";
  }, [answers]);

  const v = VERDICTS[verdict];
  const VerdictIcon = v.icon;
  const answeredCount = ELIGIBILITY_QUESTIONS.filter((q) => answers[q.id]).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Procédures de passation
        </Link>
        <div className="flex items-center gap-2.5 mb-1">
          <ShieldCheck className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Vérificateur d'éligibilité
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Conditions de soumission de l'article 27 du décret n° 2.22.431
        </p>
      </div>

      {/* Verdict */}
      <div className={`rounded border-2 bg-[var(--color-ivory-dim)] p-5 flex items-start gap-3 ${v.className}`}>
        <VerdictIcon size={22} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-display font-bold">{v.title}</p>
          <p className="font-sans text-sm text-[var(--color-slate)] mt-1">{v.description}</p>
          <p className="font-sans text-xs text-[var(--color-slate)] mt-2 tabular-nums">
            {answeredCount}/{ELIGIBILITY_QUESTIONS.length} questions répondues
          </p>
        </div>
        {answeredCount > 0 && (
          <button
            onClick={() => setAnswers({})}
            className="ml-auto shrink-0 inline-flex items-center gap-1 font-sans text-xs text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors"
          >
            <RotateCcw size={12} />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Questions */}
      {KIND_ORDER.map((kind) => (
        <section key={kind} className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
          <div className="p-5">
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-4">
              {KIND_LABELS[kind]}
            </h2>
            <div className="space-y-4">
              {ELIGIBILITY_QUESTIONS.filter((q) => q.kind === kind).map((q) => (
                <div key={q.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1">
                    <p className="font-sans text-sm text-[var(--color-charcoal)]">
                      {q.question}
                      <span className="ml-2 font-sans text-[11px] text-[var(--color-slate)]">{q.legalRef}</span>
                    </p>
                    {q.help && (
                      <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">{q.help}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(["oui", "non", "nsp"] as Answer[]).map((a) => {
                      const active = answers[q.id] === a;
                      return (
                        <button
                          key={a}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
                          className={`px-3 py-1 rounded border font-sans text-xs font-medium transition-colors ${
                            active
                              ? "border-[var(--color-crimson)] bg-[var(--color-crimson)] text-white"
                              : "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                          }`}
                        >
                          {a === "nsp" ? "Je ne sais pas" : a === "oui" ? "Oui" : "Non"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-4">
        Résultat indicatif fondé sur vos déclarations. Les conditions détaillées, les pièces exigées et les
        équivalents pour les concurrents non installés au Maroc dépendent du règlement de consultation
        (art. 27 à 31 du décret n° 2.22.431). Ce guide ne remplace pas un conseil juridique.
      </p>
    </div>
  );
}
