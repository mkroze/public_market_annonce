import { Link } from "react-router-dom";
import { Check } from "lucide-react";

interface Tier {
  name: string;
  price: string;
  annual?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  custom?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Essentiel",
    price: "590 MAD/mois",
    annual: "6 000 MAD/an",
    features: [
      "Consultations illimitées",
      "3 secteurs surveillés",
      "Alertes email quotidiennes",
      "Accès aux DCE",
      "20 favoris",
      "Support standard",
    ],
    cta: "Commencer l'essai gratuit",
  },
  {
    name: "Pro",
    price: "990 MAD/mois",
    annual: "10 000 MAD/an",
    features: [
      "Tout Essentiel +",
      "5 secteurs surveillés",
      "Export PDF",
      "Favoris illimités",
      "Statistiques entreprises",
      "Analyses de marché",
      "Support prioritaire",
    ],
    cta: "Commencer l'essai gratuit",
    highlighted: true,
  },
  {
    name: "Entreprise",
    price: "Sur mesure",
    features: [
      "Secteurs illimités",
      "Analyse complète entreprises",
      "Accès multi-utilisateurs",
      "Support dédié",
      "API access",
    ],
    cta: "Commencer l'essai gratuit",
    custom: true,
  },
];

export default function Pricing() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" style={{ backgroundColor: "var(--color-ivory)" }}>
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold text-[var(--color-charcoal)] mb-4">
          Nos tarifs
        </h1>
        <p className="font-sans text-lg text-[var(--color-slate)]">
          Choisissez le plan adapté à vos besoins
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded border bg-[var(--color-ivory-dim)] flex flex-col ${
              tier.highlighted
                ? "border-[var(--color-crimson)] border-2"
                : "border-[var(--color-border-subtle)]"
            }`}
          >
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
                  {tier.name}
                </h2>
                {tier.highlighted && (
                  <span className="seal-badge inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-semibold uppercase tracking-wide text-[var(--color-gold)] border border-[var(--color-gold-light)] bg-[var(--color-ivory-dim)]">
                    Recommandé
                  </span>
                )}
              </div>

              <div className="my-6">
                <span className="font-display text-3xl font-bold text-[var(--color-charcoal)]">
                  {tier.price}
                </span>
                {tier.annual && (
                  <p className="font-sans text-sm text-[var(--color-slate)] mt-1">
                    {tier.annual}
                  </p>
                )}
              </div>

              <ul className="space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 font-sans text-[var(--color-charcoal)]">
                    <Check className="w-5 h-5 flex-shrink-0 text-[var(--color-crimson)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-center">
                <Link
                  to="/register"
                  className={`btn w-full text-center py-2.5 px-4 rounded font-sans font-semibold transition-colors ${
                    tier.highlighted
                      ? "btn-primary bg-[var(--color-crimson)] text-white border-[var(--color-crimson)] hover:opacity-90"
                      : "border border-[var(--color-crimson)] text-[var(--color-crimson)] bg-transparent hover:bg-[var(--color-ivory-dim)]"
                  }`}
                >
                  {tier.cta}
                </Link>
                <p className="font-sans text-xs text-[var(--color-slate)] mt-3 text-center">
                  Essai gratuit 7 jours - Sans carte bancaire
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
