import { Link } from "react-router-dom";

const columns: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Plateforme",
    links: [
      { to: "/tenders", label: "Toutes les consultations" },
      { to: "/about", label: "À propos" },
      { to: "/faq", label: "Foire aux questions" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Informations légales",
    links: [
      { to: "/legal/mentions-legales", label: "Mentions légales" },
      { to: "/legal/confidentialite", label: "Confidentialité" },
      { to: "/legal/conditions", label: "Conditions d'utilisation" },
      { to: "/legal/cookies", label: "Cookies" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-ivory)] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2 max-w-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[var(--color-crimson)] flex items-center justify-center shrink-0">
                <span className="text-[var(--color-ivory)] font-bold text-sm font-sans">MP</span>
              </div>
              <span className="font-display text-lg font-bold text-[var(--color-charcoal)]">
                Marchés Publics <span className="text-[var(--color-slate)] font-normal">Maroc</span>
              </span>
            </div>
            <p className="mt-4 font-sans text-sm text-[var(--color-slate)] leading-relaxed">
              La consultation des appels d'offres publics, centralisée et facile à suivre.
              Informations fournies à titre indicatif&nbsp;: seules les publications officielles des
              acheteurs font foi.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="label-academic mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-academic mt-10 mb-6"></div>

        <p className="font-sans text-xs text-[var(--color-slate)]">
          © {year} Marchés Publics Maroc. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
