# FAQ Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the FAQ page into a compact reference-inspired layout while preserving the existing French content and theme colors.

**Architecture:** Keep the redesign contained in `pages/Faq.tsx`. Extend the existing data array with category and icon metadata, then render a centered header, category pills, and icon-led accordion rows inside the existing `PageShell`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, daisyUI theme tokens, lucide-react icons, Vite.

## Global Constraints

- Keep the existing FAQ questions and answers.
- Keep single-open accordion behavior.
- Keep the current `PageShell` wrapper.
- Use the existing black, cream, slate, and border tokens.
- Do not introduce new brand colors.
- Keep the layout compact on desktop and full-width on mobile.

---

### Task 1: FAQ Page Redesign

**Files:**
- Modify: `pages/Faq.tsx`

**Interfaces:**
- Consumes: `PageShell` from `../components/PageShell`, lucide-react icon components, existing `FAQS` copy.
- Produces: default `Faq` React component used by `App.tsx` for `/faq`.

- [ ] **Step 1: Add FAQ metadata and category data**

Replace the current imports, `QA` interface, and `FAQS` declaration with data shaped like this:

```tsx
import { useState, type ComponentType } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Database,
  FileSearch,
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
  { key: "general", label: "General", count: 2 },
  { key: "consultation", label: "Consultation", count: 3 },
  { key: "compte", label: "Compte", count: 2 },
  { key: "donnees", label: "Donnees", count: 1 },
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
```

- [ ] **Step 2: Replace the page markup**

Replace the current `Faq` component body with a centered FAQ composition:

```tsx
export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PageShell
      title="Foire aux questions"
      lead="Les réponses aux questions les plus fréquentes sur la plateforme et son utilisation."
    >
      <section className="not-prose mx-auto -mt-2 w-full max-w-2xl text-center">
        <p className="editorial-label text-[var(--color-slate)]">Assistance</p>
        <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-[var(--color-charcoal)] sm:text-3xl">
          Questions fréquentes
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-slate)] sm:text-base">
          Retrouvez les réponses essentielles pour consulter, filtrer et vérifier les avis de marchés publics.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((category, index) => {
            const active = index === 0;
            return (
              <button
                key={category.key}
                type="button"
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[var(--color-charcoal)] bg-[var(--color-charcoal)] text-[var(--color-ivory)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-ivory)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                }`}
              >
                {category.label}
                <span className={`text-[10px] ${active ? "text-[var(--color-ivory-dim)]" : "text-[var(--color-slate)]"}`}>
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 space-y-2 text-left">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            const answerId = `faq-answer-${i}`;
            const buttonId = `faq-question-${i}`;
            const Icon = item.Icon;

            return (
              <article
                key={item.q}
                className={`rounded-lg border bg-[var(--color-ivory)] transition-colors ${
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
                  <span className="grid size-9 shrink-0 place-items-center rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)]">
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--color-charcoal)] sm:text-[15px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={17}
                    aria-hidden="true"
                    className={`shrink-0 text-[var(--color-slate)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-3 pb-4 pl-[4.25rem] pr-5 sm:px-4 sm:pb-5 sm:pl-[4.75rem]"
                  >
                    <p className="mb-0 text-sm leading-6 text-[var(--color-slate)]">
                      {item.a}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-4 py-4 text-center">
          <p className="mb-0 text-sm text-[var(--color-slate)]">
            Vous ne trouvez pas votre réponse ?{" "}
            <a href="/contact" className="font-semibold text-[var(--color-charcoal)] underline underline-offset-4">
              Contactez-nous
            </a>
            .
          </p>
        </div>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 3: Run TypeScript and production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Inspect the changed file**

Run:

```bash
sed -n '1,260p' pages/Faq.tsx
```

Expected: The file contains the category pills, icon-led accordion rows, accessible IDs, and no unrelated edits.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add frontend/src/pages/Faq.tsx frontend/src/docs/superpowers/plans/2026-08-09-faq-redesign.md
git commit -m "feat: redesign faq page"
```

Expected: Commit succeeds and includes only the FAQ implementation and this plan file.
