# Platform UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing user-facing frontend around the institutional procurement design from `design/maghreb_public_procurement_interface/DESIGN.md`, including a visible alerts bell in the navbar.

**Architecture:** Keep the current React/Vite routes, API calls, and auth guards intact. Introduce a centralized institutional token layer in `frontend/src/index.css`, then refactor shared shell/components before restyling each page surface. Avoid redesigning `/admin` in this pass.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind CSS 4, daisyUI 5, lucide-react, react-router-dom.

## Global Constraints

- Use `DESIGN.md` direction as the source: deep institutional blue, blue-gray page background, white bordered cards, amber urgency, Inter/system sans, compact density.
- Redesign only existing user-facing frontend pages and shared components.
- Do not redesign `/admin`.
- Do not change backend behavior, API calls, data shapes, protected-route logic, or route paths.
- Keep lucide icons; do not replace them with Material Symbols.
- Add a visible navbar bell icon that links to `/alerts`.
- Preserve accessible labels, visible focus, keyboard access, and WCAG AA text contrast.
- Tables may scroll horizontally inside their container, but the page must not create horizontal scroll on mobile.
- Respect `prefers-reduced-motion`.

---

## File Structure

- Modify `frontend/src/index.css`: institutional tokens, daisyUI theme, base surfaces, reusable utility classes.
- Modify `frontend/src/App.tsx`: app background/content shell sizing only, preserving routes and auth guards.
- Modify `frontend/src/components/Navbar.tsx`: desktop/mobile shell navigation, alerts bell, account menu.
- Modify `frontend/src/components/PageShell.tsx`: public/legal/content page layout.
- Modify `frontend/src/components/Breadcrumbs.tsx`: token alignment if needed.
- Modify `frontend/src/components/FilterBar.tsx`: compact search, filter panel, chips, sorting.
- Modify `frontend/src/components/TenderCard.tsx`: mobile/guided tender card based on reference.
- Modify `frontend/src/components/TenderTable.tsx`: dense institutional table styling.
- Modify `frontend/src/components/ExportDropdown.tsx`: align menu/button styling.
- Modify `frontend/src/components/Pagination.tsx`: align controls.
- Modify `frontend/src/components/Toast.tsx`: align notification styling.
- Modify `frontend/src/pages/Tenders.tsx`: dashboard-like header, summary tiles, layout.
- Modify `frontend/src/pages/TenderDetail.tsx`: reference-inspired detail layout with desktop action panel.
- Modify `frontend/src/pages/Alerts.tsx`: notification-center layout.
- Modify `frontend/src/pages/Login.tsx`: institutional auth panel.
- Modify `frontend/src/pages/Register.tsx`: institutional auth panel.
- Modify `frontend/src/pages/About.tsx`, `frontend/src/pages/Faq.tsx`, `frontend/src/pages/Contact.tsx`, and `frontend/src/pages/legal/*.tsx` only if direct page classes clash with the new `PageShell`.

Do not modify `frontend/src/admin/*` except if TypeScript imports fail due to shared token class changes.

---

### Task 1: Institutional Tokens and Base Surface

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: existing custom CSS tokens and daisyUI classes.
- Produces: stable CSS variables for later tasks:
  - `--color-app-bg`
  - `--color-surface`
  - `--color-surface-muted`
  - `--color-surface-elevated`
  - `--color-primary`
  - `--color-primary-strong`
  - `--color-primary-soft`
  - `--color-on-primary`
  - `--color-ink`
  - `--color-muted`
  - `--color-border`
  - `--color-border-strong`
  - `--color-warning`
  - `--color-warning-soft`
  - `--color-success`
  - `--color-success-soft`
  - `--color-danger`
  - `--color-danger-soft`

- [ ] **Step 1: Inspect current token usage**

Run:

```bash
rg "var\\(--color-|bg-base|btn-|card|table|badge|shadow-card|display-editorial|editorial-label|label-academic" frontend/src
```

Expected: output lists current token consumers so compatibility aliases can be kept where needed.

- [ ] **Step 2: Update `frontend/src/index.css` tokens**

Replace the current daisyUI theme and `@theme` values with this institutional set, keeping compatibility aliases for existing code:

```css
@import "tailwindcss";
@plugin "daisyui";

@plugin "daisyui/theme" {
  name: "academic";
  default: true;
  color-scheme: light;
  --color-base-100: #ffffff;
  --color-base-200: #f0f3ff;
  --color-base-300: #dce2f3;
  --color-base-content: #151c27;
  --color-primary: #00236f;
  --color-primary-content: #ffffff;
  --color-secondary: #5c5f60;
  --color-secondary-content: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-content: #151c27;
  --color-neutral: #151c27;
  --color-neutral-content: #ffffff;
  --color-info: #4059aa;
  --color-info-content: #ffffff;
  --color-success: #16803a;
  --color-success-content: #ffffff;
  --color-warning: #f59e0b;
  --color-warning-content: #151c27;
  --color-error: #ba1a1a;
  --color-error-content: #ffffff;
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}

@theme {
  --color-app-bg: #f9f9ff;
  --color-surface: #ffffff;
  --color-surface-muted: #f0f3ff;
  --color-surface-raised: #e7eefe;
  --color-surface-strong: #dce2f3;
  --color-primary: #00236f;
  --color-primary-strong: #1e3a8a;
  --color-primary-soft: #dce1ff;
  --color-on-primary: #ffffff;
  --color-ink: #151c27;
  --color-muted: #444651;
  --color-muted-light: #757682;
  --color-border: #c5c5d3;
  --color-border-subtle: #dce2f3;
  --color-warning: #f59e0b;
  --color-warning-soft: #fff2d8;
  --color-success: #16803a;
  --color-success-soft: #dff7e8;
  --color-danger: #ba1a1a;
  --color-danger-soft: #ffdad6;
  --font-display: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --shadow-card: 0 1px 2px rgba(21, 28, 39, 0.05);
  --shadow-card-hover: 0 6px 18px rgba(21, 28, 39, 0.09);
  --shadow-pop: 0 10px 30px rgba(21, 28, 39, 0.12);

  /* Compatibility aliases for existing files during this redesign. */
  --color-ivory: var(--color-surface);
  --color-ivory-dim: var(--color-surface-muted);
  --color-ivory-deep: var(--color-surface-strong);
  --color-crimson: var(--color-primary);
  --color-crimson-dark: var(--color-primary-strong);
  --color-crimson-light: #4059aa;
  --color-crimson-muted: var(--color-primary-soft);
  --color-accent: var(--color-warning);
  --color-accent-soft: var(--color-warning-soft);
  --color-charcoal: var(--color-ink);
  --color-slate: var(--color-muted);
  --color-gold: var(--color-warning);
  --color-gold-light: #ffb95f;
  --color-tone-positive: var(--color-success);
  --color-tone-positive-soft: var(--color-success-soft);
  --color-tone-warning: var(--color-warning);
  --color-tone-warning-soft: var(--color-warning-soft);
  --color-tone-critical: var(--color-danger);
  --color-tone-critical-soft: var(--color-danger-soft);
}
```

Keep or re-add the existing utility rules after this block, but update their values to use the new aliases.

- [ ] **Step 3: Add reusable institutional classes**

Add these utilities near the existing custom class section in `frontend/src/index.css`:

```css
.institutional-page {
  background: var(--color-app-bg);
  color: var(--color-ink);
}

.institutional-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 0.5rem;
  box-shadow: var(--shadow-card);
}

.institutional-control {
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-surface);
  color: var(--color-ink);
}

.institutional-control:focus,
.institutional-control:focus-visible {
  border-color: var(--color-primary);
  outline: 2px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  outline-offset: 1px;
}
```

- [ ] **Step 4: Update `PublicLayout` surface in `frontend/src/App.tsx`**

Change the top-level class from `bg-base-100` to the institutional page background:

```tsx
return (
  <div className="min-h-screen flex flex-col institutional-page">
    ...
    <main id="main-content" className="flex-1 w-full max-w-[1440px] mx-auto">
```

Keep the routes and `RequireAuth` logic unchanged.

- [ ] **Step 5: Run CSS/build verification**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/App.tsx
git commit -m "style: add institutional frontend tokens"
```

---

### Task 2: Shared Shell and Navbar Bell

**Files:**
- Modify: `frontend/src/components/Navbar.tsx`
- Modify: `frontend/src/components/PageShell.tsx`
- Modify: `frontend/src/components/Breadcrumbs.tsx`

**Interfaces:**
- Consumes: token aliases and utility classes from Task 1.
- Produces: a visible `/alerts` bell link in `Navbar`, plus consistent content shell styling.

- [ ] **Step 1: Inspect current shell references**

Run:

```bash
rg "Navbar|PageShell|Breadcrumbs|/alerts|Bell" frontend/src
```

Expected: current usages are listed; `/alerts` exists in routes and account menu.

- [ ] **Step 2: Refactor `Navbar` nav model**

In `frontend/src/components/Navbar.tsx`, keep the current imports and add `Bell` as a direct header action. Use this navigation model:

```tsx
const navLinks = [
  { to: "/tenders", label: "Consultations", icon: Search, protected: true },
  { to: "/about", label: "À propos", icon: Building2 },
  { to: "/faq", label: "FAQ", icon: CircleHelp },
  { to: "/contact", label: "Contact", icon: Mail },
];
```

The `protected` property is only for readability; do not enforce auth in the navbar.

- [ ] **Step 3: Add desktop alerts bell**

Inside the desktop auth/header controls, add this link before the account dropdown when `user` is present:

```tsx
<Link
  to="/alerts"
  className={`btn btn-ghost btn-sm btn-square rounded border border-[var(--color-border-subtle)] ${
    isActive("/alerts")
      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
      : "text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
  }`}
  aria-label="Mes alertes"
  title="Mes alertes"
>
  <Bell size={17} />
</Link>
```

Keep the existing `/alerts` item inside the account dropdown if useful, but the bell must be visible without opening the menu.

- [ ] **Step 4: Add mobile alerts bell**

In the mobile header controls, add the same `/alerts` bell when `user` is present, before the menu button:

```tsx
{user && (
  <Link
    to="/alerts"
    className="btn btn-ghost btn-sm btn-square rounded text-[var(--color-primary)]"
    aria-label="Mes alertes"
    title="Mes alertes"
  >
    <Bell size={18} />
  </Link>
)}
```

- [ ] **Step 5: Restyle navbar containers**

Use these class patterns in `Navbar`:

```tsx
<header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
  <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
```

For desktop nav links:

```tsx
className={`inline-flex h-10 items-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors ${
  active
    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
}`}
```

- [ ] **Step 6: Update `PageShell` to institutional document styling**

In `frontend/src/components/PageShell.tsx`, change the root/header/content classes to:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8">
...
<header className="institutional-panel max-w-4xl p-5 sm:p-6 mb-6 border-l-4 border-l-[var(--color-primary)]">
...
<div className="institutional-panel max-w-4xl p-5 sm:p-6 font-sans text-[var(--color-ink)] leading-relaxed ...">
```

Preserve scroll-to-top behavior and breadcrumb props.

- [ ] **Step 7: Align breadcrumbs if needed**

If `frontend/src/components/Breadcrumbs.tsx` still uses warm colors, change link/current classes to primary/muted:

```tsx
"text-[var(--color-muted)] hover:text-[var(--color-primary)]"
"text-[var(--color-ink)]"
```

- [ ] **Step 8: Run build**

```bash
cd frontend
npm run build
```

Expected: build passes and `/alerts` remains protected by route config, not navbar code.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/Navbar.tsx frontend/src/components/PageShell.tsx frontend/src/components/Breadcrumbs.tsx
git commit -m "feat: add institutional shell and alerts bell"
```

---

### Task 3: Tender Discovery Page and List Components

**Files:**
- Modify: `frontend/src/pages/Tenders.tsx`
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/TenderCard.tsx`
- Modify: `frontend/src/components/TenderTable.tsx`
- Modify: `frontend/src/components/ExportDropdown.tsx`
- Modify: `frontend/src/components/Pagination.tsx`

**Interfaces:**
- Consumes: `TenderListResponse`, `TenderFilters`, `getTenderUrgency`, `ExportDropdown`, `FilterBar`, `TenderCard`, `TenderTable`, `Pagination`.
- Produces: same route and props behavior as before. No API changes.

- [ ] **Step 1: Add local summary calculations in `Tenders.tsx`**

After `displayedTenders`, add:

```tsx
const pageSummary = useMemo(() => {
  const tenders = result?.data || [];
  const active = tenders.filter((tender) => tender.status === "en_cours").length;
  const urgent = tenders.filter((tender) => getTenderUrgency(tender.deadline)?.tone === "critical").length;
  const expired = tenders.filter((tender) => tender.status === "cloture").length;
  return { active, urgent, expired, shown: displayedTenders.length };
}, [result, displayedTenders.length]);
```

If `Tender.status` is not typed as a string in `frontend/src/lib/types.ts`, inspect the type and compare against the existing value used by the page filters.

- [ ] **Step 2: Add a small summary card helper inside `Tenders.tsx`**

Add this component above `export default function Tenders()`:

```tsx
function SummaryTile({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warning" | "neutral";
}) {
  const accent =
    tone === "warning"
      ? "border-l-[var(--color-warning)]"
      : tone === "neutral"
        ? "border-l-[var(--color-border)]"
        : "border-l-[var(--color-primary)]";

  return (
    <div className={`institutional-panel border-l-4 ${accent} px-4 py-3`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `Tenders` page header structure**

Replace the outer page container and header block with:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8 space-y-5">
  <Breadcrumbs items={[{ label: "Consultations" }]} />

  <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
        Marchés publics
      </p>
      <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--color-ink)]">Consultations</h1>
      {result && !loading && (
        <p className="mt-1 text-sm text-[var(--color-muted)] tabular-nums">
          {urgentSegmentActive
            ? `${displayedTenders.length} consultation${displayedTenders.length !== 1 ? "s" : ""} urgente${displayedTenders.length !== 1 ? "s" : ""} sur cette page`
            : `${result.total.toLocaleString("fr-FR")} résultats`}
        </p>
      )}
    </div>
    {result && !loading && result.total > 0 && (
      <ExportDropdown total={result.total} onExport={handleExport} />
    )}
  </section>
```

- [ ] **Step 4: Add summary tile row**

After the header section, add:

```tsx
{result && !loading && (
  <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <SummaryTile label="Sur cette page" value={pageSummary.shown} />
    <SummaryTile label="Urgentes" value={pageSummary.urgent} tone="warning" />
    <SummaryTile label="Expirées" value={pageSummary.expired} tone="neutral" />
  </section>
)}
```

- [ ] **Step 5: Restyle the guided/expert switch**

Replace the explanatory box with an `institutional-panel`:

```tsx
<div className="institutional-panel px-4 py-3">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-semibold text-[var(--color-ink)]">Comparez les opportunités avant d'ouvrir le détail.</p>
      <p className="text-xs text-[var(--color-muted)]">La vue guidée met en avant le délai, le lieu, le budget et les points à vérifier.</p>
    </div>
    <div className="join">
      <button type="button" className={`btn join-item btn-sm rounded ${viewMode === "guided" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("guided")}>Guidée</button>
      <button type="button" className={`btn join-item btn-sm rounded ${viewMode === "expert" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("expert")}>Tableau</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Update `FilterBar` controls**

In `frontend/src/components/FilterBar.tsx`, replace `CONTROL_CLASS` with:

```tsx
const CONTROL_CLASS =
  "institutional-control w-full px-3 py-2 font-sans text-sm transition-colors";
```

Change the root section to:

```tsx
<section className="institutional-panel overflow-hidden">
```

Change the search form wrapper to:

```tsx
<form onSubmit={applySearch} className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] p-3">
```

Use `institutional-control` on the visible search input.

- [ ] **Step 7: Update `TenderCard` to reference-inspired mobile card**

In `frontend/src/components/TenderCard.tsx`, use this article and title/action styling:

```tsx
<article className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-card transition-all hover:border-[var(--color-primary)] hover:shadow-card-hover">
  <Link to={toTenderPath(tender.id)} className="block p-5">
```

At the bottom of the card, add a divider and budget/source row:

```tsx
<div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4 flex items-center justify-between gap-3">
  <span className="text-lg font-bold tabular-nums text-[var(--color-ink)]">
    {tender.estimation || "Budget à vérifier"}
  </span>
  <span className="text-sm font-semibold text-[var(--color-primary)]">Voir le détail</span>
</div>
```

Keep the card as a single link target.

- [ ] **Step 8: Update `TenderTable` dense panel**

In `frontend/src/components/TenderTable.tsx`, change the outer wrapper to:

```tsx
<div className="institutional-panel overflow-hidden">
```

Use uppercase headers and zebra/hover rows:

```tsx
<tr className="bg-[var(--color-surface-muted)]">
```

For body rows:

```tsx
className="cursor-pointer odd:bg-[var(--color-surface)] even:bg-[var(--color-app-bg)] hover:bg-[var(--color-surface-muted)] transition-colors duration-100"
```

- [ ] **Step 9: Align export and pagination controls**

In `ExportDropdown` and `Pagination`, replace warm border/surface classes with:

```tsx
"border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]"
"hover:bg-[var(--color-surface-muted)]"
"focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
```

- [ ] **Step 10: Build**

```bash
cd frontend
npm run build
```

Expected: build passes, tender filters still update URL params, and both guided/table views render.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/Tenders.tsx frontend/src/components/FilterBar.tsx frontend/src/components/TenderCard.tsx frontend/src/components/TenderTable.tsx frontend/src/components/ExportDropdown.tsx frontend/src/components/Pagination.tsx
git commit -m "feat: redesign tender discovery interface"
```

---

### Task 4: Tender Detail Layout

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`
- Modify: `frontend/src/components/ComplianceChecklist.tsx` only if current styles clash.

**Interfaces:**
- Consumes: existing `TenderWithDetails`, display signal helpers, download handlers, checklist helpers.
- Produces: same route and actions, reorganized visual layout.

- [ ] **Step 1: Preserve data extraction**

In `TenderDetail.tsx`, keep all existing state, effects, computed values, and action handlers. Only change JSX layout and class names.

- [ ] **Step 2: Change root layout**

Replace the success-state root wrapper with:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8">
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="min-w-0 space-y-6">
      ...
    </div>
    <aside className="lg:sticky lg:top-24 lg:self-start">
      ...
    </aside>
  </div>
</div>
```

Keep breadcrumbs above the grid.

- [ ] **Step 3: Replace header panel**

Use an `institutional-panel` header:

```tsx
<section className="institutional-panel border-l-4 border-l-[var(--color-primary)] p-5 sm:p-6">
  <div className="flex flex-wrap gap-2 items-center mb-4">
    ...
  </div>
  <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-[var(--color-ink)]">{title}</h1>
  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
    ...
  </div>
</section>
```

- [ ] **Step 4: Restyle signal card grid**

Wrap the existing `SignalCard` grid in:

```tsx
<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
```

Update `SignalCard` internals so cards use:

```tsx
className="institutional-panel border-l-4 border-l-[var(--color-primary)] p-4"
```

Use amber border for deadline/urgent signals if the component can detect warning tone from `signalTone(value)`.

- [ ] **Step 5: Add process timeline panel**

After signal cards, add:

```tsx
<section className="institutional-panel p-5">
  <h2 className="text-sm font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
    Calendrier de l'appel d'offres
  </h2>
  <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <TimelineItem label="Publié le" value={rawOrMissing(d?.date_publication || tender.publication_date)} done />
    <TimelineItem label="Ouverture" value={rawOrMissing(d?.lieu_ouverture || d?.date_ouverture)} />
    <TimelineItem label="Date limite" value={deadline || "À vérifier"} warning />
  </div>
</section>
```

Define `TimelineItem` above the page component:

```tsx
function TimelineItem({ label, value, done, warning }: { label: string; value: string; done?: boolean; warning?: boolean }) {
  const tone = warning ? "text-[var(--color-warning)] bg-[var(--color-warning-soft)]" : done ? "text-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "text-[var(--color-muted)] bg-[var(--color-surface-muted)]";
  return (
    <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded ${tone}`}>
        <Calendar size={16} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
```

If either `date_publication` or `date_ouverture` is not present on the TypeScript type, use existing available fields and omit unavailable fields rather than changing API types.

- [ ] **Step 6: Move actions into desktop side panel**

Create an aside panel containing existing DCE/PDF/source actions:

```tsx
<aside className="institutional-panel p-4">
  <h2 className="text-lg font-bold text-[var(--color-ink)]">Actions du dossier</h2>
  <div className="mt-4 flex flex-col gap-3">
    ...
  </div>
  <dl className="mt-5 space-y-2 border-t border-[var(--color-border-subtle)] pt-4 text-sm">
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">Référence</dt>
      <dd className="font-semibold text-[var(--color-ink)]">{displayText(display?.reference, tender.reference)}</dd>
    </div>
  </dl>
</aside>
```

Do not remove existing action handlers or disabled/loading behavior.

- [ ] **Step 7: Restyle remaining sections**

For decision checklist, info cards, addresses, contacts, and source panels, use:

```tsx
"institutional-panel p-5"
"border border-[var(--color-border-subtle)]"
"text-[var(--color-muted)]"
```

Keep section order unless moving actions into the aside.

- [ ] **Step 8: Build**

```bash
cd frontend
npm run build
```

Expected: build passes and `TenderDetail` does not introduce missing property errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/TenderDetail.tsx frontend/src/components/ComplianceChecklist.tsx
git commit -m "feat: redesign tender detail workspace"
```

---

### Task 5: Alerts Notification Center

**Files:**
- Modify: `frontend/src/pages/Alerts.tsx`
- Modify: `frontend/src/components/Toast.tsx`

**Interfaces:**
- Consumes: existing alert API functions and `AlertPreference`, `AlertPreview`, `FiltersResponse`.
- Produces: same create/edit/delete/toggle/preview/test-email behavior with redesigned layout.

- [ ] **Step 1: Add alert summary values**

Inside `Alerts`, after `sectorName`, add:

```tsx
const activeAlerts = alerts.filter((alert) => Boolean(alert.enabled)).length;
const disabledAlerts = alerts.length - activeAlerts;
```

- [ ] **Step 2: Add an `AlertStat` helper**

Above `export default function Alerts()`, add:

```tsx
function AlertStat({ label, value, tone = "primary" }: { label: string; value: number | string; tone?: "primary" | "warning" | "neutral" }) {
  const border =
    tone === "warning"
      ? "border-l-[var(--color-warning)]"
      : tone === "neutral"
        ? "border-l-[var(--color-border)]"
        : "border-l-[var(--color-primary)]";
  return (
    <div className={`institutional-panel border-l-4 ${border} px-4 py-3`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Replace page root and header**

In the `return`, use:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8 space-y-6">
  <Breadcrumbs items={[{ label: "Alertes" }]} />
  <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
        <Bell size={15} /> Centre de notifications
      </p>
      <h1 className="mt-1 text-3xl font-bold text-[var(--color-ink)]">Mes alertes</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Suivez automatiquement les consultations qui correspondent à vos critères.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-outline btn-sm rounded gap-2" onClick={handleTestEmail} disabled={testingEmail}>
        {testingEmail ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        Email de test
      </button>
      <button type="button" className="btn btn-primary btn-sm rounded gap-2" onClick={startCreate}>
        <Plus size={15} /> Nouvelle alerte
      </button>
    </div>
  </section>
```

- [ ] **Step 4: Add alert summary row**

After the header:

```tsx
<section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
  <AlertStat label="Total" value={alerts.length} />
  <AlertStat label="Actives" value={activeAlerts} tone="primary" />
  <AlertStat label="Suspendues" value={disabledAlerts} tone="neutral" />
</section>
```

- [ ] **Step 5: Rearrange content grid**

Use a two-column workspace:

```tsx
<section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
  <div className="space-y-3">
    ...
  </div>
  <aside className="space-y-4">
    {open && editor}
    <PreviewPanel />
  </aside>
</section>
```

If the existing file renders `editor`, alert list, and preview inline, move the existing JSX into these slots without changing state or handlers.

- [ ] **Step 6: Restyle alert cards**

Each alert card should use:

```tsx
<article className={`institutional-panel p-4 ${alert.enabled ? "border-l-4 border-l-[var(--color-primary)]" : "border-l-4 border-l-[var(--color-border)]"}`}>
```

The enabled toggle remains a button or checkbox with an accessible label:

```tsx
aria-label={alert.enabled ? "Désactiver l'alerte" : "Activer l'alerte"}
```

- [ ] **Step 7: Restyle the editor panel**

Change `editor` form class to:

```tsx
className="institutional-panel p-5 space-y-4"
```

Change `CONTROL_CLASS` to:

```tsx
const CONTROL_CLASS =
  "institutional-control w-full px-3 py-2 font-sans text-sm transition-colors";
```

- [ ] **Step 8: Align toast styling**

In `Toast.tsx`, replace warm colors with institutional status tokens:

```tsx
success: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-ink)]"
error: "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-ink)]"
warning: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-ink)]"
info: "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-ink)]"
```

- [ ] **Step 9: Build**

```bash
cd frontend
npm run build
```

Expected: build passes and alert API handlers remain referenced.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Alerts.tsx frontend/src/components/Toast.tsx
git commit -m "feat: redesign alerts notification center"
```

---

### Task 6: Auth and Public Content Alignment

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx`
- Modify: `frontend/src/pages/About.tsx`
- Modify: `frontend/src/pages/Faq.tsx`
- Modify: `frontend/src/pages/Contact.tsx`
- Modify: `frontend/src/pages/legal/LegalNotice.tsx`
- Modify: `frontend/src/pages/legal/Privacy.tsx`
- Modify: `frontend/src/pages/legal/Terms.tsx`
- Modify: `frontend/src/pages/legal/Cookies.tsx`

**Interfaces:**
- Consumes: new token layer and `PageShell`.
- Produces: same forms, content, route behavior, and auth redirects.

- [ ] **Step 1: Restyle `Login` panel**

In `Login.tsx`, keep state and `handleSubmit`. Change root/panel classes:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8">
  <Breadcrumbs items={[{ label: "Compte" }, { label: "Connexion" }]} className="mb-6" />
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="institutional-panel w-full max-w-md border-l-4 border-l-[var(--color-primary)] p-6 sm:p-8">
```

Use `institutional-control` for inputs:

```tsx
className="input institutional-control w-full font-sans"
```

- [ ] **Step 2: Restyle `Register` panel**

Apply the same panel/input/button patterns as `Login.tsx`, preserving submit logic and field names.

- [ ] **Step 3: Check direct public page classes**

Run:

```bash
rg "ivory|crimson|academic|card|shadow-card|bg-base|text-base" frontend/src/pages frontend/src/components/PageShell.tsx
```

Expected: remaining classes are either compatibility aliases or page-specific classes that still render correctly.

- [ ] **Step 4: Align public pages only where they bypass `PageShell`**

For each public page that does not use `PageShell`, wrap major content in:

```tsx
<div className="px-4 py-6 sm:px-6 sm:py-8">
  <section className="institutional-panel max-w-4xl p-5 sm:p-6">
```

Do not rewrite copy or route behavior.

- [ ] **Step 5: Build**

```bash
cd frontend
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx frontend/src/pages/About.tsx frontend/src/pages/Faq.tsx frontend/src/pages/Contact.tsx frontend/src/pages/legal/LegalNotice.tsx frontend/src/pages/legal/Privacy.tsx frontend/src/pages/legal/Terms.tsx frontend/src/pages/legal/Cookies.tsx
git commit -m "style: align auth and content pages"
```

---

### Task 7: Responsive and Accessibility Verification

**Files:**
- Modify: any frontend files touched in Tasks 1-6 if verification finds issues.

**Interfaces:**
- Consumes: completed redesigned user-facing UI.
- Produces: verified build and documented fixes.

- [ ] **Step 1: Run full frontend build**

```bash
cd frontend
npm run build
```

Expected: build passes.

- [ ] **Step 2: Run lint if available**

```bash
cd frontend
npm run lint
```

Expected: lint passes, or existing unrelated lint issues are documented before fixing only those caused by this redesign.

- [ ] **Step 3: Start local dev server**

```bash
cd frontend
npm run dev
```

Expected: Vite prints a local URL, usually `http://localhost:5173/`.

- [ ] **Step 4: Check routes manually**

Open these routes in the browser:

```text
/login
/register
/tenders
/tenders/:id
/alerts
/about
/faq
/contact
```

Expected:

- Navbar bell is visible for authenticated users and routes to `/alerts`.
- Public pages use institutional surfaces.
- Tender list has summary tiles, filters, guided cards, and table view.
- Tender detail has main content plus action panel on desktop.
- Alerts page has notification-center layout.

- [ ] **Step 5: Check responsive widths**

Use browser responsive mode or screenshots at:

```text
375px
768px
1024px
1440px
```

Expected:

- No body-level horizontal scroll.
- Buttons and nav controls fit their containers.
- Tender table scrolls inside its table wrapper only.
- Alerts editor stacks under/above content on mobile.

- [ ] **Step 6: Keyboard pass**

Use Tab and Shift+Tab through:

```text
Navbar links and bell
Account menu
Mobile menu
Tender filters
View mode switch
Tender detail action buttons
Alert create/edit form
Alert enable/edit/delete controls
```

Expected: every interactive element is reachable, visibly focused, and has a clear label.

- [ ] **Step 7: Fix found regressions**

For any regression introduced by the redesign, edit the responsible file and rerun:

```bash
cd frontend
npm run build
```

Expected: build passes after each fix batch.

- [ ] **Step 8: Final commit**

```bash
git add frontend/src
git commit -m "fix: polish platform ui responsiveness"
```

Only create this commit if verification required follow-up fixes after Tasks 1-6.

---

## Self-Review

- Spec coverage: Tasks 1-6 cover tokens, shared shell, navbar bell, tender list, tender detail, alerts, auth, and public content. Task 7 covers verification.
- Scope check: `/admin` is excluded except for accidental shared build fallout.
- Placeholder scan: no incomplete-marker language remains.
- Type consistency: produced CSS variables and helper component names are defined before later tasks use them.
- Data/API consistency: no task changes API functions, route paths, auth guards, or backend contracts.
