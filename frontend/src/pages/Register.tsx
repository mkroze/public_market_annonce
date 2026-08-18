import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { register } from "../lib/api";
import { useAuth } from "../lib/auth";
import Breadcrumbs from "../components/Breadcrumbs";

export default function Register() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await register({
        name,
        email,
        password,
        company: company || undefined,
      });
      setAuth(res.token, res.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Compte" }, { label: "Inscription" }]} className="mb-6" />
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md border border-[var(--color-border-subtle)] rounded shadow-card bg-[var(--color-ivory)] p-8">
          <h2 className="font-display text-2xl text-[var(--color-charcoal)] text-center flex items-center justify-center gap-2 mb-6">
            <UserPlus className="w-6 h-6 text-[var(--color-crimson)]" />
            Cr&eacute;er un compte
          </h2>

          {error && (
            <div
              role="alert"
              className="border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-accent)] rounded-lg bg-[var(--color-accent-soft)] p-3 mb-4"
            >
              <span className="font-sans text-sm text-[var(--color-charcoal)]">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-control">
              <label htmlFor="register-name" className="label">
                <span className="label-academic">Nom complet</span>
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label htmlFor="register-email" className="label">
                <span className="label-academic">Email</span>
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label htmlFor="register-password" className="label">
                <span className="label-academic">Mot de passe</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  aria-describedby="register-password-hint"
                  className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded pr-10"
                  placeholder="Au moins 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-slate)] hover:text-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-[var(--color-crimson)] rounded"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p id="register-password-hint" className="mt-1 font-sans text-xs text-[var(--color-slate)]">
                Au moins 8 caractères.
              </p>
            </div>

            <div className="form-control">
              <label htmlFor="register-company" className="label">
                <span className="label-academic">Entreprise (optionnel)</span>
              </label>
              <input
                id="register-company"
                type="text"
                autoComplete="organization"
                className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded"
                placeholder="Nom de l'entreprise"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary font-sans font-semibold w-full mt-2 rounded gap-2"
              disabled={loading}
            >
              {loading && <span className="loading loading-spinner loading-sm"></span>}
              {loading ? "Inscription..." : "Créer un compte"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm font-sans text-[var(--color-slate)]">
            D&eacute;j&agrave; un compte ?{" "}
            <Link to="/login" className="text-[var(--color-crimson)] hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
