import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/api";
import AuthCard from "../components/AuthCard";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Always show the same confirmation — never reveal if the email exists.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <AuthCard title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation par email.">
      {submitted ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-ink)]">
            Si un compte existe pour <strong>{email}</strong>, un email contenant les instructions de
            réinitialisation vient d'être envoyé.
          </p>
          <Link to="/login" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label htmlFor="fp-email" className="label">
              <span className="label-academic">Email</span>
            </label>
            <input
              id="fp-email"
              type="email"
              required
              autoComplete="email"
              className="input input-bordered w-full rounded border-[var(--color-border-subtle)] bg-base-100 font-sans"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full rounded font-sans font-semibold gap-2"
          >
            {loading && <span className="loading loading-spinner loading-sm" />}
            Envoyer le lien
          </button>
          <Link to="/login" className="text-center text-sm text-[var(--color-slate)] hover:underline">
            Retour à la connexion
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
