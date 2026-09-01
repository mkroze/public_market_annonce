import { useEffect, type ReactNode } from "react";
import Breadcrumbs, { type BreadcrumbItem } from "./Breadcrumbs";

interface PageShellProps {
  /** Page title, rendered as the main heading. */
  title: string;
  /** Short lead paragraph shown under the title. */
  lead?: string;
  /** Label for the breadcrumb section (e.g. "Informations légales"). */
  section?: string;
  /** Human date of the last revision, e.g. "8 août 2026". */
  updatedAt?: string;
  /** Optional explicit breadcrumb trail after Accueil. */
  breadcrumbs?: BreadcrumbItem[];
  /** `prose` (défaut) = mesure de lecture étroite ; `wide` = pages formulaire. */
  width?: "prose" | "wide";
  children: ReactNode;
}

/**
 * Cadre commun aux pages de contenu statiques (légal, FAQ, à propos, contact…).
 * Layout article : en-tête épuré + contenu à mesure de lecture, centré, sans
 * empilement de cartes.
 */
export default function PageShell({ title, lead, section, updatedAt, breadcrumbs, width = "prose", children }: PageShellProps) {
  // Les pages de contenu sont longues : on repart en haut à chaque ouverture.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  const breadcrumbItems = breadcrumbs || [
    ...(section ? [{ label: section }] : []),
    { label: title },
  ];

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      {/* Une seule colonne article, largeur de lecture confortable et centrée —
          plus de cartes empilées, plus de demi-page vide. */}
      <div className={`mx-auto ${width === "wide" ? "max-w-4xl" : "max-w-2xl"}`}>
        <Breadcrumbs items={breadcrumbItems} className="mb-6" />

        <header className="mb-8">
          {section && (
            <p className="editorial-label mb-2 text-[var(--color-primary)]">{section}</p>
          )}
          <h1 className="font-display text-3xl sm:text-[2.5rem] text-[var(--color-ink)] leading-[1.1]">
            {title}
          </h1>
          {lead && (
            <p className="mt-3 font-sans text-base sm:text-lg text-[var(--color-muted)] leading-relaxed">
              {lead}
            </p>
          )}
          {updatedAt && (
            <p className="mt-5 border-t border-[var(--color-border-subtle)] pt-3 font-sans text-xs text-[var(--color-muted-light)]">
              Dernière mise à jour&nbsp;: {updatedAt}
            </p>
          )}
        </header>

        <article
          className="
            font-sans text-[var(--color-ink)] leading-relaxed
            [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-[var(--color-ink)]
            [&_h2]:mt-9 [&_h2]:mb-2.5 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-[var(--color-border-subtle)]
            [&_h2:first-child]:mt-0 [&_h2:first-child]:pt-0 [&_h2:first-child]:border-t-0
            [&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-base [&_h3]:text-[var(--color-ink)]
            [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-[var(--color-muted)] [&_p]:mb-4
            [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-[var(--color-muted)]
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-[var(--color-muted)]
            [&_strong]:text-[var(--color-ink)] [&_strong]:font-semibold
          "
        >
          {children}
        </article>
      </div>
    </div>
  );
}
