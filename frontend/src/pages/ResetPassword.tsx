import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../lib/api";
import AuthCard from "../components/AuthCard";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err: any) {
      setError(err.message || "Lien de réinitialisation invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Lien invalide" subtitle="Ce lien de réinitialisation est incomplet.">
        <Link to="/forgot-password" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
          Demander un nouveau lien
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte.">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-ink)]">
            Mot de passe mis à jour. Redirection vers la connexion…
          </p>
          <Link to="/login" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-l-4 border-[var(--color-border-subtle)] border-l-[var(--color-accent)] bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-charcoal)]"
            >
              {error}
            </div>
          )}
          <div className="form-control">
            <label htmlFor="rp-pw" className="label">
              <span className="label-academic">Nouveau mot de passe</span>
            </label>
            <input
              id="rp-pw"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input input-bordered w-full rounded border-[var(--color-border-subtle)] bg-base-100 font-sans"
              placeholder="Au moins 8 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label htmlFor="rp-confirm" className="label">
              <span className="label-academic">Confirmer le mot de passe</span>
            </label>
            <input
              id="rp-confirm"
              type="password"
              required
              autoComplete="new-password"
              className="input input-bordered w-full rounded border-[var(--color-border-subtle)] bg-base-100 font-sans"
              placeholder="Confirmez le mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full rounded font-sans font-semibold gap-2"
          >
            {loading && <span className="loading loading-spinner loading-sm" />}
            Réinitialiser
          </button>
        </form>
      )}
    </AuthCard>
  );
}
