import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Circle,
  ExternalLink,
  FileSignature,
  Gavel,
  Info,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import ComplianceChecklist from "../components/ComplianceChecklist";
import LegalAssistantSidebar from "../components/LegalAssistantSidebar";
import LegalTooltip from "../components/LegalTooltip";
import Breadcrumbs from "../components/Breadcrumbs";
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

/** En-tête d'étape numérotée, pour donner un rythme séquentiel à l'atelier. */
function StepHeader({
  step,
  icon: Icon,
  title,
  children,
}: {
  step: number;
  icon: typeof Scale;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-primary)]">
        {step}
      </span>
      <Icon size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
      <h2 className="text-base font-bold text-[var(--color-ink)]">{title}</h2>
      {children}
    </div>
  );
}

const sectionClass =
  "scroll-mt-24 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card";

export default function CandidacyAssistant() {
  const [searchParams] = useSearchParams();
  const tenderId = searchParams.get("tender") || "";
  const [tender, setTender] = useState<TenderWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
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
          setLoadError("Impossible de préremplir cette consultation. Renseignez les paramètres manuellement.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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

  // ── Plan de préparation : l'issue actionnable de l'atelier ──────────────────
  const hasTender = Boolean(tender);
  const totalDocs = procedure.checklist.length;
  const doneDocs = procedure.checklist.filter((item) => checked.has(item.label)).length;
  const docsComplete = totalDocs > 0 && doneDocs === totalDocs;
  const docsFraction = totalDocs > 0 ? doneDocs / totalDocs : 0;

  const vigilance = useMemo(() => {
    const items: { tone: "error" | "warning"; text: string }[] = [];
    thresholdAlerts
      .filter((alert) => alert.level === "error")
      .forEach((alert) => items.push({ tone: "error", text: `${alert.legalRef} — procédure inadaptée au montant estimé` }));
    if (priceRisk?.status === "excessive") {
      items.push({
        tone: "error",
        text: `Offre excessive (${priceRisk.ecartPct > 0 ? "+" : ""}${priceRisk.ecartPct.toFixed(0)} %) — écartée d'office`,
      });
    }
    if (priceRisk?.status === "anormalement-basse") {
      items.push({ tone: "warning", text: `Offre anormalement basse (${priceRisk.ecartPct.toFixed(0)} %) — justifications à prévoir` });
    }
    return items;
  }, [thresholdAlerts, priceRisk]);

  const todos: { text: string; done: boolean; to?: string }[] = [
    { text: hasTender ? "Consultation liée" : "Lier une consultation", done: hasTender, to: hasTender ? undefined : "/tenders" },
    { text: "Renseigner l'estimation du marché", done: montant > 0 },
    { text: "Renseigner votre offre", done: offre > 0 },
    { text: `Réunir les pièces exigées (${doneDocs}/${totalDocs})`, done: docsComplete },
  ];
  const doneTodos = todos.filter((todo) => todo.done).length;
  const readiness = Math.round(((doneTodos - (docsComplete ? 1 : 0) + docsFraction) / todos.length) * 100);
  const readinessLabel = readiness >= 80 ? "Dossier bien avancé" : readiness >= 40 ? "En cours de préparation" : "À démarrer";

  const inputClass =
    "institutional-control min-h-11 w-full px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
  const labelClass = "label-academic mb-1.5 flex items-center gap-1";

  const assistantSuggestions = [
    `Quelles pièces pour un ${procedure.shortName} ?`,
    "La caution provisoire est-elle obligatoire ?",
    "Quel délai pour contester mon écartement ?",
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Préparer", to: "/guide" }, { label: "Assistant candidature" }]} className="mb-6" />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[var(--color-primary)]">
          <Sparkles size={16} aria-hidden="true" />
          <span className="editorial-label">Atelier de candidature · Espace membre</span>
        </div>
        <h1 className="font-display text-3xl leading-tight text-[var(--color-ink)] sm:text-[2.25rem]">
          Préparer ma candidature
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-base leading-relaxed text-[var(--color-muted)]">
          Procédure, seuils, prix, délais et pièces exigées réunis en un seul flux, jusqu'à un plan de
          préparation clair.
        </p>
      </header>

      {/* Consultation liée / état vide */}
      {loading ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 shadow-card">
          <span className="loading loading-spinner loading-sm text-[var(--color-primary)]"></span>
          <span className="text-sm text-[var(--color-muted)]">Chargement de la consultation…</span>
        </div>
      ) : tender ? (
        <div className="mb-6 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
          <p className="editorial-label text-[var(--color-primary)]">Consultation liée</p>
          <p className="mt-1 font-semibold text-[var(--color-ink)]">{tender.details?.objet || tender.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 font-semibold text-[var(--color-ink)]">
              {tender.reference}
            </span>
            {tender.entity && <span>{tender.entity}</span>}
            {tender.location && <span>· {tender.location}</span>}
          </div>
          <Link
            to={toTenderPath(tender.id)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            Voir la fiche
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Info size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted)]">
              Aucune consultation liée. Ouvrez l'assistant depuis une fiche pour préremplir les paramètres, ou
              renseignez-les manuellement ci-dessous.
            </p>
          </div>
          <Link to="/tenders" className="btn btn-outline btn-sm shrink-0 normal-case">
            Choisir une consultation
          </Link>
        </div>
      )}

      {loadError && (
        <div className="mb-6 rounded-xl border border-l-4 border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-ink)]">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Flux séquentiel */}
        <div className="min-w-0 space-y-6">
          <section id="parametres" className={sectionClass}>
            <StepHeader step={1} icon={Sliders} title="Paramètres du marché" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <section id="controles" className={sectionClass}>
            <StepHeader step={2} icon={ShieldCheck} title="Contrôles seuils & prix" />
            {thresholdAlerts.length === 0 && !priceRisk && (
              <p className="text-sm text-[var(--color-muted)]">
                Renseignez l'estimation et votre offre pour vérifier la cohérence avec les seuils légaux et le
                contrôle des prix.
              </p>
            )}
            <div className="space-y-3">
              {thresholdAlerts.map((alert) => (
                <div
                  key={`${alert.legalRef}-${alert.message}`}
                  className={`rounded-lg border border-l-4 bg-[var(--color-surface)] p-4 text-sm ${alertClass[alert.level]}`}
                >
                  <div className="flex items-start gap-2">
                    {alert.level === "error" ? (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    )}
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
                  className="rounded-lg border border-l-4 border-[var(--color-danger)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-danger)]"
                >
                  <div className="flex items-start gap-2">
                    <TrendingUp size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      <strong>
                        Offre excessive ({priceRisk.ecartPct > 0 ? "+" : ""}
                        {priceRisk.ecartPct.toFixed(1)} %)
                      </strong>{" "}
                      - votre offre dépasse de plus de 20 % l'estimation.
                    </p>
                  </div>
                </div>
              )}

              {priceRisk?.status === "anormalement-basse" && (
                <div
                  role="alert"
                  aria-label="Offre anormalement basse"
                  className="rounded-lg border border-l-4 border-[var(--color-warning)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink)]"
                >
                  <div className="flex items-start gap-2">
                    <TrendingDown size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
                    <p>
                      <strong>Offre potentiellement anormalement basse ({priceRisk.ecartPct.toFixed(1)} %)</strong> -
                      préparez des justifications écrites.
                    </p>
                  </div>
                </div>
              )}

              {priceRisk?.status === "normale" && (
                <div className="rounded-lg border border-l-4 border-[var(--color-success)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-success)]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>Votre offre se situe dans la fourchette usuelle par rapport à l'estimation.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="delais" className={sectionClass}>
            <StepHeader step={3} icon={CalendarClock} title="Délais clés" />
            <div className="divide-y divide-[var(--color-border-subtle)]">
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
            <Link
              to="/recours"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Gavel size={14} aria-hidden="true" />
              Calculer les délais de recours
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </section>

          <section id="pieces" className="scroll-mt-24">
            <StepHeader step={4} icon={ClipboardCheck} title="Pièces à fournir" />
            <ComplianceChecklist procedure={procedure} checked={checked} onToggle={toggleChecked} />
          </section>

          <section id="declaration" className={sectionClass}>
            <StepHeader step={5} icon={FileSignature} title="Déclaration sur l'honneur">
              <LegalTooltip field="declaration-honneur" />
            </StepHeader>
            <ul className="space-y-2">
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

          <section id="assistant-ia" className="scroll-mt-24">
            <StepHeader step={6} icon={Scale} title="Assistant juridique" />
            <LegalAssistantSidebar procedureName={procedure.name} variant="inline" suggestions={assistantSuggestions} />
          </section>
        </div>

        {/* Plan de préparation — l'issue actionnable */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card">
            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-5 py-3">
              <ClipboardCheck size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[var(--color-ink)]">Plan de préparation</h2>
            </div>

            <div className="space-y-5 p-5">
              {/* Avancement */}
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{readinessLabel}</span>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{readiness}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300 motion-reduce:transition-none"
                    style={{ width: `${readiness}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Pièces réunies&nbsp;: <span className="tabular-nums">{doneDocs}/{totalDocs}</span>
                </p>
              </div>

              {/* Points de vigilance */}
              <div>
                <p className="editorial-label mb-2 text-[var(--color-primary)]">Points de vigilance</p>
                {vigilance.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Aucun risque détecté
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {vigilance.map((item) => (
                      <li key={item.text} className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                        <AlertTriangle
                          size={14}
                          className={`mt-0.5 shrink-0 ${item.tone === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}`}
                          aria-hidden="true"
                        />
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* À compléter */}
              <div>
                <p className="editorial-label mb-2 text-[var(--color-primary)]">À compléter</p>
                <ul className="space-y-1.5">
                  {todos.map((todo) => {
                    const content = (
                      <>
                        {todo.done ? (
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
                        ) : (
                          <Circle size={15} className="mt-0.5 shrink-0 text-[var(--color-muted-light)]" aria-hidden="true" />
                        )}
                        <span className={todo.done ? "text-[var(--color-muted)] line-through decoration-1" : "text-[var(--color-ink)]"}>
                          {todo.text}
                        </span>
                      </>
                    );
                    return (
                      <li key={todo.text} className="text-sm">
                        {todo.to ? (
                          <Link
                            to={todo.to}
                            className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-2 px-1 py-0.5">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Aller plus loin */}
              <div className="border-t border-[var(--color-border-subtle)] pt-4">
                <p className="editorial-label mb-2 text-[var(--color-primary)]">Aller plus loin</p>
                <div className="flex flex-col gap-1.5">
                  <Link
                    to="/eligibility"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <ShieldCheck size={14} aria-hidden="true" />
                    Vérifier mon éligibilité (art. 27)
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                  <Link
                    to={`/procedures/${procedure.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <Scale size={14} aria-hidden="true" />
                    Détail de la procédure
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <p className="px-1 text-xs leading-relaxed text-[var(--color-muted-light)]">
            Guide informatif fondé sur le décret n° 2.22.431. Le règlement de consultation et les textes
            applicables au lancement de la procédure font foi.
          </p>
        </aside>
      </div>
    </div>
  );
}
