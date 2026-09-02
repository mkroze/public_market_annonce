import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, FileSignature, Info, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import ComplianceChecklist from "../components/ComplianceChecklist";
import LegalAssistantSidebar from "../components/LegalAssistantSidebar";
import LegalTooltip from "../components/LegalTooltip";
import PageShell from "../components/PageShell";
import { getTender } from "../lib/api";
import {
  DECLARATION_HONNEUR_ITEMS,
  PUBLICITY_DAYS,
  WAITING_PERIOD_DAYS,
  checkProcedureThresholds,
  guessPrestationType,
  guessProcedureSlug,
  parseMoney,
  type ComplianceAlert,
} from "../lib/compliance";
import { PROCEDURES, assessPriceRisk, getProcedure, type PrestationType } from "../lib/procedures";
import { toTenderPath } from "../lib/tenderUtils";
import type { TenderWithDetails } from "../lib/types";

const alertClass: Record<ComplianceAlert["level"], string> = {
  info: "border-[var(--color-primary)] text-[var(--color-ink)]",
  warning: "border-[var(--color-warning)] text-[var(--color-ink)]",
  error: "border-[var(--color-danger)] text-[var(--color-danger)]",
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
  const [loadError, setLoadError] = useState("");
  const [procedureSlug, setProcedureSlug] = useState("appel-offres-ouvert");
  const [montant, setMontant] = useState(0);
  const [offre, setOffre] = useState(0);
  const [typePrestation, setTypePrestation] = useState<PrestationType>("travaux");
  const storageKey = `candidacy-checklist-${tenderId || "generique"}-${procedureSlug}`;
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(storageKey));

  useEffect(() => {
    if (!tenderId) {
      setTender(null);
      setLoadError("");
      return;
    }

    let cancelled = false;
    setLoadError("");
    getTender(tenderId)
      .then((loadedTender) => {
        if (cancelled) return;
        setTender(loadedTender);
        setProcedureSlug(guessProcedureSlug(loadedTender.procedure_type || loadedTender.details?.procedure));
        setTypePrestation(guessPrestationType(loadedTender.category || loadedTender.details?.categorie));
        const estimate = parseMoney(loadedTender.details?.estimation || loadedTender.estimation);
        if (estimate > 0) setMontant(estimate);
      })
      .catch(() => {
        if (!cancelled) {
          setTender(null);
          setLoadError("Impossible de préremplir cette consultation.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenderId]);

  useEffect(() => {
    setChecked(loadChecked(storageKey));
  }, [storageKey]);

  function toggleChecked(label: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  const procedure = getProcedure(procedureSlug) ?? PROCEDURES[0];
  const thresholdAlerts = useMemo(() => checkProcedureThresholds(montant, procedureSlug), [montant, procedureSlug]);
  const priceRisk = montant > 0 && offre > 0 ? assessPriceRisk(offre, montant, typePrestation) : null;
  const publicity = PUBLICITY_DAYS[procedureSlug];

  const inputClass =
    "institutional-control min-h-11 w-full px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
  const labelClass = "label-academic mb-1.5 flex items-center gap-1";

  const content = (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
      {tender && (
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 shadow-card">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {tender.reference} - {tender.details?.objet || tender.title}
          </p>
          <Link
            to={toTenderPath(tender.id)}
            className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)] underline underline-offset-2"
          >
            Retour à la consultation
          </Link>
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Paramètres du marché</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className={labelClass}>
                  <label htmlFor="assistant-procedure">Mode de passation</label>
                  <LegalTooltip field="procedure" />
                </div>
                <select
                  id="assistant-procedure"
                  className={inputClass}
                  value={procedureSlug}
                  onChange={(event) => setProcedureSlug(event.target.value)}
                >
                  {PROCEDURES.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                      {item.seuil ? ` (${item.seuil})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className={labelClass}>
                  <label htmlFor="assistant-estimation">Estimation du coût HT (DH)</label>
                  <LegalTooltip field="montant" />
                </div>
                <input
                  id="assistant-estimation"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={montant || ""}
                  onChange={(event) => setMontant(Number(event.target.value))}
                />
              </div>
              <div>
                <div className={labelClass}>
                  <label htmlFor="assistant-offer">Votre offre HT (DH)</label>
                  <LegalTooltip field="offre" />
                </div>
                <input
                  id="assistant-offer"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={offre || ""}
                  onChange={(event) => setOffre(Number(event.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="assistant-prestation-type" className={labelClass}>
                  Type de prestation
                </label>
                <select
                  id="assistant-prestation-type"
                  className={inputClass}
                  value={typePrestation}
                  onChange={(event) => setTypePrestation(event.target.value as PrestationType)}
                >
                  <option value="travaux">Travaux</option>
                  <option value="fournitures">Fournitures</option>
                  <option value="services">Services</option>
                  <option value="etudes">Études</option>
                </select>
              </div>
            </div>
          </section>

          {thresholdAlerts.map((alert) => (
            <div key={`${alert.legalRef}-${alert.message}`} className={`rounded-xl border border-l-4 bg-[var(--color-surface)] p-4 text-sm shadow-card ${alertClass[alert.level]}`}>
              <div className="flex items-start gap-2">
                {alert.level === "error" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
                <div>
                  <p>
                    <strong>{alert.legalRef}</strong> - {alert.message}
                  </p>
                  {alert.suggestProcedure && (
                    <button
                      type="button"
                      onClick={() => setProcedureSlug(alert.suggestProcedure!)}
                      className="mt-2 min-h-11 rounded-full px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      Basculer vers {getProcedure(alert.suggestProcedure)?.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {priceRisk?.status === "excessive" && (
            <div
              role="alert"
              aria-label="Offre excessive"
              className="rounded-xl border border-l-4 border-[var(--color-danger)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-danger)] shadow-card"
            >
              <div className="flex items-start gap-2">
                <TrendingUp size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  <strong>Offre excessive ({priceRisk.ecartPct > 0 ? "+" : ""}{priceRisk.ecartPct.toFixed(1)} %)</strong> - votre offre dépasse de plus de 20 % l'estimation.
                </p>
              </div>
            </div>
          )}

          {priceRisk?.status === "anormalement-basse" && (
            <div
              role="alert"
              aria-label="Offre anormalement basse"
              className="rounded-xl border border-l-4 border-[var(--color-warning)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink)] shadow-card"
            >
              <div className="flex items-start gap-2">
                <TrendingDown size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
                <p>
                  <strong>Offre potentiellement anormalement basse ({priceRisk.ecartPct.toFixed(1)} %)</strong> - préparez des justifications écrites.
                </p>
              </div>
            </div>
          )}

          {priceRisk?.status === "normale" && (
            <div className="rounded-xl border border-l-4 border-[var(--color-success)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-success)] shadow-card">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>Votre offre se situe dans la fourchette usuelle par rapport à l'estimation.</p>
              </div>
            </div>
          )}

          <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-5 py-3">
              <CalendarClock size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[var(--color-ink)]">Délais clés</h2>
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)] px-5">
              {publicity && (
                <div className="flex justify-between gap-4 py-3 text-sm">
                  <span className="text-[var(--color-muted)]">Publicité minimale</span>
                  <span className="text-right font-semibold text-[var(--color-ink)]">
                    {publicity.days} jours
                    <span className="block text-xs font-normal text-[var(--color-muted)]">{publicity.note}</span>
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-[var(--color-muted)]">Délai d'attente avant approbation</span>
                <span className="font-semibold text-[var(--color-ink)]">{WAITING_PERIOD_DAYS} jours</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-5 py-3">
              <FileSignature size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[var(--color-ink)]">Déclaration sur l'honneur</h2>
              <LegalTooltip field="declaration-honneur" />
            </div>
            <ul className="space-y-2 p-5">
              {DECLARATION_HONNEUR_ITEMS.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                  <span>
                    {item.label}
                    <span className="ml-1 text-xs font-semibold text-[var(--color-muted-light)]">({item.legalRef})</span>
                    {item.detail && <span className="block text-xs leading-relaxed text-[var(--color-muted)]">{item.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ComplianceChecklist procedure={procedure} checked={checked} onToggle={toggleChecked} />
        </aside>
      </div>

      <LegalAssistantSidebar procedureName={procedure.name} />
    </div>
  );

  if (embedded) return content;

  return (
    <PageShell
      title="Assistant candidature"
      section="Préparation"
      lead="Constituez un dossier conforme : procédure, seuils, prix, délais et pièces exigées."
      width="wide"
      breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Assistant" }]}
    >
      <div className="mb-6 flex items-center gap-2 text-[var(--color-primary)]">
        <Sparkles size={18} aria-hidden="true" />
        <span className="editorial-label">Espace membre</span>
      </div>
      {content}
    </PageShell>
  );
}
