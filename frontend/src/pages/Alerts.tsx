import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, Check, Eye, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import {
  createAlert,
  deleteAlert,
  getAlerts,
  getFilters,
  getRegions,
  previewAlert,
  testAlertEmail,
  updateAlert,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";
import type { AlertPreference, AlertPreview } from "../lib/types";

const CONTROL_CLASS =
  "w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors";

interface ChipOption {
  value: string;
  label: string;
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded border px-2.5 py-1 font-sans text-xs transition-colors ${
              active
                ? "bg-[var(--color-crimson)] text-white border-[var(--color-crimson)]"
                : "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface AlertFormState {
  name: string;
  keywords: string;
  sectors: string[];
  regions: string[];
  minBudget: string;
  maxBudget: string;
  enabled: boolean;
}

const EMPTY_FORM: AlertFormState = {
  name: "",
  keywords: "",
  sectors: [],
  regions: [],
  minBudget: "",
  maxBudget: "",
  enabled: true,
};

function formToPayload(form: AlertFormState) {
  return {
    name: form.name,
    keywords: form.keywords,
    sectors: form.sectors.join(","),
    regions: form.regions.join(","),
    min_budget: form.minBudget,
    max_budget: form.maxBudget,
    frequency: "daily",
    enabled: form.enabled ? 1 : 0,
  };
}

function splitCsv(value: string): string[] {
  return (value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function Alerts() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tenderContext = {
    tenderId: searchParams.get("tender") || "",
    name: searchParams.get("name") || "",
    sector: searchParams.get("sector") || "",
    region: searchParams.get("region") || "",
  };
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AlertFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sectorOptions, setSectorOptions] = useState<ChipOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<ChipOption[]>([]);
  const [preview, setPreview] = useState<AlertPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  function addToast(message: string, type: ToastData["type"] = "info") {
    setToasts((prev) => [...prev, createToast(message, type)]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    getFilters()
      .then((res) =>
        setSectorOptions(res.sectors.map((s) => ({ value: s.code, label: s.name }))),
      )
      .catch(() => {});
    getRegions()
      .then((res) =>
        setRegionOptions(res.regions.map((r) => ({ value: r.name, label: r.name }))),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || !tenderContext.tenderId) return;
    setForm({
      ...EMPTY_FORM,
      name: tenderContext.name ? `Opportunites similaires - ${tenderContext.name.slice(0, 60)}` : "Opportunites similaires",
      sectors: tenderContext.sector ? [tenderContext.sector] : [],
      regions: tenderContext.region ? [tenderContext.region] : [],
    });
    setEditingId(null);
    setPreview(null);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenderContext.tenderId]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch {
      addToast("Erreur lors du chargement des alertes", "error");
    } finally {
      setLoading(false);
    }
  }

  function updateForm(patch: Partial<AlertFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setPreview(null);
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPreview(null);
    setShowForm(true);
  }

  function startEdit(alert: AlertPreference) {
    setForm({
      name: alert.name,
      keywords: alert.keywords,
      sectors: splitCsv(alert.sectors),
      regions: splitCsv(alert.regions),
      minBudget: alert.min_budget,
      maxBudget: alert.max_budget,
      enabled: Boolean(alert.enabled),
    });
    setEditingId(alert.id);
    setPreview(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Donnez un nom a votre alerte", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId !== null) {
        await updateAlert(editingId, formToPayload(form));
        addToast("Alerte mise a jour", "success");
      } else {
        await createAlert(formToPayload(form));
        addToast("Alerte creee", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchAlerts();
    } catch {
      addToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      setPreview(await previewAlert(formToPayload(form)));
    } catch {
      addToast("Erreur lors de l'apercu", "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleToggleEnabled(alert: AlertPreference) {
    try {
      await updateAlert(alert.id, { ...alert, enabled: alert.enabled ? 0 : 1 });
      await fetchAlerts();
    } catch {
      addToast("Erreur lors de la mise a jour", "error");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      addToast("Alerte supprimee", "success");
    } catch {
      addToast("Erreur lors de la suppression", "error");
    }
  }

  async function handleTestEmail() {
    try {
      await testAlertEmail();
      addToast("Email de test envoye", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Echec de l'envoi", "error");
    }
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-[var(--color-slate)]" />
          <p className="text-lg mb-4 font-sans text-[var(--color-charcoal)]">
            Connectez-vous pour gerer vos alertes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded bg-[var(--color-crimson)] px-4 py-2 font-sans text-sm font-semibold text-white"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const chipsFor = (alert: AlertPreference): string[] => {
    const sectorLabels = splitCsv(alert.sectors).map(
      (code) => sectorOptions.find((o) => o.value === code)?.label || code,
    );
    const budget =
      alert.min_budget || alert.max_budget
        ? [`Budget: ${alert.min_budget || "0"} - ${alert.max_budget || "∞"} MAD`]
        : [];
    return [
      ...sectorLabels,
      ...splitCsv(alert.regions),
      ...splitCsv(alert.keywords).map((k) => `"${k}"`),
      ...budget,
    ];
  };

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Suivre mes opportunites</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Recevez par email les nouvelles consultations qui ressemblent a ce que vous cherchez.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestEmail}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
          >
            <Send size={14} /> Tester l'email
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--color-crimson)] px-3 py-2 font-sans text-sm font-semibold text-white hover:bg-[var(--color-crimson-dark)]"
          >
            <Plus size={14} /> Nouvelle alerte
          </button>
        </div>
      </div>

      {showForm && (
        <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
              {editingId !== null ? "Modifier l'alerte" : "Nouvelle alerte"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="label-academic text-xs">Nom de l'alerte</span>
                <input
                  type="text"
                  className={CONTROL_CLASS}
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="Ex: BTP Casablanca"
                />
              </label>
              <label className="space-y-1">
                <span className="label-academic text-xs">Mots-cles (separes par des virgules)</span>
                <input
                  type="text"
                  className={CONTROL_CLASS}
                  value={form.keywords}
                  onChange={(e) => updateForm({ keywords: e.target.value })}
                  placeholder="Ex: ecole, construction, amenagement"
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="label-academic text-xs">Secteurs</span>
              <ChipGroup
                options={sectorOptions}
                selected={form.sectors}
                onToggle={(value) => updateForm({ sectors: toggleIn(form.sectors, value) })}
              />
            </div>

            <div className="space-y-1">
              <span className="label-academic text-xs">Regions</span>
              <ChipGroup
                options={regionOptions}
                selected={form.regions}
                onToggle={(value) => updateForm({ regions: toggleIn(form.regions, value) })}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="label-academic text-xs">Budget min (MAD)</span>
                <input
                  type="number"
                  min="0"
                  className={CONTROL_CLASS}
                  value={form.minBudget}
                  onChange={(e) => updateForm({ minBudget: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="label-academic text-xs">Budget max (MAD)</span>
                <input
                  type="number"
                  min="0"
                  className={CONTROL_CLASS}
                  value={form.maxBudget}
                  onChange={(e) => updateForm({ maxBudget: e.target.value })}
                />
              </label>
              <label className="flex items-end gap-2 pb-2 font-sans text-sm text-[var(--color-charcoal)]">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => updateForm({ enabled: e.target.checked })}
                />
                Activee
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 border-t border-[var(--color-border-subtle)] pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded bg-[var(--color-crimson)] px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-[var(--color-crimson-dark)] disabled:opacity-60"
              >
                <Check size={15} /> {editingId !== null ? "Enregistrer" : "Creer l'alerte"}
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-deep)] px-4 py-2 font-sans text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-border)] disabled:opacity-60"
              >
                <Eye size={15} /> {previewLoading ? "Calcul..." : "Apercu"}
              </button>
            </div>

            {preview && (
              <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] p-4">
                <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)]">
                  {preview.count.toLocaleString("fr-FR")} consultations actives correspondent a ces criteres.
                </p>
                {preview.sample.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {preview.sample.map((t) => (
                      <li key={t.id} className="font-sans text-xs text-[var(--color-slate)]">
                        <Link to={`/tenders/${encodeURIComponent(t.id)}`} className="hover:text-[var(--color-crimson)]">
                          {t.title}
                        </Link>{" "}
                        — {t.entity} · {t.location} · limite {t.deadline}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-6 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-[var(--color-slate)]" />
          <p className="font-sans text-sm text-[var(--color-slate)]">
            Aucune alerte configuree. Creez-en une pour recevoir les nouvelles consultations par email.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-[var(--color-charcoal)]">{alert.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide ${
                      alert.enabled
                        ? "bg-[var(--color-crimson)] text-white"
                        : "bg-[var(--color-ivory-deep)] text-[var(--color-slate)]"
                    }`}
                  >
                    {alert.enabled ? "Active" : "En pause"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chipsFor(alert).length > 0 ? (
                    chipsFor(alert).map((chip) => (
                      <span
                        key={chip}
                        className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-2 py-0.5 font-sans text-xs text-[var(--color-charcoal)]"
                      >
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className="font-sans text-xs text-[var(--color-slate)]">
                      Toutes les consultations
                    </span>
                  )}
                </div>
                <p className="mt-1.5 font-sans text-xs text-[var(--color-slate)]">
                  {alert.last_sent
                    ? `Dernier envoi : ${alert.last_sent}`
                    : "Aucun email envoye pour le moment"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(alert)}
                  className="rounded border border-[var(--color-border-subtle)] px-2.5 py-1.5 font-sans text-xs text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                >
                  {alert.enabled ? "Mettre en pause" : "Activer"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(alert)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)] hover:text-[var(--color-crimson)] hover:border-[var(--color-border)]"
                  title="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(alert.id)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)] hover:text-[var(--color-crimson)] hover:border-[var(--color-border)]"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
