import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface PageShellProps {
  /** Page title, rendered as the main heading. */
  title: string;
  /** Short lead paragraph shown under the title. */
  lead?: string;
  /** Label for the breadcrumb section (e.g. "Informations légales"). */
  section?: string;
  /** Human date of the last revision, e.g. "8 août 2026". */
  updatedAt?: string;
  children: ReactNode;
}

/**
 * Cadre commun aux pages de contenu statiques (légal, FAQ, à propos…).
 * Reprend le style « academic » : titres serif, filets fins, ivoire.
 */
export default function PageShell({ title, lead, section, updatedAt, children }: PageShellProps) {
  // Les pages de contenu sont longues : on repart en haut à chaque ouverture.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10">
      <nav className="flex items-center gap-1.5 text-xs font-sans text-[var(--color-slate)] mb-6">
        <Link to="/tenders" className="hover:text-[var(--color-crimson)] transition-colors">
          Accueil
        </Link>
        {section && (
          <>
            <ChevronRight size={12} className="opacity-60" />
            <span>{section}</span>
          </>
        )}
        <ChevronRight size={12} className="opacity-60" />
        <span className="text-[var(--color-charcoal)]">{title}</span>
      </nav>

      <header className="max-w-3xl border-b border-[var(--color-border-subtle)] pb-6 mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-[var(--color-charcoal)] leading-tight">
          {title}
        </h1>
        {lead && (
          <p className="mt-4 font-sans text-base text-[var(--color-slate)] leading-relaxed">
            {lead}
          </p>
        )}
        {updatedAt && (
          <p className="mt-4 label-academic">Dernière mise à jour&nbsp;: {updatedAt}</p>
        )}
      </header>

      <div
        className="
          max-w-3xl font-sans text-[var(--color-charcoal)] leading-relaxed
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:text-[var(--color-charcoal)]
          [&_h2]:mt-10 [&_h2]:mb-3
          [&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-base [&_h3]:text-[var(--color-charcoal)]
          [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:text-[var(--color-slate)] [&_p]:mb-4
          [&_a]:text-[var(--color-crimson)] [&_a]:underline [&_a]:underline-offset-2
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-[var(--color-slate)]
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-[var(--color-slate)]
          [&_strong]:text-[var(--color-charcoal)] [&_strong]:font-semibold
        "
      >
        {children}
      </div>
    </div>
  );
}
