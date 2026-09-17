import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { getUserDetail, overrideUserProfile, ApiError } from "../api";
import type { AdminUserDetail } from "../types";
import type { CompanyProfile, LegalForm, SizeBand, StandingVerdict } from "../../lib/types";

const LEGAL_FORMS: { value: LegalForm | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "auto_entrepreneur", label: "Auto-entrepreneur" },
  { value: "personne_physique", label: "Personne physique" },
  { value: "sarl", label: "SARL" }, { value: "sarl_au", label: "SARL AU" },
  { value: "sa", label: "SA" }, { value: "sas", label: "SAS" }, { value: "snc", label: "SNC" },
  { value: "cooperative", label: "Coopérative" }, { value: "gie", label: "GIE" },
  { value: "association", label: "Association" }, { value: "autre", label: "Autre" },
];
const SIZE_BANDS: { value: SizeBand | ""; label: string }[] = [
  { value: "", label: "—" }, { value: "micro", label: "Micro" }, { value: "tpe", label: "TPE" },
  { value: "pme", label: "PME" }, { value: "eti", label: "ETI" }, { value: "grande", label: "Grande entreprise" },
];
const CATEGORIES = ["Travaux", "Fournitures", "Services"];

const VERDICT_STYLE: Record<StandingVerdict, { label: string; cls: string }> = {
  clear: { label: "Clear", cls: "text-[var(--color-emerald,#047857)]" },
  risk: { label: "À clarifier", cls: "text-[var(--color-gold)]" },
  blocked: { label: "Exclusion", cls: "text-[var(--color-crimson)]" },
  unknown: { label: "Inconnu", cls: "text-[var(--color-slate)]" },
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]/50 px-2 py-0.5 text-xs text-[var(--color-charcoal)]">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">{label}</div>
      <div className="mt-0.5 text-sm text-[var(--color-charcoal)]">{children}</div>
    </div>
  );
}

export default function UserClassificationDetail({
  userId,
  canEdit,
  onChanged,
}: {
  userId: number;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [legalForm, setLegalForm] = useState<LegalForm | "">("");
  const [sizeBand, setSizeBand] = useState<SizeBand | "">("");
  const [sectorsCsv, setSectorsCsv] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [groupement, setGroupement] = useState(false);

  const seed = useCallback((d: AdminUserDetail) => {
    setDetail(d);
    setLegalForm(d.profile.legal_form);
    setSizeBand(d.profile.size_band);
    setSectorsCsv((d.profile.sectors ?? []).join(", "));
    setCategories(d.profile.categories ?? []);
    setGroupement(Boolean(d.profile.bids_in_groupement));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserDetail(userId)
      .then((d) => { if (!cancelled) { seed(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, seed]);

  async function save() {
    setSaving(true);
    setMsg("");
    const patch: Partial<CompanyProfile> = {
      legal_form: legalForm,
      size_band: sizeBand,
      sectors: sectorsCsv.split(",").map((s) => s.trim()).filter(Boolean),
      categories,
      bids_in_groupement: groupement,
    };
    try {
      const updated = await overrideUserProfile(userId, patch);
      seed(updated);
      setMsg("Profil mis à jour.");
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-sm text-[var(--color-slate)]">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Chargement du profil…
      </div>
    );
  }
  if (error || !detail) {
    return <div className="px-4 py-4 text-sm text-[var(--color-crimson)]">{error || "Introuvable"}</div>;
  }

  const c = detail.classification;
  const verdict = VERDICT_STYLE[c.standing.verdict];
  const cap = c.capacity_scale;
  const pct = Math.round((c.completeness || 0) * 100);
  const inputCls =
    "select select-bordered select-sm w-full font-sans bg-base-100 border-[var(--color-border-subtle)] rounded";

  return (
    <div className="grid gap-5 bg-[var(--color-ivory-dim)]/30 px-4 py-4 lg:grid-cols-2">
      {/* Derived classification (read-only) */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">
            Classification déduite
          </h3>
          <span className="text-xs font-bold tabular-nums text-[var(--color-slate)]">{pct}% complété</span>
        </div>
        {c.summary && <p className="mt-1 text-sm font-medium text-[var(--color-charcoal)]">{c.summary}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Types de prestation">
            {c.activity_fit.categories.length ? (
              <span className="flex flex-wrap gap-1">
                {c.activity_fit.categories.map((cat) => <Chip key={cat}>{cat}</Chip>)}
                {c.activity_fit.categories_source === "derived" && (
                  <span className="text-[11px] italic text-[var(--color-slate)]">déduit</span>
                )}
              </span>
            ) : "—"}
          </Field>
          <Field label="Statut PME">
            {cap.is_pme == null ? "—" : cap.is_pme ? "Éligible lots réservés PME" : "Hors plafond PME"}
          </Field>
          <Field label="Chiffre d'affaires">
            {cap.revenue_band_label || "—"}
            {cap.revenue_band_source === "derived" && (
              <span className="ml-1 text-[11px] italic text-[var(--color-slate)]">déduit</span>
            )}
          </Field>
          <Field label="Fourchette de marché">
            {cap.contract_ceiling != null ? `≤ ${cap.contract_ceiling.toLocaleString("fr-MA")} MAD` : "—"}
          </Field>
          <Field label="Région (siège)">{c.legal_identity.hq_region || "—"}</Field>
          <Field label="Standing (art. 27)">
            <span className={`font-semibold ${verdict.cls}`}>{verdict.label}</span>
          </Field>
        </div>
        {c.qualifications.candidate_families.length > 0 && (
          <div className="mt-3">
            <Field label="Qualifications probables à déclarer">
              <span className="text-[var(--color-gold)]">{c.qualifications.candidate_families.join(" ; ")}</span>
            </Field>
          </div>
        )}
      </div>

      {/* Override form */}
      <div>
        <h3 className="font-sans font-semibold text-sm text-[var(--color-charcoal)]">
          Corriger le profil {canEdit ? "" : "(lecture seule)"}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">Forme juridique</span>
            <select className={inputCls} disabled={!canEdit} value={legalForm}
              onChange={(e) => setLegalForm(e.target.value as LegalForm | "")}>
              {LEGAL_FORMS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">Taille</span>
            <select className={inputCls} disabled={!canEdit} value={sizeBand}
              onChange={(e) => setSizeBand(e.target.value as SizeBand | "")}>
              {SIZE_BANDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">Secteurs (codes, séparés par des virgules)</span>
            <input type="text" disabled={!canEdit} value={sectorsCsv} placeholder="1.12, 3.1"
              onChange={(e) => setSectorsCsv(e.target.value)}
              className="input input-bordered input-sm w-full font-sans bg-base-100 border-[var(--color-border-subtle)] rounded" />
          </label>
          <div className="sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">Types de prestation</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {CATEGORIES.map((cat) => (
                <label key={cat} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-charcoal)]">
                  <input type="checkbox" className="checkbox checkbox-xs" disabled={!canEdit}
                    checked={categories.includes(cat)}
                    onChange={(e) => setCategories((cur) => e.target.checked ? [...cur, cat] : cur.filter((x) => x !== cat))} />
                  {cat}
                </label>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 text-sm text-[var(--color-charcoal)] sm:col-span-2">
            <input type="checkbox" className="checkbox checkbox-xs" disabled={!canEdit}
              checked={groupement} onChange={(e) => setGroupement(e.target.checked)} />
            Peut candidater en groupement
          </label>
        </div>
        {canEdit && (
          <div className="mt-3 flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
              Enregistrer
            </button>
            {msg && <span className="text-xs text-[var(--color-slate)]">{msg}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
