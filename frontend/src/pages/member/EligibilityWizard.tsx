import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { updateAccountProfile } from "../../lib/api";
import type { AccountProfile, CompanyProfile, LegalForm, SizeBand } from "../../lib/types";
import { ELIGIBILITY_QUESTIONS, type EligibilityKind } from "../../lib/procedures";
import { SECTOR_GROUPS } from "../../lib/sectors";
import ClassificationCard from "../../components/member/ClassificationCard";

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: "auto_entrepreneur", label: "Auto-entrepreneur" },
  { value: "personne_physique", label: "Personne physique" },
  { value: "sarl", label: "SARL" },
  { value: "sarl_au", label: "SARL AU" },
  { value: "sa", label: "SA" },
  { value: "sas", label: "SAS" },
  { value: "snc", label: "SNC" },
  { value: "cooperative", label: "Coopérative" },
  { value: "gie", label: "GIE" },
  { value: "association", label: "Association" },
  { value: "autre", label: "Autre" },
];

const SIZE_BANDS: { value: SizeBand; label: string; hint: string }[] = [
  { value: "micro", label: "Micro", hint: "< 10 salariés" },
  { value: "tpe", label: "TPE", hint: "Très petite entreprise / auto-entrepreneur" },
  { value: "pme", label: "PME", hint: "10 – 200 salariés" },
  { value: "eti", label: "ETI", hint: "Entreprise de taille intermédiaire" },
  { value: "grande", label: "Grande entreprise", hint: "Au-delà du plafond PME" },
];

const KIND_LABELS: Record<EligibilityKind, string> = {
  capacite: "Capacités et activité",
  regularite: "Régularité fiscale et sociale",
  exclusion: "Causes d'exclusion",
};
const KIND_ORDER: EligibilityKind[] = ["capacite", "regularite", "exclusion"];

type Answer = "oui" | "non" | "nsp";

const STEPS = ["Forme juridique", "Secteur", "Taille", "Standing (art. 27)", "Classification"] as const;

export default function EligibilityWizard({
  account,
  onSaved,
}: {
  account: AccountProfile;
  onSaved: (account: AccountProfile) => void;
}) {
  const initial = account.profile;
  // A returning user with a populated profile lands directly on their current
  // classification; a fresh user starts the four-question flow at step 0.
  const alreadyClassified = (account.classification?.completeness ?? 0) > 0;
  const [step, setStep] = useState(alreadyClassified ? STEPS.length - 1 : 0);
  const [legalForm, setLegalForm] = useState<LegalForm | "">(initial?.legal_form ?? "");
  const [sectors, setSectors] = useState<string[]>(initial?.sectors ?? []);
  const [sizeBand, setSizeBand] = useState<SizeBand | "">(initial?.size_band ?? "");
  const [standing, setStanding] = useState<Record<string, string>>(initial?.standing ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<AccountProfile | null>(alreadyClassified ? account : null);

  const answeredStanding = useMemo(
    () => ELIGIBILITY_QUESTIONS.filter((q) => standing[q.id]).length,
    [standing],
  );

  function toggleSector(code: string) {
    setSectors((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  async function persist(patch: Partial<CompanyProfile>): Promise<AccountProfile | null> {
    setSaving(true);
    setError("");
    try {
      const account = await updateAccountProfile(patch);
      onSaved(account);
      return account;
    } catch (err: any) {
      setError(err?.message || "Impossible d'enregistrer.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleClassify() {
    const account = await persist({
      legal_form: legalForm,
      sectors,
      size_band: sizeBand,
      standing,
    });
    if (account) {
      setSaved(account);
      setStep(STEPS.length - 1);
    }
  }

  async function applyDerived() {
    const derived = saved?.classification?.derived;
    if (!derived) return;
    const account = await persist(derived);
    if (account) setSaved(account);
  }

  const derived = saved?.classification?.derived ?? {};
  const hasDerivedToApply = Object.keys(derived).length > 0;

  const pillClass = (active: boolean) =>
    `min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors ${
      active
        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:border-[var(--color-border)]"
    }`;

  return (
    <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Wand2 size={18} className="text-[var(--color-primary)]" aria-hidden />
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Classification rapide</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Quatre questions. Nous en déduisons vos types de prestation, votre statut PME, votre fourchette de
        marché et les qualifications probables — pour afficher les consultations éligibles.
      </p>

      {/* Stepper */}
      <ol className="mt-4 flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (i < STEPS.length - 1 || saved ? setStep(i) : undefined)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                i === step
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : i < step
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-muted-light)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  i < step ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-surface-strong)]"
                }`}
              >
                {i < step ? <Check size={12} aria-hidden /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 min-h-[8rem]">
        {/* Step 0 — legal form */}
        {step === 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forme juridique">
            {LEGAL_FORMS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={legalForm === f.value}
                onClick={() => setLegalForm(f.value)}
                className={pillClass(legalForm === f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — sectors */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-muted)]">
              Sélectionnez vos secteurs. Les <strong>types de prestation</strong> (Travaux / Fournitures /
              Services) en sont déduits automatiquement.
            </p>
            {SECTOR_GROUPS.map((group) => (
              <fieldset key={group.category}>
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  {group.category}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {group.sectors.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      aria-pressed={sectors.includes(s.code)}
                      onClick={() => toggleSector(s.code)}
                      className={pillClass(sectors.includes(s.code))}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {/* Step 2 — size */}
        {step === 2 && (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Taille de l'entreprise">
            {SIZE_BANDS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={sizeBand === s.value}
                onClick={() => setSizeBand(s.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  sizeBand === s.value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                }`}
              >
                <span className="block text-sm font-semibold text-[var(--color-ink)]">{s.label}</span>
                <span className="block text-xs text-[var(--color-muted)]">{s.hint}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — standing / art. 27 */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-[var(--color-muted)]">
              Déclaration sur l'honneur (art. 27). Facultatif, mais renseigne votre « standing » et évite
              les mauvaises surprises. <span className="tabular-nums">{answeredStanding}/{ELIGIBILITY_QUESTIONS.length}</span>
            </p>
            {KIND_ORDER.map((kind) => (
              <div key={kind}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  {KIND_LABELS[kind]}
                </p>
                <div className="space-y-2">
                  {ELIGIBILITY_QUESTIONS.filter((q) => q.kind === kind).map((q) => (
                    <div key={q.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 flex-1 text-sm text-[var(--color-ink)]">{q.question}</span>
                      <div className="flex shrink-0 gap-1.5">
                        {(["oui", "non", "nsp"] as Answer[]).map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setStanding((cur) => ({ ...cur, [q.id]: a }))}
                            className={pillClass(standing[q.id] === a)}
                          >
                            {a === "nsp" ? "?" : a === "oui" ? "Oui" : "Non"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4 — classification result */}
        {step === 4 && (
          <div className="space-y-4">
            {saved?.classification ? (
              <>
                <ClassificationCard c={saved.classification} />
                {hasDerivedToApply && (
                  <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--color-ink)]">
                      Appliquer les valeurs déduites à votre profil pour activer le catalogue épuré ?
                    </p>
                    <button
                      type="button"
                      onClick={applyDerived}
                      disabled={saving}
                      className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
                      Appliquer au profil
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Enregistrez pour voir votre classification.</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {/* Navigation */}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-40"
        >
          <ArrowLeft size={15} aria-hidden /> Précédent
        </button>

        {step < 3 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
          >
            Suivant <ArrowRight size={15} aria-hidden />
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            onClick={handleClassify}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
            Enregistrer et classer
          </button>
        )}
      </div>
    </section>
  );
}
