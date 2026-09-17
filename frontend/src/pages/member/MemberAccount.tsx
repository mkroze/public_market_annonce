import { useEffect, useState } from "react";
import { Building2, KeyRound, Loader2, Palette, ShieldCheck, UserRound } from "lucide-react";
import { changePassword, getAccount, updateAccountPreferences, updateAccountProfile } from "../../lib/api";
import type {
  AccountProfile,
  CompanyProfile,
  LegalForm,
  RevenueBand,
  SizeBand,
  ThemePreference,
} from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { applyThemePreference } from "../../lib/theme";
import EligibilityWizard from "./EligibilityWizard";

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "Système", description: "Suit les préférences de votre appareil." },
  { value: "light", label: "Clair", description: "Interface claire en permanence." },
  { value: "dark", label: "Sombre", description: "Interface sombre en permanence." },
];

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

const SIZE_BANDS: { value: SizeBand; label: string }[] = [
  { value: "micro", label: "Micro (< 10)" },
  { value: "tpe", label: "TPE / Auto-entrepreneur" },
  { value: "pme", label: "PME (10 – 200)" },
  { value: "eti", label: "ETI" },
  { value: "grande", label: "Grande entreprise" },
];

const REVENUE_BANDS: { value: RevenueBand; label: string }[] = [
  { value: "lt_1m", label: "< 1 M MAD" },
  { value: "1m_10m", label: "1 – 10 M MAD" },
  { value: "10m_50m", label: "10 – 50 M MAD" },
  { value: "50m_200m", label: "50 – 200 M MAD" },
  { value: "gt_200m", label: "> 200 M MAD" },
];

const EMPTY_PROFILE: CompanyProfile = {
  legal_form: "",
  ice: "",
  rc_number: "",
  rc_city: "",
  if_number: "",
  cnss_number: "",
  patente_number: "",
  hq_city: "",
  sectors: [],
  categories: [],
  qualifications: [],
  certifications: [],
  coverage_regions: [],
  keywords: "",
  size_band: "",
  revenue_band: "",
  contract_min: null,
  contract_max: null,
  bids_in_groupement: false,
  preferred_procedures: [],
  eligibility_filter_default: false,
};

const CATEGORY_OPTIONS = ["Travaux", "Fournitures", "Services"];

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function MemberAccount() {
  const { updateUser } = useAuth();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [showIdentifiers, setShowIdentifiers] = useState(false);

  useEffect(() => {
    getAccount()
      .then((loaded) => {
        setAccount(loaded);
        applyThemePreference(loaded.theme);
        updateUser(loaded);
        if (loaded.profile) {
          setProfile({ ...EMPTY_PROFILE, ...loaded.profile });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function patchProfile(patch: Partial<CompanyProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  function handleWizardSaved(updated: AccountProfile) {
    setAccount(updated);
    updateUser(updated);
    if (updated.profile) setProfile({ ...EMPTY_PROFILE, ...updated.profile });
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setProfileSaving(true);
    try {
      const updated = await updateAccountProfile(profile);
      setAccount(updated);
      updateUser(updated);
      if (updated.profile) setProfile({ ...EMPTY_PROFILE, ...updated.profile });
      setProfileMessage("Profil entreprise enregistré.");
    } catch (err: any) {
      setProfileError(err?.message || "Impossible d'enregistrer le profil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleTheme(theme: ThemePreference) {
    setThemeSaving(true);
    setThemeMessage("");
    applyThemePreference(theme);
    try {
      const updated = await updateAccountPreferences({ theme });
      setAccount(updated);
      updateUser(updated);
      setThemeMessage("Préférence de thème enregistrée.");
    } catch {
      setThemeMessage("Impossible d'enregistrer le thème.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordDraft.new_password.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: passwordDraft.current_password,
        new_password: passwordDraft.new_password,
      });
      setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordMessage("Mot de passe mis à jour.");
    } catch (err: any) {
      setPasswordError(err?.message || "Impossible de modifier le mot de passe.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
        Impossible de charger vos préférences.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Compte</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <UserRound size={22} aria-hidden />
          Profil & préférences
        </h1>
      </header>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Aperçu du compte</h2>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Nom</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.name || "Non renseigné"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Email</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Organisation</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.company || "Non renseignée"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Offre</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.plan || "free"}</dd>
          </div>
        </dl>
      </section>

      <EligibilityWizard account={account} onSaved={handleWizardSaved} />

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Profil entreprise — édition détaillée</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Ces informations restent privées. Elles facilitent vos procédures légales et permettent
          d'afficher un catalogue épuré des consultations pour lesquelles votre entreprise est éligible.
        </p>
        <form onSubmit={handleProfileSubmit} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--color-ink)]">Forme juridique</span>
              <select
                className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                value={profile.legal_form}
                onChange={(e) => patchProfile({ legal_form: e.target.value as CompanyProfile["legal_form"] })}
              >
                <option value="">Non renseignée</option>
                {LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--color-ink)]">Ville / siège</span>
              <input
                type="text"
                className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                value={profile.hq_city}
                onChange={(e) => patchProfile({ hq_city: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--color-ink)]">Effectif</span>
              <select
                className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                value={profile.size_band}
                onChange={(e) => patchProfile({ size_band: e.target.value as CompanyProfile["size_band"] })}
              >
                <option value="">Non renseigné</option>
                {SIZE_BANDS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--color-ink)]">Chiffre d'affaires annuel</span>
              <select
                className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                value={profile.revenue_band}
                onChange={(e) => patchProfile({ revenue_band: e.target.value as CompanyProfile["revenue_band"] })}
              >
                <option value="">Non renseigné</option>
                {REVENUE_BANDS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[var(--color-ink)]">Types de prestation</legend>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_OPTIONS.map((cat) => {
                const checked = profile.categories.includes(cat);
                return (
                  <label key={cat} className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={checked}
                      onChange={(e) =>
                        patchProfile({
                          categories: e.target.checked
                            ? [...profile.categories, cat]
                            : profile.categories.filter((c) => c !== cat),
                        })
                      }
                    />
                    {cat}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Secteurs d'activité (codes, séparés par des virgules)</span>
            <input
              type="text"
              placeholder="1.12, 1.10"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={profile.sectors.join(", ")}
              onChange={(e) => patchProfile({ sectors: splitList(e.target.value) })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Couverture géographique (régions, séparées par des virgules)</span>
            <input
              type="text"
              placeholder="Casablanca-Settat, Rabat-Salé-Kénitra"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={profile.coverage_regions.join(", ")}
              onChange={(e) => patchProfile({ coverage_regions: splitList(e.target.value) })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Certifications (séparées par des virgules)</span>
            <input
              type="text"
              placeholder="ISO 9001, ISO 14001"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={profile.certifications.join(", ")}
              onChange={(e) => patchProfile({ certifications: splitList(e.target.value) })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Mots-clés / produits</span>
            <input
              type="text"
              placeholder="voirie, assainissement"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={profile.keywords}
              onChange={(e) => patchProfile({ keywords: e.target.value })}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={profile.bids_in_groupement}
                onChange={(e) => patchProfile({ bids_in_groupement: e.target.checked })}
              />
              Je peux candidater en groupement
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={profile.eligibility_filter_default}
                onChange={(e) => patchProfile({ eligibility_filter_default: e.target.checked })}
              />
              Afficher par défaut le catalogue épuré (consultations éligibles)
            </label>
          </div>

          <div className="rounded-lg border border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={() => setShowIdentifiers((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--color-ink)]"
              aria-expanded={showIdentifiers}
            >
              Identifiants légaux (ICE, RC, IF, CNSS, patente)
              <span className="text-[var(--color-muted)]">{showIdentifiers ? "−" : "+"}</span>
            </button>
            {showIdentifiers && (
              <div className="grid gap-4 border-t border-[var(--color-border-subtle)] p-4 sm:grid-cols-2">
                {([
                  ["ice", "ICE"],
                  ["rc_number", "Registre de Commerce (RC)"],
                  ["rc_city", "Ville du RC"],
                  ["if_number", "Identifiant Fiscal (IF)"],
                  ["cnss_number", "N° CNSS"],
                  ["patente_number", "N° Patente / TP"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="grid gap-1.5">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
                    <input
                      type="text"
                      className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                      value={profile[field]}
                      onChange={(e) => patchProfile({ [field]: e.target.value } as Partial<CompanyProfile>)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {profileError && <p className="text-sm text-[var(--color-danger)]">{profileError}</p>}
          {profileMessage && <p className="text-sm text-[var(--color-success)]">{profileMessage}</p>}
          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {profileSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Enregistrer le profil
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Thème</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Préférence de thème">
          {themes.map((theme) => {
            const active = account.theme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleTheme(theme.value)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                }`}
              >
                <span className="font-semibold text-[var(--color-ink)]">{theme.label}</span>
                <span className="mt-1 block text-sm text-[var(--color-muted)]">{theme.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 min-h-5 text-sm text-[var(--color-muted)]">
          {themeSaving ? "Enregistrement..." : themeMessage}
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Mot de passe</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="mt-4 grid max-w-2xl gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Mot de passe actuel</span>
            <input
              type="password"
              autoComplete="current-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.current_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, current_password: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.new_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, new_password: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Confirmer le nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.confirm_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, confirm_password: e.target.value }))}
            />
          </label>
          {passwordError && <p className="text-sm text-[var(--color-danger)]">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-[var(--color-success)]">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSaving}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Mettre à jour le mot de passe
          </button>
        </form>
      </section>
    </div>
  );
}
