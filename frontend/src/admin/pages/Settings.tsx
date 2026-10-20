import { useEffect, useState } from "react";
import { Mail, Send, Save, Loader2, CheckCircle2, Server, SlidersHorizontal, ShieldCheck, RotateCcw } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { can } from "../permissions";
import {
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings,
  ApiError,
} from "../api";
import type { EmailSettings, EmailSettingsPatch } from "../types";
import { PageHeader, GatedButton } from "../components/ui";
import { IndicateursAdministration, PanneauAdministration } from "../components/Administration";
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

  const dirty = Object.keys(draft).some((key) => draft[key as keyof Draft] !== draftFrom(settings)[key as keyof Draft]);

  return (
    <div className="admin-page admin-settings-page">
      <PageHeader title="Paramètres · Email" description="Connexion, expéditeur et vérification · tout pour piloter vos envois depuis le même espace." />
      <div className="admin-page-workspace">
        <IndicateursAdministration items={[
          { label: "Connexion SMTP", value: settings.configured ? "Configurée" : "À configurer", note: settings.configured ? "Envois disponibles" : "Envois désactivés", warning: !settings.configured },
          { label: "Authentification", value: settings.password_set ? "Définie" : "Non définie", note: "Clé SMTP conservée côté serveur" },
          { label: "Port du serveur", value: settings.smtp_port || "—", note: settings.smtp_host || "Aucun serveur enregistré" },
          { label: "Votre accès", value: canManage ? "Gestion" : "Lecture seule", note: canManage ? "Configuration et tests disponibles" : "Paramètres consultables" },
        ]} />
        <form onSubmit={handleSave} className="admin-settings-grid">
          <PanneauAdministration title="Serveur SMTP" icon={Server} aside="Connexion sécurisée" className="admin-settings-server">
            <div className="admin-fields-grid">
              <label className="admin-field admin-field-full"><span>Hôte SMTP</span><input className={CONTROL} placeholder="smtp-relay.brevo.com" value={draft.smtp_host} disabled={!canManage || saving} onChange={(e) => patch({ smtp_host: e.target.value })} /></label>
              <label className="admin-field"><span>Port</span><input className={CONTROL} inputMode="numeric" placeholder="587" value={draft.smtp_port} disabled={!canManage || saving} onChange={(e) => patch({ smtp_port: e.target.value })} /></label>
              <label className="admin-field"><span>Utilisateur / login</span><input className={CONTROL} placeholder="login@votredomaine.ma" value={draft.smtp_user} disabled={!canManage || saving} onChange={(e) => patch({ smtp_user: e.target.value })} /></label>
              <label className="admin-field admin-field-full"><span>Mot de passe (clé SMTP)</span><input className={CONTROL} type="password" autoComplete="new-password" placeholder={settings.password_set ? "•••••••• (laisser vide pour conserver)" : "clé SMTP Brevo"} value={draft.smtp_password} disabled={!canManage || saving} onChange={(e) => patch({ smtp_password: e.target.value })} /><small>Laissez vide pour conserver la clé existante. Elle n’est jamais renvoyée au navigateur.</small></label>
            </div>
          </PanneauAdministration>
          <PanneauAdministration title="Commandes" icon={SlidersHorizontal} aside="Vous gardez la main" className="admin-settings-commands">
            <p className="admin-pane-intro">Enregistrez vos réglages, puis envoyez un email de test pour vérifier la connexion.</p>
            <div className="admin-settings-actions">
              <button type="submit" disabled={!canManage || saving || testing} title={!canManage ? "Vous n'avez pas la permission settings.manage." : undefined} className="admin-primary-button">
                {saving ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}Enregistrer
              </button>
              <GatedButton allowed={canManage && !testing && !saving && settings.configured} reason={!canManage ? "Vous n'avez pas la permission settings.manage." : !settings.configured ? "Configurez et enregistrez le SMTP avant d'envoyer un test." : undefined} onClick={handleTest} className="admin-test-button">
                {testing ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}Envoyer un test
              </GatedButton>
              <button type="button" className="admin-secondary-button" disabled={!canManage || saving || testing || !dirty} onClick={() => setDraft(draftFrom(settings))}><RotateCcw size={14} aria-hidden />Annuler les modifications</button>
            </div>
            <p className={`admin-save-state ${dirty ? "has-changes" : ""}`} role="status">{dirty ? "Modifications non enregistrées" : "Configuration à jour"}</p>
            {!canManage && <p className="admin-pane-intro">Votre rôle permet de consulter ces réglages. La modification nécessite la permission settings.manage.</p>}
          </PanneauAdministration>
          <PanneauAdministration title="Expéditeur" icon={Mail} aside="Identité des emails" className="admin-settings-sender">
            <div className="admin-fields-grid">
              <label className="admin-field"><span>Adresse d'expédition</span><input className={CONTROL} placeholder="alertes@votredomaine.ma" value={draft.smtp_from} disabled={!canManage || saving} onChange={(e) => patch({ smtp_from: e.target.value })} /></label>
              <label className="admin-field"><span>Nom affiché</span><input className={CONTROL} placeholder="Marchés Publics Maroc" value={draft.smtp_from_name} disabled={!canManage || saving} onChange={(e) => patch({ smtp_from_name: e.target.value })} /></label>
            </div>
          </PanneauAdministration>
          <PanneauAdministration title="État des envois" icon={ShieldCheck} aside="Configuration enregistrée" className="admin-settings-status">
            <div className={`admin-connection-status ${settings.configured ? "is-ready" : ""}`}>
              {settings.configured ? <CheckCircle2 size={19} aria-hidden /> : <Mail size={19} aria-hidden />}
              <div><strong>{settings.configured ? "SMTP configuré — les envois sont actifs." : "SMTP non configuré — les envois sont désactivés."}</strong><p>Mot de passe : {settings.password_set ? "défini" : "non défini"}</p></div>
            </div>
            <p className="admin-pane-intro">L’email de test est envoyé avec la configuration enregistrée. Les modifications du formulaire doivent être enregistrées avant le test.</p>
          </PanneauAdministration>
        </form>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
