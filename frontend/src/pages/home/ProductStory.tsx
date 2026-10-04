// Scroll-driven product story: the text scrolls, the product screen on the
// right follows. Every screen is a real capture of the application (taken by
// scripts/demo-video/record_demo.py), not a mock-up.
import { useEffect, useRef, useState } from "react";
import criteria from "../../assets/demo/story-criteria.jpg";
import eligibility from "../../assets/demo/story-eligibility.jpg";
import opportunity from "../../assets/demo/story-opportunity.jpg";
import prepare from "../../assets/demo/story-prepare.jpg";
import watch from "../../assets/demo/story-watch.jpg";
import { Pill, SectionHeader } from "./ui";

const STEPS = [
  {
    title: "Définissez vos critères.",
    text: "Catégorie, ville, procédure, mots-clés : le catalogue se réduit à ce qui vous concerne.",
    image: criteria,
    alt: "Catalogue MP Maroc filtré sur les travaux à Fès : quatre consultations trouvées.",
  },
  {
    title: "MP Maroc surveille pour vous.",
    text: "Enregistrez vos critères en alerte : chaque matin, un récapitulatif des nouvelles consultations qui y correspondent.",
    image: watch,
    alt: "Formulaire de création d'alerte : domaines d'activité, régions, mots-clés et budget.",
  },
  {
    title: "Identifiez les opportunités pertinentes.",
    text: "Chaque fiche réunit l'essentiel : échéance, caution, disponibilité du DCE et points à vérifier.",
    image: opportunity,
    alt: "Fiche d'une consultation avec échéance, caution, DCE disponible et points à vérifier.",
  },
  {
    title: "Vérifiez votre éligibilité.",
    text: "Les conditions de l'article 27, question par question, avec un résultat immédiat.",
    image: eligibility,
    alt: "Questionnaire d'éligibilité : capacités juridiques, techniques et financières.",
  },
  {
    title: "Préparez votre réponse.",
    text: "Procédure, délais clés et pièces exigées réunis dans un plan de préparation.",
    image: prepare,
    alt: "Atelier de candidature : paramètres du marché et plan de préparation.",
  },
] as const;

const SCREEN =
  "overflow-hidden rounded-[1.25rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-pop)]";

export function ProductStory() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  // The step crossing the middle of the viewport drives the screen shown.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-7xl py-12 sm:py-16" aria-labelledby="home-story-title">
      <SectionHeader
        id="home-story-title"
        eyebrow="Le parcours"
        title={<>Tout commence par ce que vous <Pill>cherchez</Pill>.</>}
      />

      <div className="mt-8 grid gap-10 lg:mt-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <ol>
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              data-step={index}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className="flex flex-col justify-center py-6 lg:min-h-[62vh] lg:py-10"
            >
              <div
                className={`transition-opacity duration-300 motion-reduce:transition-none ${
                  active === index ? "lg:opacity-100" : "lg:opacity-35"
                }`}
              >
                <p className="flex items-center gap-3 text-sm font-bold tabular-nums text-[var(--color-primary)]">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary)] text-xs text-[var(--color-on-primary)]">
                    {index + 1}
                  </span>
                  Étape {index + 1} / {STEPS.length}
                </p>
                <h3 className="mt-4 text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-[1.15] text-[var(--color-ink)]">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-md text-base leading-7 text-[var(--color-muted)]">{step.text}</p>
              </div>
              {/* Phones and tablets: each step carries its own screen. */}
              <div className={`mt-5 lg:hidden ${SCREEN}`}>
                <img src={step.image} alt={step.alt} width={1200} height={750} loading="lazy" decoding="async" className="block h-auto w-full" />
              </div>
            </li>
          ))}
        </ol>

        {/* Desktop: one sticky screen that crossfades between the steps. */}
        <div className="hidden lg:block">
          <div className="sticky top-[calc(50vh-13rem)] py-10">
            <div className={`relative aspect-[1200/750] ${SCREEN}`}>
              {STEPS.map((step, index) => (
                <img
                  key={step.title}
                  src={step.image}
                  alt={step.alt}
                  aria-hidden={active !== index}
                  width={1200}
                  height={750}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
                    active === index ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
              {STEPS.map((step, index) => (
                <span
                  key={step.title}
                  className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    active === index ? "w-8 bg-[var(--color-primary)]" : "w-1.5 bg-[var(--color-border)]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
