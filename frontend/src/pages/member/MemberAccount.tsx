import { useEffect, useState } from "react";
import { KeyRound, Loader2, Palette, ShieldCheck, UserRound } from "lucide-react";
import { changePassword, getAccount, updateAccountPreferences } from "../../lib/api";
import type { AccountProfile, ThemePreference } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { applyThemePreference } from "../../lib/theme";

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "Système", description: "Suit les préférences de votre appareil." },
  { value: "light", label: "Clair", description: "Interface claire en permanence." },
  { value: "dark", label: "Sombre", description: "Interface sombre en permanence." },
];

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

  useEffect(() => {
    getAccount()
      .then((loaded) => {
        setAccount(loaded);
        applyThemePreference(loaded.theme);
        updateUser(loaded);
      })
      .finally(() => setLoading(false));
  }, []);

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
