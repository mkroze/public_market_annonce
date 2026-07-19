import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  Info,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getTender } from "../lib/api";
import type { TenderWithDetails } from "../lib/types";
import { PROCEDURES, getProcedure, assessPriceRisk } from "../lib/procedures";
import type { PrestationType } from "../lib/procedures";
import {
  DECLARATION_HONNEUR_ITEMS,
  PUBLICITY_DAYS,
  WAITING_PERIOD_DAYS,
  checkProcedureThresholds,
  guessPrestationType,
  guessProcedureSlug,
  parseMoney,
} from "../lib/compliance";
import type { ComplianceAlert } from "../lib/compliance";
import ComplianceChecklist from "../components/ComplianceChecklist";
import LegalTooltip from "../components/LegalTooltip";
import LegalAssistantSidebar from "../components/LegalAssistantSidebar";

const ALERT_STYLES: Record<ComplianceAlert["level"], string> = {
  info: "border-[var(--color-gold)] text-[var(--color-charcoal)]",
  warning: "border-[var(--color-gold)] text-[var(--color-charcoal)]",
  error: "border-[var(--color-crimson)] text-[var(--color-crimson)]",
};

function loadChecked(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export default function CandidacyAssistant({ embedded = false }: { embedded?: boolean }) {
  const [searchParams] = useSearchParams();
  const tenderId = searchParams.get("tender") || "";

  const [tender, setTender] = useState<TenderWithDetails | null>(null);
  const [procedureSlug, setProcedureSlug] = useState("appel-offres-ouvert");
  const [montant, setMontant] = useState(0); // estimation HT du maître d'ouvrage
  const [offre, setOffre] = useState(0); // offre du candidat
  const [typePrestation, setTypePrestation] = useState<PrestationType>("travaux");

  const storageKey = `candidacy-checklist-${tenderId || "generique"}-${procedureSlug}`;
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(storageKey));

  // Pré-remplissage depuis la consultation liée
  useEffect(() => {
    if (!tenderId) return;
    getTender(tenderId)
      .then((t) => {
        setTender(t);
        setProcedureSlug(guessProcedureSlug(t.procedure_type || t.details?.procedure));
        setTypePrestation(guessPrestationType(t.category || t.details?.categorie));
        const est = parseMoney(t.details?.estimation || t.estimation);
        if (est > 0) setMontant(est);
      })
      .catch(() => setTender(null));
  }, [tenderId]);

  // La checklist cochée est propre à chaque couple consultation/procédure
  useEffect(() => {
    setChecked(loadChecked(storageKey));
  }, [storageKey]);

  function toggleChecked(label: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  const procedure = getProcedure(procedureSlug) ?? PROCEDURES[0];
  const thresholdAlerts = useMemo(
    () => checkProcedureThresholds(montant, procedureSlug),
    [montant, procedureSlug],
  );
  const priceRisk = montant > 0 && offre > 0 ? assessPriceRisk(offre, montant, typePrestation) : null;
  const publicity = PUBLICITY_DAYS[procedureSlug];

  const inputClass =
    "w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors";
  const labelClass =
    "label-academic mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] flex items-center";

  return (
    <div className={embedded ? "" : "max-w-7xl mx-auto px-4 sm:px-6 py-8"}>
      {/* Header */}
      <div className="mb-8">
        {!embedded && tenderId && (
          <Link
            to={`/tenders/${tenderId}`}
            className="inline-flex items-center gap-1.5 mb-3 text-sm font-sans text-[var(--color-crimson)] hover:underline"
          >
            <ArrowLeft size={14} /> Retour à la consultation
          </Link>
        )}
        {!embedded && (
          <>
            <div className="flex items-center gap-2.5 mb-1">
              <Sparkles className="w-6 h-6 text-[var(--color-crimson)]" />
              <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
                Assistant candidature
              </h1>
            </div>
            <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
              Constituez un dossier conforme au décret n° 2.22.431 : pièces exigées, seuils et contrôles de prix.
            </p>
          </>
        )}
        {tender && (
          <p className="font-sans text-sm text-[var(--color-charcoal)] ml-[34px] mt-2 border-l-2 border-[var(--color-gold)] pl-3">
            {tender.reference} — {tender.details?.objet || tender.title}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Colonne principale : paramètres + validations ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Paramètres du marché */}
          <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-6">
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-5">
              Paramètres du marché
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Mode de passation <LegalTooltip field="procedure" />
                </label>
                <select
                  className={inputClass}
                  value={procedureSlug}
                  onChange={(e) => setProcedureSlug(e.target.value)}
                >
                  {PROCEDURES.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                      {p.seuil ? ` (${p.seuil})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Estimation du coût HT (DH) <LegalTooltip field="montant" />
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  className={inputClass}
                  value={montant || ""}
                  onChange={(e) => setMontant(Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Votre offre HT (DH) <LegalTooltip field="offre" />
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  className={inputClass}
                  value={offre || ""}
                  onChange={(e) => setOffre(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Type de prestation</label>
                <select
                  className={inputClass}
                  value={typePrestation}
                  onChange={(e) => setTypePrestation(e.target.value as PrestationType)}
                >
                  <option value="travaux">Travaux</option>
                  <option value="fournitures">Fournitures</option>
                  <option value="services">Services (hors études)</option>
                  <option value="etudes">Études</option>
                </select>
              </div>
            </div>
          </div>

          {/* Validations : seuils de procédure */}
          {thresholdAlerts.map((alert, i) => (
            <div
              key={i}
              className={`border border-l-4 rounded px-4 py-3 font-sans text-sm flex items-start gap-2.5 ${ALERT_STYLES[alert.level]}`}
            >
              {alert.level === "error" ? (
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              ) : (
                <Info size={16} className="shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p>
                  <span className="font-semibold">{alert.legalRef} — </span>
                  {alert.message}
                </p>
                {alert.suggestProcedure && (
                  <button
                    type="button"
                    onClick={() => setProcedureSlug(alert.suggestProcedure!)}
                    className="mt-1.5 text-sm font-semibold text-[var(--color-crimson)] hover:underline"
                  >
                    Basculer vers « {getProcedure(alert.suggestProcedure)?.name} »
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Validations : risque de prix */}
          {priceRisk && priceRisk.status === "excessive" && (
            <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3 font-sans text-sm text-[var(--color-crimson)] flex items-start gap-2.5">
              <TrendingUp size={16} className="shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold">Offre excessive ({priceRisk.ecartPct > 0 ? "+" : ""}
                {priceRisk.ecartPct.toFixed(1)} %) — </span>
                votre offre dépasse de plus de 20 % l'estimation du coût des prestations : la commission
                l'écartera lors de l'examen des offres financières.
              </p>
            </div>
          )}
          {priceRisk && priceRisk.status === "anormalement-basse" && (
            <div className="border border-[var(--color-gold)] border-l-4 rounded px-4 py-3 font-sans text-sm text-[var(--color-charcoal)] flex items-start gap-2.5">
              <TrendingDown size={16} className="shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold">Offre potentiellement anormalement basse (
                {priceRisk.ecartPct.toFixed(1)} %) — </span>
                inférieure de plus de {typePrestation === "travaux" ? "20 %" : "25 %"} à l'estimation.
                Préparez des justifications écrites (méthodes, conditions d'approvisionnement…) : la
                commission les exigera avant de statuer.
              </p>
            </div>
          )}
          {priceRisk && priceRisk.status === "normale" && (
            <div className="border border-green-600 border-l-4 rounded px-4 py-3 font-sans text-sm text-green-800 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <p>
                Votre offre ({priceRisk.ecartPct > 0 ? "+" : ""}
                {priceRisk.ecartPct.toFixed(1)} %) se situe dans la fourchette usuelle (entre{" "}
                {typePrestation === "travaux" ? "−20 %" : "−25 %"} et +20 % de l'estimation).
              </p>
            </div>
          )}
          {priceRisk && priceRisk.status === "non-applicable" && (
            <div className="border border-[var(--color-border-subtle)] border-l-4 rounded px-4 py-3 font-sans text-sm text-[var(--color-slate)] flex items-start gap-2.5">
              <Info size={16} className="shrink-0 mt-0.5" />
              <p>
                Les seuils de prix excessif / anormalement bas ne s'appliquent pas aux marchés d'études,
                soumis à une notation technico-financière particulière.
              </p>
            </div>
          )}

          {/* Délais clés */}
          <div className="border border-[var(--color-border-subtle)] rounded">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
              <CalendarClock size={16} className="text-[var(--color-crimson)]" />
              <h2 className="font-display text-base font-bold text-[var(--color-charcoal)]">Délais clés</h2>
            </div>
            <div className="px-5 divide-y divide-[var(--color-border-subtle)]">
              {publicity && (
                <div className="py-3 flex justify-between gap-4 font-sans text-sm">
                  <span className="text-[var(--color-slate)]">Publicité / candidatures (minimum)</span>
                  <span className="font-semibold text-[var(--color-charcoal)] text-right">
                    {publicity.days} jours
                    <span className="block text-xs font-normal text-[var(--color-slate)]">{publicity.note}</span>
                  </span>
                </div>
              )}
              {procedure.deadlines.map((d) => (
                <div key={d.label} className="py-3 flex justify-between gap-4 font-sans text-sm">
                  <span className="text-[var(--color-slate)]">{d.label}</span>
                  <span className="font-semibold text-[var(--color-charcoal)] text-right">
                    {d.days}
                    {d.detail && (
                      <span className="block text-xs font-normal text-[var(--color-slate)]">{d.detail}</span>
                    )}
                  </span>
                </div>
              ))}
              <div className="py-3 flex justify-between gap-4 font-sans text-sm">
                <span className="text-[var(--color-slate)]">Délai d'attente avant approbation</span>
                <span className="font-semibold text-[var(--color-charcoal)]">{WAITING_PERIOD_DAYS} jours</span>
              </div>
            </div>
          </div>

          {/* Déclaration sur l'honneur (art. 29) */}
          <div className="border border-[var(--color-border-subtle)] rounded">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
              <FileSignature size={16} className="text-[var(--color-crimson)]" />
              <h2 className="font-display text-base font-bold text-[var(--color-charcoal)]">
                Déclaration sur l'honneur
              </h2>
              <LegalTooltip field="declaration-honneur" />
            </div>
            <div className="px-5 py-4">
              <p className="font-sans text-sm text-[var(--color-slate)] mb-3">
                Vérifiez que votre déclaration contient les mentions et attestations exigées par l'article 29 :
              </p>
              <ul className="space-y-2">
                {DECLARATION_HONNEUR_ITEMS.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 font-sans text-sm">
                    <ShieldCheck size={15} className="shrink-0 mt-0.5 text-[var(--color-crimson)]" />
                    <span className="text-[var(--color-charcoal)]">
                      {item.label}
                      <span className="ml-1.5 text-[11px] font-semibold text-[var(--color-slate)]">
                        ({item.legalRef})
                      </span>
                      {item.detail && (
                        <span className="block text-xs text-[var(--color-slate)]">{item.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="font-sans text-xs text-[var(--color-slate)]">
            Guide informatif fondé sur l'analyse du décret n° 2.22.431 : seuls le dossier de consultation et
            le texte réglementaire en vigueur font foi. Vérifiez aussi l'
            <Link to="/eligibility" className="text-[var(--color-crimson)] hover:underline">
              éligibilité (art. 27)
            </Link>{" "}
            et la fiche{" "}
            <Link to={`/procedures/${procedure.slug}`} className="text-[var(--color-crimson)] hover:underline">
              procédure détaillée
            </Link>
            .
          </p>
        </div>

        {/* ── Colonne latérale : checklist dynamique ── */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-32">
            <ComplianceChecklist procedure={procedure} checked={checked} onToggle={toggleChecked} />
          </div>
        </div>
      </div>

      <LegalAssistantSidebar procedureName={procedure.name} />
    </div>
  );
}
