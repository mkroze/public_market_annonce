import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth";
import Breadcrumbs from "../components/Breadcrumbs";

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Reprend l'intention initiale : si l'utilisateur visait une page protégée,
  // on l'y renvoie après connexion plutôt que vers l'accueil.
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuth(res.token, res.user);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Compte" }, { label: "Connexion" }]} className="mb-6" />
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md border border-[var(--color-border-subtle)] rounded shadow-card bg-[var(--color-ivory)] p-8">
          <h2 className="font-display text-2xl text-[var(--color-charcoal)] text-center flex items-center justify-center gap-2 mb-6">
            <LogIn className="w-6 h-6 text-[var(--color-crimson)]" />
            Se connecter
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
              <label htmlFor="login-email" className="label">
                <span className="label-academic">Email</span>
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="label">
                <span className="label-academic">Mot de passe</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="input input-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] w-full rounded pr-10"
                  placeholder="Votre mot de passe"
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
            </div>

            <button
              type="submit"
              className="btn btn-primary font-sans font-semibold w-full mt-2 rounded gap-2"
              disabled={loading}
            >
              {loading && <span className="loading loading-spinner loading-sm"></span>}
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm font-sans text-[var(--color-slate)]">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-[var(--color-crimson)] hover:underline">
              Cr&eacute;er un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
