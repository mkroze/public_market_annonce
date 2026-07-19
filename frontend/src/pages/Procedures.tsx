import { Link } from "react-router-dom";
import { Scale, ChevronRight, Users, Clock, ShieldCheck, Gavel, Calculator } from "lucide-react";
import { PROCEDURES, STAGES_COMMON } from "../lib/procedures";

const TOOLS = [
  {
    to: "/eligibility",
    icon: ShieldCheck,
    title: "Vérificateur d'éligibilité",
    description: "Vérifiez si vous remplissez les conditions de l'article 27 pour soumissionner.",
  },
  {
    to: "/recours",
    icon: Gavel,
    title: "Assistant recours",
    description: "Calculez vos délais de réclamation et de saisine de la CNCP (art. 163-164).",
  },
  {
    to: "/calculator",
    icon: Calculator,
    title: "Calculateur",
    description: "Pénalités, caution provisoire et risque de prix (offre excessive ou anormalement basse).",
  },
];

export default function Procedures({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "space-y-8" : "px-4 sm:px-6 py-8 space-y-8"}>
      {!embedded && (
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Scale className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Procédures de passation
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Guide des modes de passation du décret n° 2.22.431 du 8 mars 2023 relatif aux marchés publics
          </p>
        </div>
      )}

      {/* Common legal stages */}
      <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-5">
        <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] mb-3">
          Étapes légales communes
        </p>
        <div className="flex flex-wrap items-center gap-y-2">
          {STAGES_COMMON.map((stage, i) => (
            <div key={stage} className="flex items-center">
              <span className="inline-flex items-center px-2.5 py-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] font-sans text-xs font-medium text-[var(--color-charcoal)]">
                {stage}
              </span>
              {i < STAGES_COMMON.length - 1 && (
                <ChevronRight size={14} className="mx-1 text-[var(--color-slate)]" />
              )}
            </div>
          ))}
        </div>
        <p className="font-sans text-xs text-[var(--color-slate)] mt-3">
          La commission compétente choisit l'offre à proposer au maître d'ouvrage ; le marché ne devient
          définitif qu'après approbation par l'autorité compétente. Il n'existe pas de « commission
          d'attribution » distincte en droit commun.
        </p>
      </div>

      {/* Procedure cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROCEDURES.map((p) => (
          <Link
            key={p.slug}
            to={`/procedures/${p.slug}`}
            className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] hover:border-[var(--color-border)] transition-colors p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">{p.name}</h2>
              <ChevronRight size={18} className="text-[var(--color-slate)] shrink-0 mt-1" />
            </div>
            <p className="font-sans text-sm text-[var(--color-slate)] leading-relaxed">{p.description}</p>
            <div className="flex flex-wrap gap-2 mt-auto pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]">
                <Users size={12} className="text-[var(--color-crimson)]" />
                {p.commission.length > 45 ? p.commission.slice(0, 45) + "…" : p.commission}
              </span>
              {p.publiciteMin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]">
                  <Clock size={12} className="text-[var(--color-gold)]" />
                  Publicité {p.publiciteMin}
                </span>
              )}
              {p.seuil && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-crimson)] text-white font-sans text-xs font-medium">
                  {p.seuil}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Tools */}
      {!embedded && (
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-3">
            Outils pratiques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TOOLS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)] transition-colors p-5"
              >
                <t.icon size={18} className="text-[var(--color-crimson)] mb-2" />
                <h3 className="font-display font-bold text-[var(--color-charcoal)]">{t.title}</h3>
                <p className="font-sans text-sm text-[var(--color-slate)] mt-1">{t.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-4">
        Guide informatif fondé sur le décret n° 2.22.431 du 8 mars 2023 (en vigueur depuis le 1er septembre
        2023). Le régime applicable dépend de la date de lancement de la procédure ; les procédures lancées
        avant cette date restent régies par le décret n° 2-12-349 de 2013. Ce guide ne remplace pas le
        règlement de consultation ni un conseil juridique.
      </p>
    </div>
  );
}
