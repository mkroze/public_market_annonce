import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bell, Trash2, Plus } from "lucide-react";
import { getAlerts, createAlert, deleteAlert } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AlertPreference } from "../lib/types";

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formSectors, setFormSectors] = useState("");
  const [formRegions, setFormRegions] = useState("");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch {
      setError("Erreur lors du chargement des alertes");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createAlert({
        name: formName,
        keywords: formKeywords,
        sectors: formSectors,
        regions: formRegions,
        frequency: formFrequency,
        enabled: 1,
      });
      setFormName("");
      setFormKeywords("");
      setFormSectors("");
      setFormRegions("");
      setFormFrequency("daily");
      setShowForm(false);
      await fetchAlerts();
    } catch {
      setError("Erreur lors de la cr\u00e9ation de l'alerte");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Erreur lors de la suppression");
    }
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-[var(--color-slate)]" />
          <p className="text-lg mb-4 font-sans text-[var(--color-charcoal)]">Connectez-vous pour g&eacute;rer vos alertes.</p>
          <Link to="/login" className="btn btn-primary font-sans font-semibold rounded">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-[var(--color-charcoal)] flex items-center gap-2">
          <Bell className="w-6 h-6 text-[var(--color-crimson)]" />
          Mes alertes
        </h1>
        <button
          className="btn btn-primary btn-sm font-sans font-semibold gap-1 rounded"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4" />
          Nouvelle alerte
        </button>
      </div>

      {error && (
        <div className="border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-crimson)] rounded bg-[var(--color-ivory-dim)] p-3 mb-4">
          <span className="font-sans text-sm text-[var(--color-charcoal)]">{error}</span>
        </div>
      )}

      {showForm && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-6 mb-6">
          <h3 className="font-display text-lg text-[var(--color-charcoal)] mb-4">Nouvelle alerte</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-academic">Nom</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="Mon alerte BTP"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-academic">Mots-cl&eacute;s (s&eacute;par&eacute;s par des virgules)</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="construction, route, b&acirc;timent"
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-academic">Secteurs (codes s&eacute;par&eacute;s par des virgules)</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="T01, T02"
                value={formSectors}
                onChange={(e) => setFormSectors(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-academic">R&eacute;gions (s&eacute;par&eacute;es par des virgules)</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="Casablanca, Rabat"
                value={formRegions}
                onChange={(e) => setFormRegions(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-academic">Fr&eacute;quence</span>
              </label>
              <select
                className="select select-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
              >
                <option value="instant">Instantan&eacute;e</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className={`btn btn-primary font-sans font-semibold rounded ${submitting ? "loading" : ""}`}
                disabled={submitting}
              >
                {submitting ? "Cr\u00e9ation..." : "Cr\u00e9er l'alerte"}
              </button>
              <button
                type="button"
                className="btn btn-ghost font-sans rounded text-[var(--color-slate)]"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-slate)]">
          <Bell className="w-12 h-12 mx-auto mb-4" />
          <p className="font-sans">Aucune alerte configur&eacute;e.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-crimson)] rounded bg-[var(--color-ivory)] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg text-[var(--color-charcoal)]">{alert.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2 text-sm font-sans">
                    {alert.sectors && (
                      <span className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-slate)]">
                        Secteurs: {alert.sectors}
                      </span>
                    )}
                    {alert.regions && (
                      <span className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-slate)]">
                        R&eacute;gions: {alert.regions}
                      </span>
                    )}
                    {alert.keywords && (
                      <span className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-slate)]">
                        Mots-cl&eacute;s: {alert.keywords}
                      </span>
                    )}
                    <span className="border border-[var(--color-crimson)] rounded px-2 py-0.5 text-[var(--color-crimson)]">
                      {alert.frequency === "instant"
                        ? "Instantan\u00e9e"
                        : alert.frequency === "daily"
                        ? "Quotidienne"
                        : "Hebdomadaire"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={!!alert.enabled}
                    readOnly
                    title={alert.enabled ? "Activ\u00e9e" : "D\u00e9sactiv\u00e9e"}
                  />
                  <button
                    className="btn btn-ghost btn-sm btn-square text-[var(--color-crimson)] hover:bg-[var(--color-ivory-dim)]"
                    onClick={() => handleDelete(alert.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
