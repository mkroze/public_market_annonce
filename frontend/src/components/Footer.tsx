import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import logoFull from "../assets/logo-full.svg";

const columns = [
  {
    title: "Explorer",
    links: [
      { to: "/tenders", label: "Consultations" },
      { to: "/stats", label: "Statistiques" },
      { to: "/sectors", label: "Secteurs" },
      { to: "/cities", label: "Villes" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { to: "/guide", label: "Préparer ma candidature" },
      { to: "/faq", label: "FAQ" },
      { to: "/about", label: "À propos" },
      { to: "/contact", label: "Contact" },
    ],
  },
] as const;

const secondaryLinks = [
  { to: "/legal/mentions-legales", label: "Mentions légales" },
  { to: "/legal/confidentialite", label: "Confidentialité" },
  { to: "/legal/conditions", label: "CGU" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function handleNewsletter(e: FormEvent) {
    e.preventDefault();
    // La veille par email passe par un compte : on amorce l'inscription.
    navigate("/register", { state: { email } });
  }

  return (
    <footer className="relative z-10 mt-14 px-4 pb-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* CTA card — accroche + navigation à gauche, inscription à la veille à droite */}
        <form onSubmit={handleNewsletter} className="grid overflow-hidden rounded-[2rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)]">
          {/* Volet gauche — accroche + parcours des consultations */}
          <div className="p-8 sm:p-10">
            <p className="text-sm font-medium text-[var(--color-muted)]">Prêt à chercher ?</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[0] text-[var(--color-ink)] sm:text-5xl">
              Trouvez le bon marché, sans bruit.
            </h2>
            <Link
              to="/tenders"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] no-underline shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none"
            >
              Suivre les consultations
              <ArrowUpRight size={17} className="text-[var(--color-warning)]" aria-hidden="true" />
            </Link>
          </div>

          {/* Volet droit — inscription à la veille par email (empilé sous l'accroche en mobile) */}
          <div className="relative flex min-h-64 flex-col justify-center gap-5 overflow-hidden border-t border-[var(--color-border-subtle)] bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-warning-soft),var(--color-surface))] p-8 sm:p-10 lg:border-l lg:border-t-0">
            {/* Décor d'ambiance, non interactif */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--color-border)]" />
              <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--color-border-subtle)]" />
              <span className="absolute left-[14%] top-[16%] h-8 w-8 rounded-full bg-[var(--color-primary-soft)] shadow-card" />
              <span className="absolute right-[16%] top-[22%] h-6 w-6 rounded-full bg-[var(--color-warning)] shadow-card" />
              <span className="absolute bottom-[18%] left-[22%] h-7 w-7 rounded-full bg-[var(--color-surface)] shadow-card" />
            </div>

            <div className="relative">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Recevez la veille par email</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--color-muted)]">
                Les nouvelles consultations qui comptent, directement dans votre boîte.
              </p>
            </div>

            {/* Le bouton d'envoi est un cercle bleu, en bout de champ (le clin d'œil au décor). */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-light)]" aria-hidden="true" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Votre email"
                  aria-label="Votre email"
                  className="h-12 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] pl-10 pr-4 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-muted-light)] focus:border-[var(--color-primary)] motion-reduce:transition-none"
                />
              </div>
              <button
                type="submit"
                aria-label="S'inscrire à la veille"
                className="group grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_14px_34px_-24px_rgba(0,35,111,0.8)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none"
              >
                <ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </button>
            </div>
          </div>
        </form>

              </div>
    </footer>
  );
}
