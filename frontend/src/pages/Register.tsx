import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { register } from "../lib/api";
import { useAuth } from "../lib/auth";
import logoFull from "../assets/logo-full.svg";
import logoWhite from "../assets/logo-full-white.svg";

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
    <section className="px-4 py-6 sm:px-6 lg:py-8">
      <div className="relative mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-[1440px] overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.7fr)]">
        {/* Volet marque — même composition que la connexion */}
        <div
          className="relative hidden min-h-[640px] overflow-hidden bg-[var(--color-primary)] lg:block"
          style={{
            clipPath: "polygon(0 0, 100% 0, 93% 100%, 0% 100%)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(245,158,11,0.24),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.12),transparent_44%)]" />
          <div className="relative z-10 flex h-full items-center justify-center pr-[12%]">
            <div className="flex max-w-xl flex-col items-center text-center font-sans">
              <img
                src={logoWhite}
                alt="Marchés Publics Maroc"
                className="h-48 w-auto max-w-[28rem]"
              />
              <div className="mt-10 flex max-w-[26rem] translate-y-8 flex-col items-center">
                <h1 className="max-w-[24rem] font-sans text-[1.75rem] font-semibold leading-[1.08] tracking-normal text-white [text-wrap:balance]">
                  Créez votre accès au marché public
                </h1>
                <p className="mt-4 max-w-[26rem] font-sans text-base font-medium leading-[1.45] text-white/82">
                  Un compte gratuit pour suivre les consultations, exporter vos sélections et recevoir des alertes ciblées.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[620px] items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <img src={logoFull} alt="Marchés Publics Maroc" className="h-7 w-auto" />
              <div className="mt-8 max-w-[24rem]">
                <h1 className="max-w-[24rem] font-sans text-xl font-semibold leading-[1.08] tracking-normal text-[var(--color-ink)] [text-wrap:balance]">
                  Créez votre accès au marché public
                </h1>
                <p className="mt-4 text-sm leading-[1.45] text-[var(--color-muted)]">
                  Un compte gratuit pour suivre les consultations, exporter vos sélections et recevoir des alertes ciblées.
                </p>
              </div>
            </div>

            <div className="p-1 sm:p-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                Nouvel accès
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[var(--color-ink)]">
                Créer un compte
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Quelques informations suffisent pour démarrer.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-[var(--color-border-subtle)] border-l-4 border-l-[var(--color-accent)] bg-[var(--color-accent-soft)] p-3"
                >
                  <span className="font-sans text-sm text-[var(--color-charcoal)]">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="form-control">
                  <label htmlFor="register-name" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Nom complet</span>
                  </label>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    className="input input-bordered w-full rounded-lg border-[var(--color-border-subtle)] bg-base-100 font-sans"
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="register-email" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Email</span>
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    className="input input-bordered w-full rounded-lg border-[var(--color-border-subtle)] bg-base-100 font-sans"
                    placeholder="email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="register-password" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Mot de passe</span>
                  </label>
                  <div className="relative">
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      aria-describedby="register-password-hint"
                      className="input input-bordered w-full rounded-lg border-[var(--color-border-subtle)] bg-base-100 pr-10 font-sans"
                      placeholder="Au moins 8 caractères"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-slate)] hover:text-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-[var(--color-crimson)]"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p id="register-password-hint" className="mt-1 font-sans text-xs text-[var(--color-muted-light)]">
                    Au moins 8 caractères.
                  </p>
                </div>

                <div className="form-control">
                  <label htmlFor="register-company" className="label">
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">Entreprise (optionnel)</span>
                  </label>
                  <input
                    id="register-company"
                    type="text"
                    autoComplete="organization"
                    className="input input-bordered w-full rounded-lg border-[var(--color-border-subtle)] bg-base-100 font-sans"
                    placeholder="Nom de l'entreprise"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary mt-2 w-full rounded font-sans font-semibold gap-2"
                  disabled={loading}
                >
                  {loading && <span className="loading loading-spinner loading-sm"></span>}
                  {loading ? "Inscription..." : "Créer un compte"}
                </button>
              </form>

              <p className="mt-6 text-center font-sans text-sm text-[var(--color-slate)]">
                Déjà un compte ?{" "}
                <Link to="/login" className="text-[var(--color-crimson)] hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
