# Guide & Outils Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Procédures, Éligibilité, Calculateur, Assistant and Recours into one coherent scrollable `/guide` page (journey order + sticky anchor rail, no tabs), and repoint navigation to it.

**Architecture:** Each existing page gains an `embedded?: boolean` prop that hides its own header/back-link/page-padding (the pattern already used for Cities/Regions/Sectors). A new lazy-loaded `Guide.tsx` renders the five components in bidder order inside `<section id="…">` anchors with a sticky scrollspy rail. All existing routes stay for deep links.

**Tech Stack:** React 19, TypeScript, react-router-dom 7, Tailwind 4 academic-theme CSS variables, lucide-react, IntersectionObserver.

**Spec:** `docs/superpowers/specs/2026-07-19-guide-outils-consolidation-design.md`

## Global Constraints

- All user-facing copy is French; match existing tone.
- Style with the theme CSS variables (`--color-crimson`, `--color-charcoal`, `--color-slate`, `--color-ivory`, `--color-ivory-dim`, `--color-border-subtle`); no stock daisyUI tab classes.
- `embedded` mode hides a component's own `<h1>`/subtitle header block, any "← retour"/back Link, and outer page padding; all business logic and remaining content is unchanged. Standalone routes (prop absent) behave exactly as today.
- Keep all existing routes functional: `/procedures`, `/procedures/:slug`, `/eligibility`, `/recours`, `/calculator`, `/assistant`.
- Frontend has no unit-test framework: verification cycle is `npx tsc -b --noEmit`, `npx oxlint <files>`, and `npm run build` (final task). Visual checks via headless Chrome.
- Frontend commands run from `/Users/mkroze/Developer/my_hub/public_market_annonce/frontend`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `embedded` prop for Procedures (hide header + tools grid)

**Files:**
- Modify: `frontend/src/pages/Procedures.tsx`

**Interfaces:**
- Produces: `Procedures` default export accepts `{ embedded?: boolean }`. When embedded: no header block, no "Outils pratiques" grid, no outer page padding. Task 5 renders `<Procedures embedded />`.

- [x] **Step 1: Change the signature**

In `frontend/src/pages/Procedures.tsx`, replace:

```tsx
export default function Procedures() {
  return (
    <div className="px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Scale className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Procédures de passation
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Guide des modes de passation du décret n° 2.22.431 du 8 mars 2023 relatif aux marchés publics
        </p>
      </div>
```

with:

```tsx
export default function Procedures({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "space-y-8" : "px-4 sm:px-6 py-8 space-y-8"}>
      {!embedded && (
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Scale className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Procédures de passation
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Guide des modes de passation du décret n° 2.22.431 du 8 mars 2023 relatif aux marchés publics
          </p>
        </div>
      )}
```

- [x] **Step 2: Hide the "Outils pratiques" grid in embedded mode**

In the same file, find the Tools block (starts `{/* Tools */}`):

```tsx
      {/* Tools */}
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-3">
          Outils pratiques
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)] transition-colors p-5"
            >
              <t.icon size={18} className="text-[var(--color-crimson)] mb-2" />
              <h3 className="font-display font-bold text-[var(--color-charcoal)]">{t.title}</h3>
              <p className="font-sans text-sm text-[var(--color-slate)] mt-1">{t.description}</p>
            </Link>
          ))}
        </div>
      </div>
```

Wrap it in `{!embedded && ( … )}`:

```tsx
      {/* Tools */}
      {!embedded && (
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-3">
            Outils pratiques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TOOLS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)] transition-colors p-5"
              >
                <t.icon size={18} className="text-[var(--color-crimson)] mb-2" />
                <h3 className="font-display font-bold text-[var(--color-charcoal)]">{t.title}</h3>
                <p className="font-sans text-sm text-[var(--color-slate)] mt-1">{t.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
```

- [x] **Step 3: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/Procedures.tsx`
Expected: exit 0. (`TOOLS`, `Link`, `Calculator` icon are still referenced — no unused-import warning.)

- [x] **Step 4: Commit**

```bash
git add src/pages/Procedures.tsx
git commit -m "feat: add embedded mode to Procedures page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `embedded` prop for Eligibility, Calculator, Recours

**Files:**
- Modify: `frontend/src/pages/Eligibility.tsx`
- Modify: `frontend/src/pages/Calculator.tsx`
- Modify: `frontend/src/pages/Recours.tsx`

**Interfaces:**
- Produces: each default export accepts `{ embedded?: boolean }`; embedded hides header + back-link + outer padding. Task 5 renders `<Eligibility embedded />`, `<Calculator embedded />`, `<Recours embedded />`.

- [x] **Step 1: Eligibility.tsx — signature + wrapper + header**

Replace:

```tsx
export default function Eligibility() {
```
with:
```tsx
export default function Eligibility({ embedded = false }: { embedded?: boolean }) {
```

Then replace the return-open + header block:

```tsx
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Procédures de passation
        </Link>
        <div className="flex items-center gap-2.5 mb-1">
          <ShieldCheck className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Vérificateur d'éligibilité
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Conditions de soumission de l'article 27 du décret n° 2.22.431
        </p>
      </div>
```

with:

```tsx
  return (
    <div className={embedded ? "space-y-6" : "max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <Link
            to="/procedures"
            className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Procédures de passation
          </Link>
          <div className="flex items-center gap-2.5 mb-1">
            <ShieldCheck className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Vérificateur d'éligibilité
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Conditions de soumission de l'article 27 du décret n° 2.22.431
          </p>
        </div>
      )}
```

- [x] **Step 2: Calculator.tsx — signature + wrapper + header**

Replace:

```tsx
export default function Calculator() {
```
with:
```tsx
export default function Calculator({ embedded = false }: { embedded?: boolean }) {
```

Then replace the return-open + header block:

```tsx
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8" style={{ backgroundColor: "var(--color-ivory)" }}>
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-1">
          <CalculatorIcon className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Calculateur
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Penalites de retard, caution provisoire & risque de prix
        </p>
      </div>
```

with:

```tsx
  return (
    <div
      className={embedded ? "" : "max-w-4xl mx-auto px-4 sm:px-6 py-8"}
      style={{ backgroundColor: "var(--color-ivory)" }}
    >
      {!embedded && (
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-1">
            <CalculatorIcon className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Calculateur
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Penalites de retard, caution provisoire & risque de prix
          </p>
        </div>
      )}
```

- [x] **Step 3: Recours.tsx — signature + wrapper + header**

Replace:

```tsx
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Procédures de passation
        </Link>
        <div className="flex items-center gap-2.5 mb-1">
          <Gavel className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Assistant recours
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Réclamations et saisine de la CNCP — articles 163 et 164 du décret n° 2.22.431, décret n° 2-14-867
        </p>
      </div>
```

with:

```tsx
  return (
    <div className={embedded ? "space-y-6" : "max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <Link
            to="/procedures"
            className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Procédures de passation
          </Link>
          <div className="flex items-center gap-2.5 mb-1">
            <Gavel className="w-6 h-6 text-[var(--color-crimson)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
              Assistant recours
            </h1>
          </div>
          <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
            Réclamations et saisine de la CNCP — articles 163 et 164 du décret n° 2.22.431, décret n° 2-14-867
          </p>
        </div>
      )}
```

And change the Recours signature:

```tsx
export default function Recours() {
```
to:
```tsx
export default function Recours({ embedded = false }: { embedded?: boolean }) {
```

- [x] **Step 4: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/Eligibility.tsx src/pages/Calculator.tsx src/pages/Recours.tsx`
Expected: exit 0. (`Link`, `ArrowLeft` still used by the standalone header inside the guard — no unused warning.)

- [x] **Step 5: Commit**

```bash
git add src/pages/Eligibility.tsx src/pages/Calculator.tsx src/pages/Recours.tsx
git commit -m "feat: add embedded mode to Eligibility, Calculator and Recours

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `embedded` prop for CandidacyAssistant

**Files:**
- Modify: `frontend/src/pages/CandidacyAssistant.tsx`

**Interfaces:**
- Produces: `CandidacyAssistant` default export accepts `{ embedded?: boolean }`; embedded hides its header block + outer padding. It keeps reading `?tender=` via `useSearchParams` (both tender and no-tender modes work). Task 4 renders `<CandidacyAssistant embedded />`.

- [x] **Step 1: Change the signature**

Replace:

```tsx
export default function CandidacyAssistant() {
  const [searchParams] = useSearchParams();
  const tenderId = searchParams.get("tender") || "";
```

with:

```tsx
export default function CandidacyAssistant({ embedded = false }: { embedded?: boolean }) {
  const [searchParams] = useSearchParams();
  const tenderId = searchParams.get("tender") || "";
```

- [x] **Step 2: Guard the header block + outer padding**

Replace:

```tsx
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        {tenderId && (
          <Link
            to={`/tenders/${tenderId}`}
            className="inline-flex items-center gap-1.5 mb-3 text-sm font-sans text-[var(--color-crimson)] hover:underline"
          >
            <ArrowLeft size={14} /> Retour à la consultation
          </Link>
        )}
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Assistant candidature
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Constituez un dossier conforme au décret n° 2.22.431 : pièces exigées, seuils et contrôles de prix.
        </p>
        {tender && (
          <p className="font-sans text-sm text-[var(--color-charcoal)] ml-[34px] mt-2 border-l-2 border-[var(--color-gold)] pl-3">
            {tender.reference} — {tender.details?.objet || tender.title}
          </p>
        )}
      </div>
```

with:

```tsx
  return (
    <div className={embedded ? "" : "max-w-7xl mx-auto px-4 sm:px-6 py-8"}>
      {/* Header */}
      <div className="mb-8">
        {!embedded && tenderId && (
          <Link
            to={`/tenders/${tenderId}`}
            className="inline-flex items-center gap-1.5 mb-3 text-sm font-sans text-[var(--color-crimson)] hover:underline"
          >
            <ArrowLeft size={14} /> Retour à la consultation
          </Link>
        )}
        {!embedded && (
          <>
            <div className="flex items-center gap-2.5 mb-1">
              <Sparkles className="w-6 h-6 text-[var(--color-crimson)]" />
              <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
                Assistant candidature
              </h1>
            </div>
            <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
              Constituez un dossier conforme au décret n° 2.22.431 : pièces exigées, seuils et contrôles de prix.
            </p>
          </>
        )}
        {tender && (
          <p className="font-sans text-sm text-[var(--color-charcoal)] ml-[34px] mt-2 border-l-2 border-[var(--color-gold)] pl-3">
            {tender.reference} — {tender.details?.objet || tender.title}
          </p>
        )}
      </div>
```

(The `tender` reference line is kept in both modes — it is useful context when a consultation is loaded inside the guide.)

- [x] **Step 3: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/CandidacyAssistant.tsx`
Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add src/pages/CandidacyAssistant.tsx
git commit -m "feat: add embedded mode to CandidacyAssistant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Guide page (journey scroll + anchor rail + scrollspy)

**Files:**
- Create: `frontend/src/pages/Guide.tsx`

**Interfaces:**
- Consumes: `Procedures`, `Eligibility`, `Calculator`, `CandidacyAssistant`, `Recours` (all with `embedded` from Tasks 1–3).
- Produces: `Guide` default export (no props). Task 5 lazy-imports it and routes `/guide` to it.

- [x] **Step 1: Create `frontend/src/pages/Guide.tsx`**

Exact content:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Scale, ShieldCheck, Calculator as CalcIcon, Sparkles, Gavel } from "lucide-react";
import Procedures from "./Procedures";
import Eligibility from "./Eligibility";
import Calculator from "./Calculator";
import CandidacyAssistant from "./CandidacyAssistant";
import Recours from "./Recours";

const SECTIONS = [
  { id: "procedures", label: "Procédures", icon: Scale },
  { id: "eligibilite", label: "Éligibilité", icon: ShieldCheck },
  { id: "calculateur", label: "Calculateurs", icon: CalcIcon },
  { id: "assistant", label: "Assistant", icon: Sparkles },
  { id: "recours", label: "Recours", icon: Gavel },
] as const;

export default function Guide() {
  const [active, setActive] = useState<string>("procedures");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Scale className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Guide & Outils
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          De la procédure au recours : comprendre le mode de passation, vérifier votre éligibilité,
          chiffrer pénalités et cautions, préparer votre dossier et connaître vos voies de recours.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        <nav className="hidden lg:block" aria-label="Sommaire">
          <ul className="sticky top-6 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-sans text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--color-ivory-dim)] text-[var(--color-crimson)] font-semibold"
                        : "text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={isActive ? "text-[var(--color-crimson)]" : "text-[var(--color-slate)]"}
                    />
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-14 min-w-0">
          <section id="procedures" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Procédures de passation
            </h2>
            <Procedures embedded />
          </section>

          <section id="eligibilite" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Vérificateur d'éligibilité
            </h2>
            <Eligibility embedded />
          </section>

          <section id="calculateur" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Calculateurs
            </h2>
            <Calculator embedded />
          </section>

          <section id="assistant" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-2">
              Assistant candidature
            </h2>
            <p className="font-sans text-sm text-[var(--color-slate)] mb-4">
              Renseignez votre marché ci-dessous, ou{" "}
              <Link to="/tenders" className="text-[var(--color-crimson)] hover:underline">
                ouvrez une consultation
              </Link>{" "}
              pour l'analyser automatiquement.
            </p>
            <CandidacyAssistant embedded />
          </section>

          <section id="recours" className="scroll-mt-6">
            <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)] mb-4">
              Assistant recours
            </h2>
            <Recours embedded />
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/Guide.tsx`
Expected: exit 0.

- [x] **Step 3: Commit**

```bash
git add src/pages/Guide.tsx
git commit -m "feat: add merged Guide & Outils page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire route, navbar, and tender-detail link

**Files:**
- Modify: `frontend/src/App.tsx` (lazy import + route)
- Modify: `frontend/src/components/Navbar.tsx` (`moreLinks` + lucide imports)
- Modify: `frontend/src/pages/TenderDetail.tsx:172` (assistant link)

**Interfaces:**
- Consumes: `Guide` default export from Task 4.
- Produces: route `/guide` (lazy); navbar single "Guide & Outils" entry; tender-detail link → `/guide?tender=…#assistant`.

- [x] **Step 1: Add lazy Guide route in App.tsx**

In `frontend/src/App.tsx`, add next to the existing lazy import:

```tsx
const CandidacyAssistant = lazy(() => import("./pages/CandidacyAssistant"));
```
add below it:
```tsx
const Guide = lazy(() => import("./pages/Guide"));
```

Then add the route (place it right after the `/assistant` route's closing `/>`, before `<Route path="/recours" …`):

```tsx
              <Route
                path="/guide"
                element={
                  <Suspense
                    fallback={
                      <div className="flex justify-center py-20">
                        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
                      </div>
                    }
                  >
                    <Guide />
                  </Suspense>
                }
              />
```

- [x] **Step 2: Update navbar `moreLinks` and imports**

In `frontend/src/components/Navbar.tsx`, replace:

```tsx
  const moreLinks = [
    { to: "/assistant", label: "Assistant", icon: Sparkles },
    { to: "/procedures", label: "Procedures", icon: Scale },
    { to: "/blog", label: "Blog", icon: BookOpen },
    { to: "/pricing", label: "Tarifs", icon: CreditCard },
    { to: "/calculator", label: "Calculateur", icon: Calculator },
    { to: "/partenaires", label: "Partenaires", icon: Handshake },
  ];
```

with:

```tsx
  const moreLinks = [
    { to: "/guide", label: "Guide & Outils", icon: Scale },
    { to: "/blog", label: "Blog", icon: BookOpen },
    { to: "/pricing", label: "Tarifs", icon: CreditCard },
    { to: "/partenaires", label: "Partenaires", icon: Handshake },
  ];
```

Then update the lucide import to drop the now-unused `Sparkles` and `Calculator` (keep `Scale`, `BookOpen`, `CreditCard`, `Handshake`, and everything else):

```tsx
import {
  LayoutDashboard, Search, BarChart3,
  CreditCard, BookOpen, Scale, Bell, Heart, LogIn, LogOut, User, Menu,
  Sun, Moon, Handshake,
} from "lucide-react";
```

- [x] **Step 3: Update the tender-detail assistant link**

In `frontend/src/pages/TenderDetail.tsx`, replace:

```tsx
          to={`/assistant?tender=${tender.id}`}
```
with:
```tsx
          to={`/guide?tender=${tender.id}#assistant`}
```

- [x] **Step 4: Typecheck, lint, build**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src && npm run build`
Expected: all exit 0; build completes. (Pre-existing warnings in `Tenders.tsx`, `Toast.tsx`, `auth.tsx` are unrelated and acceptable.)

- [x] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Navbar.tsx src/pages/TenderDetail.tsx
git commit -m "feat: route /guide, collapse navbar tools into Guide & Outils

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end visual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: running backend (port 8000) + frontend dev server; all previous tasks committed.
- Produces: verification evidence; no code.

- [x] **Step 1: Start dev servers**

Backend (needed for the assistant's tender fetch): if not already listening on 8000, note that `npm run dev:backend` may be broken (venv shebang points to an old path); a backend process is expected to already be running on port 8000 (`lsof -nP -iTCP:8000 -sTCP:LISTEN`). If none, ask the user.
Frontend: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npm run dev` (background). **Read the dev-server output for the actual port — 5173/5174 may be held by other Vite apps; this app may land on 5175.**

- [x] **Step 2: Verify the guide renders in journey order**

Dump the DOM:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=1280,4000 --virtual-time-budget=10000 --dump-dom "http://localhost:<PORT>/guide"
```
Check the rendered DOM contains, in order: `id="procedures"`, `id="eligibilite"`, `id="calculateur"`, `id="assistant"`, `id="recours"`; the anchor rail `<a href="#calculateur">` etc.; the "Guide & Outils" `<h1>`; and exactly one `<h1>` (embedded children hide theirs).

- [x] **Step 3: Verify assistant tender mode via the guide**

Pick a tender id: `sqlite3 /Users/mkroze/Developer/my_hub/public_market_annonce/backend/data/tenders.db "SELECT id FROM tenders LIMIT 1;"`.
Dump `http://localhost:<PORT>/guide?tender=<id>` and confirm the assistant section shows the tender reference line (the `border-l-2 border-[var(--color-gold)]` paragraph) and the compliance checklist rendered (text from `ComplianceChecklist`). Also dump `/guide` with no tender and confirm the "ouvrez une consultation" CTA link is present.

- [x] **Step 4: Verify old routes + navbar**

- `http://localhost:<PORT>/procedures`, `/eligibility`, `/calculator`, `/recours`, `/assistant` each still render standalone with their own `<h1>` (dump DOM, grep the title).
- Navbar DOM (from any dump): the "more" dropdown lists "Guide & Outils" and does NOT list "Assistant", "Procedures" or "Calculateur" as separate items.
- A tender detail page (`/tenders/<id>`) "analyser" link `href` contains `/guide?tender=`.

- [x] **Step 5: Stop servers and mark plan executed**

Kill the background frontend server. Then:

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce
# tick checkboxes
python3 -c "p='docs/superpowers/plans/2026-07-19-guide-outils-consolidation.md';s=open(p).read().replace('- [x] ','- [x] ');open(p,'w').write(s)"
git add docs/superpowers/plans/2026-07-19-guide-outils-consolidation.md
git commit -m "docs: mark guide & outils consolidation plan as executed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- Spec coverage: embedded prop for all five components (Tasks 1–3), Guide page with anchor rail + scrollspy + both assistant modes (Task 4), lazy route + navbar collapse + tender-detail link (Task 5), verification incl. old-route regression (Task 6). Out-of-scope untouched. ✓
- Assistant both modes: `CandidacyAssistant` reads `?tender=` itself; Guide adds the no-tender CTA. ✓
- Deep-link `#calculateur`: sections carry `scroll-mt-6`; native anchor scroll. ✓
- Name consistency: `embedded` prop everywhere; section ids `procedures|eligibilite|calculateur|assistant|recours`; route `/guide`. ✓
- No placeholders; all code complete. ✓
