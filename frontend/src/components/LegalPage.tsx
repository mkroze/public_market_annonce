import { useEffect, useState, type ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";

export interface LegalSection {
  /** Ancre de la section (slug court, unique dans la page). */
  id: string;
  /** Titre affiché en <h2> et repris dans le sommaire. */
  title: string;
  /** Corps de la section : paragraphes, listes… (sans le titre). */
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  lead?: string;
  /** Date de dernière révision, ex. « 8 août 2026 ». */
  updatedAt?: string;
  sections: LegalSection[];
}

/**
 * Gabarit unique des pages légales (mentions, confidentialité, conditions,
 * cookies). Article à mesure de lecture à gauche, sommaire ancré et « scroll-spy »
 * à droite sur grand écran — la largeur du bureau sert enfin à quelque chose au
 * lieu de laisser une demi-page vide.
 */
export default function LegalPage({ title, lead, updatedAt, sections }: LegalPageProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  // On repart en haut à l'ouverture (pages longues).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  // Sommaire actif : on surligne la section dont le haut vient de passer sous
  // la barre de navigation. Le rootMargin décale la zone de détection sous le
  // header collant (~64px) et privilégie la section du tiers supérieur.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -66% 0px", threshold: 0 },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl lg:max-w-[64rem]">
        <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_1fr] lg:gap-12 xl:gap-16">
          {/* Colonne principale : fil d'Ariane, en-tête, article */}
          <div className="min-w-0">
            <Breadcrumbs
              items={[{ label: "Informations légales" }, { label: title }]}
              className="mb-6"
            />

            <header className="mb-8">
              <p className="editorial-label mb-2 text-[var(--color-primary)]">Informations légales</p>
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
                [&>section]:mt-9 [&>section]:border-t [&>section]:border-[var(--color-border-subtle)] [&>section]:pt-8
                [&>section:first-child]:mt-0 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0
                [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-[var(--color-ink)] [&_h2]:mb-3
                [&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-base [&_h3]:text-[var(--color-ink)] [&_h3]:mt-6 [&_h3]:mb-2
                [&_p]:text-[var(--color-muted)] [&_p]:mb-4 [&_p:last-child]:mb-0
                [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-[var(--color-muted)]
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-[var(--color-muted)]
                [&_strong]:text-[var(--color-ink)] [&_strong]:font-semibold
              "
            >
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2>{s.title}</h2>
                  {s.body}
                </section>
              ))}
            </article>
          </div>

          {/* Sommaire — ancré, réservé au grand écran (contenu court en mobile) */}
          <nav aria-label="Sommaire" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="editorial-label mb-3 text-[var(--color-muted-light)]">Sur cette page</p>
              <ul className="border-l border-[var(--color-border-subtle)]">
                {sections.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        aria-current={active ? "true" : undefined}
                        className={`-ml-px block border-l-2 py-1.5 pl-4 text-[13px] leading-snug transition-colors motion-reduce:transition-none ${
                          active
                            ? "border-[var(--color-primary)] font-semibold text-[var(--color-primary)]"
                            : "border-transparent text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        {s.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
