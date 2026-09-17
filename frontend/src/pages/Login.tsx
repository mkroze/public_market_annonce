import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Eye, EyeOff, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth";
import logoFull from "../assets/logo-full.svg";

const previewCards = [
  { icon: Search, title: "32 nouvelles", meta: "aujourd'hui", tone: "blue", className: "left-[12%] top-[16%] rotate-[-4deg]" },
  { icon: Bell, title: "3 alertes", meta: "à vérifier", tone: "gold", className: "right-[10%] top-[22%] rotate-[5deg]" },
  { icon: ShieldCheck, title: "Éligible", meta: "profil PME", tone: "blue", className: "left-[22%] top-[46%] rotate-[4deg]" },
  { icon: FileCheck2, title: "DCE prêt", meta: "2 pièces", tone: "gold", className: "right-[18%] bottom-[22%] rotate-[-3deg]" },
] as const;

const previewTone = {
  blue: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  gold: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
} as const;

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    <section className="px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-[1440px] overflow-hidden rounded-[2rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card lg:grid-cols-[minmax(25rem,0.82fr)_minmax(0,1fr)]">
        <div className="flex min-h-[620px] items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <img src={logoFull} alt="Marchés Publics Maroc" className="h-8 w-auto" />

            <div className="mt-16">
              <h1 className="text-5xl font-semibold leading-none tracking-[0] text-[var(--color-ink)] sm:text-6xl">
                Bon retour
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-[var(--color-muted)]">
                Connectez-vous à votre espace.
              </p>
            </div>

            {error && (
              <div role="alert" className="mt-8 rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="h-12 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-5 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)] motion-reduce:transition-none"
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-12 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-5 pr-12 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)] motion-reduce:transition-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="-mt-2 flex items-center justify-end">
                <Link to="/forgot-password" className="text-sm text-[var(--color-muted)] no-underline transition-colors hover:text-[var(--color-ink)]">
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Se connecter"}
                {!loading && <ArrowRight size={16} className="text-[var(--color-warning)]" aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[var(--color-muted)]">
              Nouveau ?{" "}
              <Link to="/register" className="font-semibold text-[var(--color-primary)] no-underline hover:underline">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>

        <div className="relative hidden min-h-[620px] overflow-hidden rounded-l-[2rem] border-l border-[var(--color-border-subtle)] bg-[linear-gradient(160deg,var(--color-surface-muted)_0%,var(--color-primary-soft)_52%,var(--color-warning-soft)_100%)] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.75),transparent_36%),radial-gradient(circle_at_84%_82%,color-mix(in_srgb,var(--color-warning)_20%,transparent),transparent_42%)]" />
          <div className="absolute left-1/2 top-[46%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[color-mix(in_srgb,var(--color-border)_60%,transparent)]" />
          <div className="absolute left-1/2 top-[46%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--color-border-subtle)]" />
          {previewCards.map((card) => (
            <div
              key={card.title}
              className={`absolute flex min-w-48 items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-white/90 px-4 py-3 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.4)] backdrop-blur-sm ${card.className}`}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${previewTone[card.tone]}`}>
                <card.icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--color-ink)]">{card.title}</span>
                <span className="block text-xs text-[var(--color-muted)]">{card.meta}</span>
              </span>
            </div>
          ))}
          <div className="absolute bottom-16 left-1/2 w-full max-w-md -translate-x-1/2 px-8 text-center">
            <h2 className="text-3xl font-semibold leading-tight tracking-[0] text-[var(--color-ink)]">Votre veille reste prête.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Alertes, dossiers et consultations au même endroit.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
