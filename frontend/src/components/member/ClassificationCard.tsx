import { CheckCircle2, HelpCircle, ShieldAlert, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import type { EligibilityClassification, StandingVerdict } from "../../lib/types";
import { sectorName } from "../../lib/sectors";

const VERDICTS: Record<StandingVerdict, { icon: typeof ShieldCheck; label: string; className: string }> = {
  clear: { icon: ShieldCheck, label: "Aucune exclusion déclarée", className: "text-[var(--color-success)]" },
  risk: { icon: ShieldAlert, label: "Point à clarifier (art. 27)", className: "text-[var(--color-warning)]" },
  blocked: { icon: ShieldX, label: "Cause d'exclusion déclarée", className: "text-[var(--color-danger)]" },
  unknown: { icon: HelpCircle, label: "Standing non renseigné", className: "text-[var(--color-muted)]" },
};

/** A small "derived" pill marking a value the platform inferred rather than one
 * the user declared — so the decision-support boundary stays visible. */
function DerivedPill() {
  return (
    <span className="ml-1.5 rounded-full bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
      déduit
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <span className="text-right text-sm text-[var(--color-ink)]">{children}</span>
    </div>
  );
}

const MAD = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 });

export default function ClassificationCard({ c }: { c: EligibilityClassification }) {
  const verdict = VERDICTS[c.standing.verdict];
  const VerdictIcon = verdict.icon;
  const pct = Math.round((c.completeness || 0) * 100);
  const cap = c.capacity_scale;
  const empty = !c.summary && c.completeness === 0;

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--color-primary)]" aria-hidden />
        <h3 className="text-base font-bold text-[var(--color-ink)]">Votre classification d'éligibilité</h3>
      </div>

      {empty ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Renseignez votre profil pour obtenir une classification et un catalogue épuré des consultations
          éligibles.
        </p>
      ) : (
        <>
          {c.summary && <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">{c.summary}</p>}

          <div className="mt-3">
            <div className="flex items-baseline justify-between text-xs text-[var(--color-muted)]">
              <span>Complétude du profil</span>
              <span className="font-bold tabular-nums text-[var(--color-primary)]">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
              <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
            {c.legal_identity.legal_form_label && (
              <Row label="Forme juridique">
                {c.legal_identity.legal_form_label}
                {c.legal_identity.hq_region && (
                  <span className="text-[var(--color-muted)]"> · {c.legal_identity.hq_region}</span>
                )}
              </Row>
            )}

            {c.activity_fit.categories.length > 0 && (
              <Row label="Types de prestation">
                {c.activity_fit.categories.join(" · ")}
                {c.activity_fit.categories_source === "derived" && <DerivedPill />}
              </Row>
            )}

            {c.activity_fit.sectors.length > 0 && (
              <Row label="Secteurs">
                <span className="text-[var(--color-muted)]">
                  {c.activity_fit.sectors.map((code) => sectorName(code)).join(", ")}
                </span>
              </Row>
            )}

            {(cap.size_band_label || cap.is_pme != null) && (
              <Row label="Capacité">
                {cap.size_band_label}
                {cap.is_pme != null && (
                  <span className={cap.is_pme ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                    {" "}
                    · {cap.is_pme ? "éligible lots réservés PME" : "hors plafond PME"}
                  </span>
                )}
              </Row>
            )}

            {cap.revenue_band_label && (
              <Row label="Chiffre d'affaires">
                {cap.revenue_band_label}
                {cap.revenue_band_source === "derived" && <DerivedPill />}
              </Row>
            )}

            {cap.contract_ceiling != null && (
              <Row label="Fourchette de marché visée">
                ≤ {MAD.format(cap.contract_ceiling)} MAD
                {cap.contract_ceiling_source === "derived" && <DerivedPill />}
              </Row>
            )}

            {c.qualifications.candidate_families.length > 0 && (
              <Row label="Qualifications à déclarer">
                <span className="text-[var(--color-warning)]">
                  {c.qualifications.candidate_families.join(" ; ")}
                </span>
              </Row>
            )}

            <Row label="Standing (art. 27)">
              <span className={`inline-flex items-center gap-1 font-semibold ${verdict.className}`}>
                <VerdictIcon size={14} aria-hidden />
                {verdict.label}
              </span>
            </Row>

            {c.standing.bids_in_groupement && (
              <Row label="Groupement">
                <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                  <CheckCircle2 size={14} aria-hidden /> Candidature en groupement possible
                </span>
              </Row>
            )}
          </div>
        </>
      )}

      <p className="mt-4 border-t border-[var(--color-border-subtle)] pt-3 text-xs leading-relaxed text-[var(--color-muted-light)]">
        Classification indicative, à titre d'aide à la décision. Les valeurs « déduites » sont estimées à
        partir de vos déclarations et n'engagent pas votre éligibilité légale.
      </p>
    </div>
  );
}
