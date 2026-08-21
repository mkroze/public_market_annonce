import { useEffect, useState } from "react";
import { Mail, Send, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import {
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings,
  ApiError,
} from "../api";
import type { EmailSettings, EmailSettingsPatch } from "../types";
import { PageHeader, Panel, GatedButton } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";
import { useToasts } from "../components/useToasts";
import ToastContainer from "../../components/Toast";

const CONTROL =
  "w-full border border-[var(--color-border-subtle)] bg-base-100 rounded px-3 py-2 text-sm font-sans text-[var(--color-charcoal)] focus:border-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-crimson)] transition-colors disabled:opacity-60";

interface Draft {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_from: string;
  smtp_from_name: string;
  smtp_password: string; // write-only; blank means "leave unchanged"
}

function draftFrom(s: EmailSettings): Draft {
  return {
    smtp_host: s.smtp_host || "",
    smtp_port: s.smtp_port || "",
    smtp_user: s.smtp_user || "",
    smtp_from: s.smtp_from || "",
    smtp_from_name: s.smtp_from_name || "",
    smtp_password: "",
  };
}

export default function Settings() {
  const { user } = useAuth();
  const canManage = can(user?.role, "settings.manage");

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { toasts, push, dismiss } = useToasts();

  function load() {
    setLoading(true);
    getEmailSettings()
      .then((s) => {
        setSettings(s);
        setDraft(draftFrom(s));
        setError(null);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function patch(p: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !canManage) return;
    setSaving(true);
    try {
      const body: EmailSettingsPatch = {
        smtp_host: draft.smtp_host.trim(),
        smtp_port: draft.smtp_port.trim(),
        smtp_user: draft.smtp_user.trim(),
        smtp_from: draft.smtp_from.trim(),
        smtp_from_name: draft.smtp_from_name.trim(),
      };
      // Only send the password when the admin actually typed a new one.
      if (draft.smtp_password) body.smtp_password = draft.smtp_password;

      const updated = await updateEmailSettings(body);
      setSettings(updated);
      setDraft(draftFrom(updated)); // clears the password field
      push(
        updated.password_updated
          ? "Configuration enregistrée (mot de passe mis à jour)."
          : "Configuration enregistrée.",
        "success",
      );
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Échec de l'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!canManage) return;
    setTesting(true);
    try {
      const res = await testEmailSettings();
      push(`Email de test envoyé à ${res.to}.`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Échec de l'envoi du test.", "error");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <LoadingState label="Chargement des paramètres" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={load} />;
  if (!draft || !settings) return null;

  return (
    <div>
      <PageHeader
        title="Paramètres · Email"
        description="Configuration SMTP utilisée pour les alertes et les emails de confirmation. Les variables d'environnement servent de valeurs de repli."
      />

      <div className="max-w-2xl space-y-5">
        <Panel title="Statut">
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-sans">
            <span className="inline-flex items-center gap-1.5">
              {settings.configured ? (
                <CheckCircle2 className="w-4 h-4 text-green-700" aria-hidden />
              ) : (
                <Mail className="w-4 h-4 text-[var(--color-slate)]" aria-hidden />
              )}
              <span className={settings.configured ? "text-[var(--color-charcoal)]" : "text-[var(--color-slate)]"}>
                {settings.configured ? "SMTP configuré — les envois sont actifs." : "SMTP non configuré — les envois sont désactivés."}
              </span>
            </span>
            <span className="text-[var(--color-slate)]">
              Mot de passe : {settings.password_set ? "défini" : "non défini"}
            </span>
          </div>
        </Panel>

        <form onSubmit={handleSave}>
          <Panel title="Serveur SMTP">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 block sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Hôte SMTP</span>
                <input
                  className={CONTROL}
                  placeholder="smtp-relay.brevo.com"
                  value={draft.smtp_host}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_host: e.target.value })}
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="editorial-label text-[var(--color-slate)]">Port</span>
                <input
                  className={CONTROL}
                  inputMode="numeric"
                  placeholder="587"
                  value={draft.smtp_port}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_port: e.target.value })}
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="editorial-label text-[var(--color-slate)]">Utilisateur / login</span>
                <input
                  className={CONTROL}
                  placeholder="login@votredomaine.ma"
                  value={draft.smtp_user}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_user: e.target.value })}
                />
              </label>

              <label className="space-y-1.5 block sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">
                  Mot de passe (clé SMTP)
                </span>
                <input
                  className={CONTROL}
                  type="password"
                  autoComplete="new-password"
                  placeholder={settings.password_set ? "•••••••• (laisser vide pour conserver)" : "clé SMTP Brevo"}
                  value={draft.smtp_password}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_password: e.target.value })}
                />
                <span className="font-sans text-xs text-[var(--color-slate)]">
                  Stocké côté serveur, jamais renvoyé au navigateur. Laissez vide pour conserver la valeur existante.
                </span>
              </label>
            </div>
          </Panel>

          <Panel title="Expéditeur" className="mt-5">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 block">
                <span className="editorial-label text-[var(--color-slate)]">Adresse d'expédition</span>
                <input
                  className={CONTROL}
                  placeholder="alertes@votredomaine.ma"
                  value={draft.smtp_from}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_from: e.target.value })}
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="editorial-label text-[var(--color-slate)]">Nom affiché</span>
                <input
                  className={CONTROL}
                  placeholder="Marchés Publics Maroc"
                  value={draft.smtp_from_name}
                  disabled={!canManage}
                  onChange={(e) => patch({ smtp_from_name: e.target.value })}
                />
              </label>
            </div>
          </Panel>

          <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
            <GatedButton
              allowed={canManage && !testing && settings.configured}
              reason={
                !canManage
                  ? "Vous n'avez pas la permission settings.manage."
                  : !settings.configured
                    ? "Configurez et enregistrez le SMTP avant d'envoyer un test."
                    : undefined
              }
              onClick={handleTest}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
              Envoyer un test
            </GatedButton>

            {/* Native submit button so Enter works; GatedButton is type=button. */}
            <button
              type="submit"
              disabled={!canManage || saving}
              title={!canManage ? "Vous n'avez pas la permission settings.manage." : undefined}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans font-medium rounded text-white bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-dark)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
