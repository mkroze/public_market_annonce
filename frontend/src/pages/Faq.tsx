import { useState, type ComponentType } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Database,
  Filter,
  LockKeyhole,
  MailQuestion,
  ShieldCheck,
  UserRound,
  type LucideProps,
} from "lucide-react";
import PageShell from "../components/PageShell";

interface QA {
  q: string;
  a: string;
  category: "general" | "consultation" | "compte" | "donnees";
  Icon: ComponentType<LucideProps>;
}

const CATEGORIES = [
  { key: "general", label: "Général" },
  { key: "consultation", label: "Consultation" },
  { key: "compte", label: "Compte" },
  { key: "donnees", label: "Données" },
] as const;

const FAQS: QA[] = [
  {
    q: "Qu'est-ce que Marchés Publics Maroc ?",
    a: "Une plateforme qui regroupe les avis de consultation des marchés publics et les rend faciles à consulter, filtrer et suivre. Elle a pour vocation de faire gagner du temps aux entreprises dans leur veille.",
    category: "general",
    Icon: CircleHelp,
  },
  {
    q: "La consultation est-elle gratuite ?",
    a: "La création d'un compte et la consultation des avis sont gratuites. Il vous suffit de vous inscrire pour accéder au catalogue des consultations.",
    category: "general",
    Icon: BookOpen,
  },
  {
    q: "Faut-il créer un compte pour consulter les avis ?",
    a: "Oui. L'accès au détail des consultations est réservé aux comptes enregistrés. L'inscription se fait en quelques secondes depuis la page de création de compte.",
    category: "compte",
    Icon: UserRound,
  },
  {
    q: "D'où proviennent les informations affichées ?",
    a: "Les avis sont issus de sources publiques. Nous les structurons pour en faciliter la lecture, mais seules les publications officielles des acheteurs publics font foi.",
    category: "donnees",
    Icon: Database,
  },
  {
    q: "Les données sont-elles garanties exactes et à jour ?",
    a: "Nous nous efforçons de maintenir les informations à jour et fiables, sans garantie d'exhaustivité. Avant toute démarche, vérifiez toujours l'avis sur le portail officiel de l'acheteur.",
    category: "consultation",
    Icon: ShieldCheck,
  },
  {
    q: "Comment filtrer les consultations qui m'intéressent ?",
    a: "Depuis la liste des consultations, utilisez les filtres par région, secteur et acheteur pour ne voir que les avis pertinents pour votre activité.",
    category: "consultation",
    Icon: Filter,
  },
  {
    q: "Comment signaler une erreur ou poser une question ?",
    a: "Rendez-vous sur la page Contact. Décrivez votre demande le plus précisément possible ; nos équipes reviennent vers vous dans les meilleurs délais.",
    category: "consultation",
    Icon: MailQuestion,
  },
  {
    q: "Comment sont protégées mes données personnelles ?",
    a: "Vos données sont traitées conformément à notre politique de confidentialité et à la loi n° 09-08. Vous disposez notamment d'un droit d'accès, de rectification et de suppression.",
    category: "compte",
    Icon: LockKeyhole,
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const visibleFaqs = activeCat ? FAQS.filter((f) => f.category === activeCat) : FAQS;

  // Un clic sur une catégorie filtre la liste ; un second clic la désélectionne.
  function selectCategory(key: string) {
    setActiveCat((cur) => (cur === key ? null : key));
    setOpen(null);
  }

  return (
    <PageShell
      title="Foire aux questions"
      section="Aide"
      lead="Les réponses aux questions les plus fréquentes sur la plateforme et son utilisation."
    >
      <section className="not-prose w-full max-w-2xl">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrer par catégorie">
          {CATEGORIES.map((category) => {
            const active = activeCat === category.key;

            return (
              <button
                key={category.key}
                type="button"
                role="tab"
                onClick={() => selectCategory(category.key)}
                aria-selected={active}
                className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition-all ${
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-card"
                    : "bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[color-mix(in_srgb,var(--color-border-subtle)_70%,transparent)] hover:text-[var(--color-ink)] hover:ring-[var(--color-primary)]"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 space-y-2">
          {visibleFaqs.map((item, i) => {
            const isOpen = open === i;
            const answerId = `faq-answer-${i}`;
            const buttonId = `faq-question-${i}`;
            const Icon = item.Icon;

            return (
              <article
                key={item.q}
                className={`rounded-xl border bg-[var(--color-ivory)] shadow-card transition-all ${
                  isOpen ? "border-[var(--color-border)]" : "border-[var(--color-border-subtle)]"
                }`}
              >
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--color-charcoal)] sm:text-[15px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={17}
                    aria-hidden="true"
                    className={`shrink-0 text-[var(--color-slate)] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="pb-4 pl-[3rem] pr-5 sm:pb-5 sm:pl-[3.25rem]"
                  >
                    <p className="mb-0 text-sm leading-6 text-[var(--color-muted)]">{item.a}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-4">
          <p className="mb-0 text-sm text-[var(--color-muted)]">
            Vous ne trouvez pas votre réponse ?{" "}
            <a
              href="/contact"
              className="font-semibold text-[var(--color-primary)] underline underline-offset-4"
            >
              Contactez-nous
            </a>
            .
          </p>
        </div>
      </section>
    </PageShell>
  );
}
