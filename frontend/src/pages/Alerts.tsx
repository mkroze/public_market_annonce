import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Plus, Pencil, Trash2, Send, X, Loader2 } from "lucide-react";
import {
  getAlerts,
  getFilters,
  createAlert,
  updateAlert,
  deleteAlert,
  previewAlert,
  testAlertEmail,
} from "../lib/api";
import type { AlertPreference, AlertPreview, FiltersResponse } from "../lib/types";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";

// Brouillon d'édition : les champs du formulaire, alignés sur le contrat backend
// (AlertRequest). Secteurs/régions/mots-clés sont stockés en CSV.
interface AlertDraft {
  name: string;
  sectors: string;
  regions: string;
  keywords: string;
  min_budget: string;
  max_budget: string;
  frequency: string;
  enabled: boolean;
}

const EMPTY_DRAFT: AlertDraft = {
  name: "",
  sectors: "",
  regions: "",
  keywords: "",
  min_budget: "",
  max_budget: "",
  frequency: "daily",
  enabled: true,
};

// Beta: daily is the only cadence the digest job honors, so the UI doesn't
// offer a choice. The draft still carries frequency: "daily" for the backend.
const CONTROL_CLASS =
  "w-full border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] rounded focus:border-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-crimson)] transition-colors";

function csvList(csv: string): string[] {
  return (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function csvHas(csv: string, value: string): boolean {
  return csvList(csv).includes(value);
}

function toggleCsv(csv: string, value: string): string {
  const items = csvList(csv);
  const next = items.includes(value)
    ? items.filter((v) => v !== value)
    : [...items, value];
  return next.join(",");
}

function draftFromAlert(alert: AlertPreference): AlertDraft {
  return {
    name: alert.name || "",
    sectors: alert.sectors || "",
    regions: alert.regions || "",
    keywords: alert.keywords || "",
    min_budget: alert.min_budget || "",
    max_budget: alert.max_budget || "",
    frequency: alert.frequency || "daily",
    enabled: Boolean(alert.enabled),
  };
}

function toPayload(draft: AlertDraft): Partial<AlertPreference> {
  return {
    name: draft.name.trim() || "Mon alerte",
    sectors: draft.sectors,
    regions: draft.regions,
    keywords: draft.keywords,
    min_budget: draft.min_budget.trim(),
    max_budget: draft.max_budget.trim(),
    frequency: draft.frequency,
    // Le backend (Pydantic) accepte 1/0 pour un booléen ; on reste typé number.
    enabled: draft.enabled ? 1 : 0,
  };
}

// Signature des seuls champs qui influencent le matching, pour ne relancer
// l'aperçu que lorsqu'ils changent (le nom / la fréquence n'y touchent pas).
function matchSignature(draft: AlertDraft): string {
  return JSON.stringify([
    csvList(draft.sectors).sort(),
    csvList(draft.regions).sort(),
    csvList(draft.keywords).sort(),
    draft.min_budget.trim(),
    draft.max_budget.trim(),
  ]);
}

export default function Alerts({ embedded = false }: { embedded?: boolean }) {
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Éditeur : `open` indique qu'un formulaire est ouvert ; `editingId` vaut null
  // en création, ou l'id de l'alerte éditée.
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<AlertDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<AlertPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const [toasts, setToasts] = useState<ToastData[]>([]);

  function pushToast(message: string, type: ToastData["type"] = "info") {
    setToasts((current) => [...current, createToast(message, type)]);
  }
  function dismissToast(id: string) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  async function reload() {
    try {
      const { data } = await getAlerts();
      setAlerts(data);
    } catch {
      pushToast("Impossible de charger vos alertes.", "error");
    }
  }

  useEffect(() => {
    Promise.all([getAlerts(), getFilters()])
      .then(([alertsRes, filtersRes]) => {
        setAlerts(alertsRes.data);
        setOptions(filtersRes);
      })
      .catch(() => pushToast("Impossible de charger vos alertes.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const sectorName = useMemo(() => {
    const map = new Map<string, string>();
    options?.sectors.forEach((s) => map.set(s.code, s.name));
    return (code: string) => map.get(code) || code;
  }, [options]);

  // Aperçu en direct : débounce sur les champs de matching pendant l'édition.
  const signature = open ? matchSignature(draft) : "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      previewAlert(toPayload(draft))
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, open]);

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    setOpen(true);
  }

  function startEdit(alert: AlertPreference) {
    setEditingId(alert.id);
    setDraft(draftFromAlert(alert));
    setPreview(null);
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setEditingId(null);
    setPreview(null);
  }

  function patchDraft(patch: Partial<AlertDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result =
        editingId === null
          ? await createAlert(toPayload(draft))
          : await updateAlert(editingId, toPayload(draft));

      // Distinguish "saved + email sent" from "saved, but email failed" so the
      // user knows whether email delivery is actually working.
      const base = editingId === null ? "Alerte créée." : "Alerte mise à jour.";
      const email = result?.email;
      if (email?.attempted && email.delivered) {
        pushToast(`${base} Un email de confirmation vous a été envoyé.`, "success");
      } else if (email?.attempted && !email.delivered) {
        pushToast(
          `${base} L'email de confirmation n'a pas pu être envoyé.`,
          "info",
        );
      } else {
        pushToast(base, "success");
      }
      await reload();
      closeEditor();
    } catch (err: any) {
      // Surfaces the backend detail (e.g. the beta one-alert limit) verbatim.
      pushToast(err?.message || "Échec de l'enregistrement.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(alert: AlertPreference) {
    const next = alert.enabled ? 0 : 1;
    // Mise à jour optimiste, revert en cas d'échec.
    setAlerts((current) =>
      current.map((a) => (a.id === alert.id ? { ...a, enabled: next } : a)),
    );
    try {
      await updateAlert(alert.id, { ...draftFromAlert(alert), enabled: next } as Partial<AlertPreference>);
    } catch {
      setAlerts((current) =>
        current.map((a) => (a.id === alert.id ? { ...a, enabled: alert.enabled } : a)),
      );
      pushToast("Impossible de modifier l'état de l'alerte.", "error");
    }
  }

  async function handleDelete(alert: AlertPreference) {
    if (!window.confirm(`Supprimer l'alerte « ${alert.name} » ?`)) return;
    try {
      await deleteAlert(alert.id);
      if (editingId === alert.id) closeEditor();
      await reload();
      pushToast("Alerte supprimée.", "success");
    } catch {
      pushToast("Échec de la suppression.", "error");
    }
  }

  async function handleTestEmail() {
    setTestingEmail(true);
    try {
      await testAlertEmail();
      pushToast("Email de test envoyé. Vérifiez votre boîte de réception.", "success");
    } catch (err: any) {
      pushToast(err?.message || "Échec de l'envoi de l'email de test.", "error");
    } finally {
      setTestingEmail(false);
    }
  }

  const editor = (
    <form
      onSubmit={handleSave}
      className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5 space-y-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--color-charcoal)]">
          {editingId === null ? "Nouvelle alerte" : "Modifier l'alerte"}
        </h3>
        <button
          type="button"
          onClick={closeEditor}
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Fermer l'éditeur"
        >
          <X size={16} />
        </button>
      </div>

      <label className="space-y-1.5 block">
        <span className="editorial-label text-[var(--color-slate)]">Nom de l'alerte</span>
        <input
          type="text"
          className={CONTROL_CLASS}
          placeholder="Ex. Travaux BTP à Casablanca"
          value={draft.name}
          onChange={(e) => patchDraft({ name: e.target.value })}
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="editorial-label text-[var(--color-slate)]">Domaines d'activité</legend>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] p-2">
          {(options?.sectors || []).map((sector) => {
            const active = csvHas(draft.sectors, sector.code);
            return (
              <button
                type="button"
                key={sector.code}
                aria-pressed={active}
                onClick={() => patchDraft({ sectors: toggleCsv(draft.sectors, sector.code) })}
                className={`px-2 py-1 rounded font-sans text-xs border transition-colors ${
                  active
                    ? "bg-[var(--color-crimson)] text-[var(--color-ivory)] border-[var(--color-crimson)]"
                    : "bg-[var(--color-ivory)] text-[var(--color-charcoal)] border-[var(--color-border-subtle)] hover:border-[var(--color-charcoal)]"
                }`}
              >
                {sector.name}
              </button>
            );
          })}
          {!options?.sectors?.length && (
            <span className="font-sans text-xs text-[var(--color-slate)]">Aucun domaine disponible.</span>
          )}
        </div>
        <p className="font-sans text-xs text-[var(--color-slate)]">
          Laissez vide pour recevoir tous les domaines.
        </p>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="editorial-label text-[var(--color-slate)]">Régions</legend>
        <div className="flex flex-wrap gap-1.5">
          {(options?.regions || []).map((region) => {
            const active = csvHas(draft.regions, region);
            return (
              <button
                type="button"
                key={region}
                aria-pressed={active}
                onClick={() => patchDraft({ regions: toggleCsv(draft.regions, region) })}
                className={`px-2 py-1 rounded font-sans text-xs border transition-colors ${
                  active
                    ? "bg-[var(--color-crimson)] text-[var(--color-ivory)] border-[var(--color-crimson)]"
                    : "bg-[var(--color-ivory)] text-[var(--color-charcoal)] border-[var(--color-border-subtle)] hover:border-[var(--color-charcoal)]"
                }`}
              >
                {region}
              </button>
            );
          })}
        </div>
        <p className="font-sans text-xs text-[var(--color-slate)]">
          Laissez vide pour recevoir toutes les régions.
        </p>
      </fieldset>

      <label className="space-y-1.5 block">
        <span className="editorial-label text-[var(--color-slate)]">Mots-clés</span>
        <input
          type="text"
          className={CONTROL_CLASS}
          placeholder="route, voirie, assainissement (séparés par des virgules)"
          value={draft.keywords}
          onChange={(e) => patchDraft({ keywords: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 block">
          <span className="editorial-label text-[var(--color-slate)]">Budget min. (MAD)</span>
          <input
            type="text"
            inputMode="numeric"
            className={CONTROL_CLASS}
            placeholder="0"
            value={draft.min_budget}
            onChange={(e) => patchDraft({ min_budget: e.target.value })}
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="editorial-label text-[var(--color-slate)]">Budget max. (MAD)</span>
          <input
            type="text"
            inputMode="numeric"
            className={CONTROL_CLASS}
            placeholder="Illimité"
            value={draft.max_budget}
            onChange={(e) => patchDraft({ max_budget: e.target.value })}
          />
        </label>
        <div className="space-y-1.5">
          <span className="editorial-label text-[var(--color-slate)]">Fréquence</span>
          <div
            className={`${CONTROL_CLASS} flex items-center text-[var(--color-slate)] cursor-default`}
            aria-readonly="true"
          >
            Quotidien · 07:00 (heure du Maroc)
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={draft.enabled}
          onChange={(e) => patchDraft({ enabled: e.target.checked })}
        />
        <span className="font-sans text-sm text-[var(--color-charcoal)]">
          Alerte active (recevoir les emails)
        </span>
      </label>

      {/* Aperçu en direct */}
      <div className="border border-dashed border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-3">
        <div className="flex items-center gap-2 font-sans text-sm text-[var(--color-charcoal)]">
          {previewLoading ? (
            <>
              <Loader2 size={14} className="animate-spin text-[var(--color-slate)]" />
              <span className="text-[var(--color-slate)]">Calcul des correspondances…</span>
            </>
          ) : (
            <span>
              <strong className="text-[var(--color-crimson)]">{preview?.count ?? 0}</strong>{" "}
              consultation{(preview?.count ?? 0) > 1 ? "s" : ""} correspondent actuellement à ces critères.
            </span>
          )}
        </div>
        {preview && preview.sample.length > 0 && (
          <ul className="mt-2 space-y-1">
            {preview.sample.map((t) => (
              <li key={t.id} className="font-sans text-xs text-[var(--color-slate)] truncate">
                <Link
                  to={`/tenders/${encodeURIComponent(t.id)}`}
                  className="text-[var(--color-crimson)] hover:underline"
                >
                  {t.title}
                </Link>{" "}
                — {t.entity} · {t.location}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={handleTestEmail}
          disabled={testingEmail}
          className="inline-flex items-center gap-1.5 editorial-label text-[var(--color-slate)] hover:text-[var(--color-charcoal)] disabled:opacity-50"
        >
          {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Email de test
        </button>
        <button
          type="button"
          onClick={closeEditor}
          className="editorial-label text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-crimson)] px-4 py-2 text-sm font-semibold text-[var(--color-ivory)] transition-colors hover:bg-[var(--color-crimson-dark)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {editingId === null ? "Créer l'alerte" : "Enregistrer"}
        </button>
      </div>
    </form>
  );

  return (
    <div className={embedded ? "space-y-6" : "px-4 sm:px-6 py-8"}>
      {!embedded && <Breadcrumbs items={[{ label: "Compte" }, { label: "Mes alertes" }]} className="mb-6" />}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-[var(--color-ink)]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
            <Bell size={16} />
          </span>
          Mes alertes
        </h1>
        {/* Beta: one alert per account — the create action disappears once an
            alert exists, leaving only edit / pause / delete. */}
        {!open && alerts.length === 0 && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-crimson)] px-4 py-2 text-sm font-semibold text-[var(--color-ivory)] transition-colors hover:bg-[var(--color-crimson-dark)]"
          >
            <Plus size={16} />
            Nouvelle alerte
          </button>
        )}
      </div>
      <p className="font-sans text-sm text-[var(--color-slate)] mb-6 max-w-2xl">
        Définissez votre alerte par domaine, région, mots-clés et budget. Chaque matin
        à 07:00 (heure du Maroc), nous vous envoyons un récapitulatif des nouvelles
        consultations qui y correspondent — uniquement s'il y en a.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Éditeur en mode création (au-dessus de la liste) */}
          {open && editingId === null && editor}

          {alerts.length === 0 && !open ? (
            <EmptyState
              size="md"
              icon={Bell}
              title="Aucune alerte pour le moment"
              description="Créez votre première alerte pour être prévenu, chaque matin, des nouvelles consultations qui correspondent à vos critères."
              action={
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] shadow-card transition-colors hover:bg-[var(--color-primary-strong)]"
                >
                  <Plus size={16} />
                  Créer une alerte
                </button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <div
                    className={`border rounded bg-[var(--color-ivory)] p-4 ${
                      editingId === alert.id
                        ? "border-[var(--color-crimson)]"
                        : "border-[var(--color-border-subtle)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-base text-[var(--color-charcoal)] truncate">
                          {alert.name}
                        </h3>
                        <p className="font-sans text-xs text-[var(--color-slate)] mt-1">
                          {csvList(alert.sectors).length
                            ? `Domaines : ${csvList(alert.sectors).map(sectorName).join(", ")}`
                            : "Tous domaines"}
                          {" · "}
                          {csvList(alert.regions).length
                            ? `Régions : ${csvList(alert.regions).join(", ")}`
                            : "Toutes régions"}
                        </p>
                        {csvList(alert.keywords).length > 0 && (
                          <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">
                            Mots-clés : {csvList(alert.keywords).join(", ")}
                          </p>
                        )}
                        <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">
                          {alert.last_sent
                            ? `Dernier envoi : ${alert.last_sent}`
                            : "Aucun envoi pour l'instant"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label
                          className="flex items-center gap-1.5 cursor-pointer mr-1"
                          title={alert.enabled ? "Alerte active" : "Alerte en pause"}
                        >
                          <input
                            type="checkbox"
                            className="toggle toggle-sm"
                            checked={Boolean(alert.enabled)}
                            onChange={() => handleToggle(alert)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => startEdit(alert)}
                          className="btn btn-ghost btn-xs btn-square"
                          aria-label={`Modifier ${alert.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert)}
                          className="btn btn-ghost btn-xs btn-square text-[var(--color-crimson)]"
                          aria-label={`Supprimer ${alert.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Éditeur inline sous l'alerte en cours de modification */}
                  {open && editingId === alert.id && <div className="mt-3">{editor}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
