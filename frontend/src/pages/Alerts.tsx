import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";

const PRIMARY_PILL =
  "inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline shadow-[0_14px_34px_-24px_rgba(0,35,111,0.8)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

// Beta: daily is the only cadence the digest job honors, so the UI doesn't
// offer a choice. The draft still carries frequency: "daily" for the backend.
const CONTROL_CLASS =
  "w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)]";

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none ${
    active
      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
      : "border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-border)]"
  }`;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

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
  const [searchParams] = useSearchParams();
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

  // Préremplissage depuis une recherche ou une consultation : quand la page est
  // ouverte avec des filtres dans l'URL (q, sector, location, entity, tender),
  // on ouvre directement l'éditeur en mode création avec ces critères, pour ne
  // pas obliger l'utilisateur à ressaisir des codes secteur de mémoire.
  useEffect(() => {
    const keyword = searchParams.get("q") || "";
    const sector = searchParams.get("sector") || "";
    const location = searchParams.get("location") || "";
    const entity = searchParams.get("entity") || "";
    const tender = searchParams.get("tender") || "";

    if (keyword || sector || location || entity || tender) {
      setEditingId(null);
      setPreview(null);
      setDraft({
        ...EMPTY_DRAFT,
        name: tender ? "Alerte similaire à cette consultation" : "Alerte depuis ma recherche",
        keywords: keyword,
        sectors: sector,
        regions: location,
      });
      setOpen(true);
    }
  }, [searchParams]);

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
    <form onSubmit={handleSave} className={`${FRAME} space-y-4 p-5`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">
          {editingId === null ? "Nouvelle alerte" : "Modifier l'alerte"}
        </h3>
        <button
          type="button"
          onClick={closeEditor}
          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-ink)] motion-reduce:transition-none"
          aria-label="Fermer l'éditeur"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <label className="block space-y-1.5">
        <span className={LABEL}>Nom de l'alerte</span>
        <input
          type="text"
          className={CONTROL_CLASS}
          placeholder="Ex. Travaux BTP à Casablanca"
          value={draft.name}
          onChange={(e) => patchDraft({ name: e.target.value })}
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className={LABEL}>Domaines d'activité</legend>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-2.5">
          {(options?.sectors || []).map((sector) => (
            <button
              type="button"
              key={sector.code}
              aria-pressed={csvHas(draft.sectors, sector.code)}
              onClick={() => patchDraft({ sectors: toggleCsv(draft.sectors, sector.code) })}
              className={chipClass(csvHas(draft.sectors, sector.code))}
            >
              {sector.name}
            </button>
          ))}
          {!options?.sectors?.length && (
            <span className="text-xs text-[var(--color-muted)]">Aucun domaine disponible.</span>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)]">Laissez vide pour recevoir tous les domaines.</p>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className={LABEL}>Régions</legend>
        <div className="flex flex-wrap gap-1.5">
          {(options?.regions || []).map((region) => (
            <button
              type="button"
              key={region}
              aria-pressed={csvHas(draft.regions, region)}
              onClick={() => patchDraft({ regions: toggleCsv(draft.regions, region) })}
              className={chipClass(csvHas(draft.regions, region))}
            >
              {region}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted)]">Laissez vide pour recevoir toutes les régions.</p>
      </fieldset>

      <label className="block space-y-1.5">
        <span className={LABEL}>Mots-clés</span>
        <input
          type="text"
          className={CONTROL_CLASS}
          placeholder="route, voirie, assainissement (séparés par des virgules)"
          value={draft.keywords}
          onChange={(e) => patchDraft({ keywords: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className={LABEL}>Budget min. (MAD)</span>
          <input
            type="text"
            inputMode="numeric"
            className={CONTROL_CLASS}
            placeholder="0"
            value={draft.min_budget}
            onChange={(e) => patchDraft({ min_budget: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={LABEL}>Budget max. (MAD)</span>
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
          <span className={LABEL}>Fréquence</span>
          <div className={`${CONTROL_CLASS} flex cursor-default items-center text-[var(--color-muted)]`} aria-readonly="true">
            Quotidien · 07:00 (heure du Maroc)
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={draft.enabled}
          onChange={(e) => patchDraft({ enabled: e.target.checked })}
        />
        <span className="text-sm text-[var(--color-ink)]">Alerte active (recevoir les emails)</span>
      </label>

      {/* Aperçu en direct */}
      <div className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          {previewLoading ? (
            <>
              <Loader2 size={14} className="animate-spin text-[var(--color-muted)]" />
              <span className="text-[var(--color-muted)]">Calcul des correspondances…</span>
            </>
          ) : (
            <span>
              <strong className="text-[var(--color-primary)]">{preview?.count ?? 0}</strong>{" "}
              consultation{(preview?.count ?? 0) > 1 ? "s" : ""} correspondent actuellement à ces critères.
            </span>
          )}
        </div>
        {preview && preview.sample.length > 0 && (
          <ul className="mt-2 space-y-1">
            {preview.sample.map((t) => (
              <li key={t.id} className="truncate text-xs text-[var(--color-muted)]">
                <Link
                  to={`/tenders/${encodeURIComponent(t.id)}`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  {t.title}
                </Link>{" "}
                — {t.entity} · {t.location}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 pt-1">
        <button
          type="button"
          onClick={handleTestEmail}
          disabled={testingEmail}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-50 motion-reduce:transition-none"
        >
          {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Email de test
        </button>
        <button
          type="button"
          onClick={closeEditor}
          className="text-sm font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] motion-reduce:transition-none"
        >
          Annuler
        </button>
        <button type="submit" disabled={saving} className={PRIMARY_PILL}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {editingId === null ? "Créer l'alerte" : "Enregistrer"}
        </button>
      </div>
    </form>
  );

  const showCreateCta = !open && alerts.length === 0;

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 px-3 py-3 sm:px-5 sm:py-4"}>
      {!embedded && <Breadcrumbs items={[{ label: "Compte" }, { label: "Mes alertes" }]} />}

      {/* Header */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold text-[var(--color-ink)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                <Bell size={16} aria-hidden="true" />
              </span>
              Mes alertes
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
              Chaque matin à 07:00 (heure du Maroc), un récapitulatif des nouvelles consultations qui
              correspondent à vos critères — uniquement s'il y en a.
            </p>
          </div>
          {showCreateCta && (
            <button type="button" onClick={startCreate} className={PRIMARY_PILL}>
              <Plus size={16} aria-hidden="true" />
              Nouvelle alerte
            </button>
          )}
        </div>
      ) : (
        <section className={FRAME} aria-labelledby="alerts-title">
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-7 sm:px-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
                <Bell size={14} aria-hidden="true" />
                Veille personnalisée
              </div>
              <h1
                id="alerts-title"
                className="mt-4 text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
              >
                Mes <Pill>alertes</Pill>.
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">
                Définissez votre alerte par domaine, région, mots-clés et budget. Chaque matin à 07:00
                (heure du Maroc), nous vous envoyons un récapitulatif des nouvelles consultations
                correspondantes — uniquement s'il y en a.
              </p>
            </div>
            {showCreateCta && (
              <button type="button" onClick={startCreate} className={PRIMARY_PILL}>
                <Plus size={16} aria-hidden="true" />
                Nouvelle alerte
              </button>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
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
                <button type="button" onClick={startCreate} className={PRIMARY_PILL}>
                  <Plus size={16} aria-hidden="true" />
                  Créer une alerte
                </button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <div
                    className={`rounded-2xl border bg-[var(--color-surface)] p-4 shadow-card transition-colors motion-reduce:transition-none ${
                      editingId === alert.id
                        ? "border-[var(--color-primary)]"
                        : "border-[var(--color-border-subtle)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-[var(--color-ink)]">{alert.name}</h3>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {csvList(alert.sectors).length
                            ? `Domaines : ${csvList(alert.sectors).map(sectorName).join(", ")}`
                            : "Tous domaines"}
                          {" · "}
                          {csvList(alert.regions).length
                            ? `Régions : ${csvList(alert.regions).join(", ")}`
                            : "Toutes régions"}
                        </p>
                        {csvList(alert.keywords).length > 0 && (
                          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                            Mots-clés : {csvList(alert.keywords).join(", ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-[var(--color-muted-light)]">
                          {alert.last_sent ? `Dernier envoi : ${alert.last_sent}` : "Aucun envoi pour l'instant"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <label
                          className="mr-1 flex cursor-pointer items-center gap-1.5"
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
                          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-ink)] motion-reduce:transition-none"
                          aria-label={`Modifier ${alert.name}`}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert)}
                          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-danger)] transition-colors hover:border-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] motion-reduce:transition-none"
                          aria-label={`Supprimer ${alert.name}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
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
