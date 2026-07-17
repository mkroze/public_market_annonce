import { Handshake, ExternalLink, Database, Landmark } from "lucide-react";
import {
  DATA_SOURCES,
  STRATEGIC_PARTNERS,
  TIER_LABELS,
  STATUS_LABELS,
  type DataSource,
} from "../lib/partners";

const STATUS_STYLES: Record<DataSource["status"], string> = {
  integre: "bg-[var(--color-crimson)] text-white",
  reference: "bg-[var(--color-ivory-deep)] text-[var(--color-charcoal)]",
  acces_institutionnel:
    "border border-[var(--color-gold)] text-[var(--color-charcoal)] bg-[var(--color-ivory)]",
};

const TIERS: (1 | 2 | 3)[] = [1, 2, 3];

export default function Partners() {
  return (
    <div className="px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Handshake className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Partenaires & Sources de données
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Cette plateforme intègre les données du portail officiel des marchés publics et cartographie
          d'autres sources institutionnelles utiles à la transparence administrative.
        </p>
      </div>

      {/* Sources de données officielles */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[var(--color-crimson)]" />
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
            Sources de données officielles
          </h2>
        </div>

        {TIERS.map((tier) => (
          <div key={tier}>
            <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] mb-3">
              {TIER_LABELS[tier]}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DATA_SOURCES.filter((s) => s.tier === tier).map((s) => (
                <div
                  key={s.id}
                  className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-[var(--color-charcoal)]">
                        {s.name}
                      </h3>
                      <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">
                        {s.operator}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded font-sans text-xs font-medium shrink-0 ${STATUS_STYLES[s.status]}`}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="font-sans text-sm text-[var(--color-slate)] leading-relaxed">
                    {s.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                    {s.domains.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]"
                      >
                        {d}
                      </span>
                    ))}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sans text-xs text-[var(--color-crimson)] hover:underline ml-auto"
                    >
                      Portail officiel <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Partenaires stratégiques */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={18} className="text-[var(--color-crimson)]" />
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
            Partenaires stratégiques
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STRATEGIC_PARTNERS.map((p) => (
            <div
              key={p.name}
              className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-5 flex flex-col gap-3"
            >
              <h3 className="font-display text-base font-bold text-[var(--color-charcoal)]">
                {p.name}
              </h3>
              <p className="font-sans text-sm text-[var(--color-slate)] leading-relaxed">{p.role}</p>
              <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]"
                  >
                    {t}
                  </span>
                ))}
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-sans text-xs text-[var(--color-crimson)] hover:underline ml-auto"
                >
                  Site officiel <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-4">
        Les données intégrées proviennent de portails publics officiels. Les autres sources sont
        référencées pour clarifier l'écosystème institutionnel et renvoient vers les sites originaux.
        La mention d'une institution ne vaut pas endossement de cette plateforme par celle-ci.
      </p>
    </div>
  );
}
