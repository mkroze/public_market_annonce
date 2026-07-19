import { useState } from "react";
import { Calculator as CalculatorIcon, TrendingUp, TrendingDown, CheckCircle2, Info } from "lucide-react";
import { assessPriceRisk } from "../lib/procedures";
import type { PrestationType } from "../lib/procedures";

function formatMAD(value: number): string {
  return value.toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " MAD";
}

export default function Calculator({ embedded = false }: { embedded?: boolean }) {
  // Penalty calculator
  const [montant, setMontant] = useState<number>(0);
  const [jours, setJours] = useState<number>(0);
  const [typeMarche, setTypeMarche] = useState<string>("Travaux");
  const [taux, setTaux] = useState<number>(1 / 1000);

  // Caution calculator
  const [montantCaution, setMontantCaution] = useState<number>(0);

  // Price risk indicator
  const [estimation, setEstimation] = useState<number>(0);
  const [offre, setOffre] = useState<number>(0);
  const [typePrestation, setTypePrestation] = useState<PrestationType>("travaux");

  // Penalty calculations
  const penaliteJournaliere = montant * taux;
  const penaliteTotale = penaliteJournaliere * jours;
  const plafond = montant * 0.1;
  const penaliteApplicable = Math.min(penaliteTotale, plafond);

  // Caution calculation
  const caution = montantCaution * 0.015;

  // Price risk calculation
  const priceRisk = estimation > 0 && offre > 0 ? assessPriceRisk(offre, estimation, typePrestation) : null;

  return (
    <div
      className={embedded ? "" : "max-w-4xl mx-auto px-4 sm:px-6 py-8"}
      style={{ backgroundColor: "var(--color-ivory)" }}
    >
      {!embedded && (
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-1">
            <CalculatorIcon className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Calculateur
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Penalites de retard, caution provisoire & risque de prix
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Penalty Calculator */}
        <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-6">
              Pénalités de retard
            </h2>

            <div className="mb-4">
              <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                Montant du marché (MAD)
              </label>
              <input
                type="number"
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                placeholder="0"
                min={0}
                value={montant || ""}
                onChange={(e) => setMontant(Number(e.target.value))}
              />
            </div>

            <div className="mb-4">
              <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                Nombre de jours de retard
              </label>
              <input
                type="number"
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                placeholder="0"
                min={0}
                value={jours || ""}
                onChange={(e) => setJours(Number(e.target.value))}
              />
            </div>

            <div className="mb-4">
              <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                Type de marché
              </label>
              <select
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                value={typeMarche}
                onChange={(e) => setTypeMarche(e.target.value)}
              >
                <option>Travaux</option>
                <option>Fournitures</option>
                <option>Services</option>
              </select>
            </div>

            <div className="mb-8">
              <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                Taux journalier
              </label>
              <select
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                value={String(taux)}
                onChange={(e) => setTaux(Number(e.target.value))}
              >
                <option value={String(1 / 1000)}>1/1000</option>
                <option value={String(1 / 500)}>1/500</option>
                <option value={String(1 / 200)}>1/200</option>
              </select>
            </div>

            {/* Results */}
            <div className="border-t border-[var(--color-border-subtle)] pt-6">
              <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] mb-4">
                Résultats
              </p>

              <div className="space-y-3">
                <div className="flex justify-between font-sans">
                  <span className="text-[var(--color-slate)]">Pénalité journalière</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">{formatMAD(penaliteJournaliere)}</span>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-[var(--color-slate)]">Pénalité totale</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">{formatMAD(penaliteTotale)}</span>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-[var(--color-slate)]">Plafond (10%)</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">{formatMAD(plafond)}</span>
                </div>
                <div className="border-t border-[var(--color-border-subtle)] my-1" />
                <div className="flex justify-between text-lg font-sans">
                  <span className="font-bold text-[var(--color-charcoal)]">Pénalité applicable</span>
                  <span className="font-bold text-[var(--color-crimson)]">
                    {formatMAD(penaliteApplicable)}
                  </span>
                </div>
                {penaliteTotale > plafond && (
                  <p className="font-sans text-sm text-[var(--color-gold)]">
                    La pénalité totale dépasse le plafond de 10%. Le montant
                    plafonné est appliqué.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Caution Calculator */}
        <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] h-fit">
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-6">
              Caution provisoire
            </h2>

            <div className="mb-8">
              <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                Montant du marché (MAD)
              </label>
              <input
                type="number"
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                placeholder="0"
                min={0}
                value={montantCaution || ""}
                onChange={(e) => setMontantCaution(Number(e.target.value))}
              />
            </div>

            <div className="border-t border-[var(--color-border-subtle)] pt-6">
              <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] mb-4">
                Résultat
              </p>

              <div className="flex justify-between items-center font-sans">
                <span className="text-[var(--color-slate)]">
                  Caution provisoire (1,5%)
                </span>
                <span className="font-bold text-lg text-[var(--color-crimson)]">
                  {formatMAD(caution)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Price Risk Indicator */}
        <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] lg:col-span-2">
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-1">
              Risque de prix
            </h2>
            <p className="font-sans text-sm text-[var(--color-slate)] mb-6">
              Comparez votre offre à l'estimation du maître d'ouvrage : la commission contrôle les offres
              excessives et anormalement basses.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                  Estimation du coût (MAD)
                </label>
                <input
                  type="number"
                  className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                  placeholder="0"
                  min={0}
                  value={estimation || ""}
                  onChange={(e) => setEstimation(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                  Votre offre (MAD)
                </label>
                <input
                  type="number"
                  className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
                  placeholder="0"
                  min={0}
                  value={offre || ""}
                  onChange={(e) => setOffre(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
                  Type de prestation
                </label>
                <select
                  className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
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

            <div className="border-t border-[var(--color-border-subtle)] pt-6">
              {priceRisk === null ? (
                <p className="flex items-center gap-2 font-sans text-sm text-[var(--color-slate)]">
                  <Info size={15} />
                  Saisissez l'estimation et votre offre pour évaluer le risque.
                </p>
              ) : priceRisk.status === "non-applicable" ? (
                <p className="flex items-start gap-2 font-sans text-sm text-[var(--color-slate)]">
                  <Info size={15} className="shrink-0 mt-0.5" />
                  Les seuils de prix excessif / anormalement bas ne s'appliquent pas aux marchés d'études,
                  soumis à une notation technico-financière particulière (art. 144).
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between font-sans">
                    <span className="text-[var(--color-slate)]">Écart par rapport à l'estimation</span>
                    <span className="font-bold text-lg tabular-nums text-[var(--color-charcoal)]">
                      {priceRisk.ecartPct > 0 ? "+" : ""}
                      {priceRisk.ecartPct.toFixed(1)} %
                    </span>
                  </div>
                  {priceRisk.status === "excessive" && (
                    <p className="flex items-start gap-2 font-sans text-sm text-[var(--color-crimson)]">
                      <TrendingUp size={15} className="shrink-0 mt-0.5" />
                      Offre potentiellement excessive : elle dépasse de plus de 20 % l'estimation du coût
                      des prestations. La commission peut l'écarter ou demander des justifications.
                    </p>
                  )}
                  {priceRisk.status === "anormalement-basse" && (
                    <p className="flex items-start gap-2 font-sans text-sm text-[var(--color-crimson)]">
                      <TrendingDown size={15} className="shrink-0 mt-0.5" />
                      Offre potentiellement anormalement basse : elle est inférieure de plus de{" "}
                      {typePrestation === "travaux" ? "20 %" : "25 %"} à l'estimation. La commission peut
                      demander des justifications avant de l'écarter.
                    </p>
                  )}
                  {priceRisk.status === "normale" && (
                    <p className="flex items-start gap-2 font-sans text-sm text-green-800">
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      Votre offre se situe dans la fourchette usuelle (entre{" "}
                      {typePrestation === "travaux" ? "−20 %" : "−25 %"} et +20 % de l'estimation).
                    </p>
                  )}
                  <p className="font-sans text-xs text-[var(--color-slate)]">
                    Indicateur de risque, non un verdict : la commission apprécie au cas par cas, contrôle
                    aussi les prix unitaires principaux et peut demander des justifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
