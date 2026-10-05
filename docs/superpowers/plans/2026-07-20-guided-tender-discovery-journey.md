# Guided Tender Discovery Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the app around a beginner "Je decouvre les marches publics" journey that starts from real tender opportunities and guides the user toward understanding, deciding, preparing, and tracking.

**Architecture:** Keep the current React/Vite/FastAPI contract and reshape the frontend journey through small shared helper modules plus page-level composition changes. Add reusable tender guidance helpers and card components, then use them in Overview, Consultations, Tender Detail, Guide, Favorites, and Alerts without backend schema changes.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite 8, Tailwind CSS 4, daisyUI 5, lucide-react, existing FastAPI API contract.

## Global Constraints

- Primary actor is a beginner Moroccan SME owner or manager.
- Use the hybrid approach: guided start plus tender-first discovery.
- Preserve expert workflows as secondary affordances: dense table, advanced filters, export.
- No backend data model migration.
- Beginner labels must only use reliable fields already exposed by the backend.
- If a label depends on uncertain or missing data, phrase it as something to verify, not as a verdict.
- "Mes opportunites" initially reframes existing favorites and alerts rather than merging their data models.
- Keep styling aligned with the current academic theme.
- Preserve existing user changes in the dirty worktree.
- The frontend has no configured test runner; verification for this plan uses TypeScript/Vite build plus manual browser checks.

---

## File Structure

- Create `frontend/src/lib/tenderGuidance.ts`: pure helper functions for beginner-facing labels, decision checklist items, and guided filter query conversion.
- Create `frontend/src/components/TenderCard.tsx`: beginner-readable tender card used by Overview and guided Consultations.
- Modify `frontend/src/components/Navbar.tsx`: journey-first navigation labels and grouped secondary links.
- Modify `frontend/src/pages/Overview.tsx`: replace stats-first launchpad with guided discovery plus active tender preview.
- Modify `frontend/src/pages/Tenders.tsx`: add guided/expert view toggle and feed guided view through `TenderCard`.
- Modify `frontend/src/components/FilterBar.tsx`: change copy from advanced procurement filters to beginner questions while retaining the same query contract.
- Modify `frontend/src/pages/TenderDetail.tsx`: add decision-first summary, beginner checklist, and contextual actions before raw details.
- Modify `frontend/src/pages/Guide.tsx`: detect `tender` query param and make preparation copy contextual.
- Modify `frontend/src/pages/Favorites.tsx`: reframe saved tenders as "Mes opportunites" with action-oriented grouping copy.
- Modify `frontend/src/pages/Alerts.tsx`: reframe alerts as opportunity tracking and add tender-context creation copy.
- Verify with `cd frontend && npm run build`, then inspect the journey manually in browser.

---

### Task 1: Tender Guidance Helpers

**Files:**
- Create: `frontend/src/lib/tenderGuidance.ts`
- Modify: `frontend/src/lib/tenderUtils.ts`

**Interfaces:**
- Consumes: `Tender`, `TenderWithDetails`, `TenderUrgency`, `getTenderUrgency(deadline: string, now?: Date)`
- Produces: `getTenderGuidance(tender: Tender, now?: Date): TenderGuidance`
- Produces: `getTenderDecisionChecklist(tender: TenderWithDetails, now?: Date): DecisionChecklistItem[]`
- Produces: `buildGuidedTenderQuery(input: GuidedTenderInput): Partial<TenderFilters>`

- [ ] **Step 1: Add guidance helper module**

Create `frontend/src/lib/tenderGuidance.ts` with:

```ts
import type { Tender, TenderFilters, TenderWithDetails } from "./types";
import { getTenderUrgency } from "./tenderUtils";

export type GuidanceTone = "positive" | "warning" | "critical" | "neutral";

export interface TenderGuidance {
  label: string;
  tone: GuidanceTone;
  reasons: string[];
}

export interface DecisionChecklistItem {
  id: string;
  label: string;
  value: string;
  tone: GuidanceTone;
  action: string;
}

export interface GuidedTenderInput {
  activity: string;
  location: string;
  deadlineWindow: "any" | "7d" | "14d" | "30d";
  budgetRange: "any" | "small" | "medium" | "large";
}

function hasValue(value: string | undefined | null): value is string {
  return Boolean(value && value.trim());
}

export function getTenderGuidance(tender: Tender, now = new Date()): TenderGuidance {
  const urgency = getTenderUrgency(tender.deadline, now);
  const reasons: string[] = [];

  if (urgency?.expired) {
    return {
      label: "Expiree",
      tone: "critical",
      reasons: ["La date limite est deja passee."],
    };
  }

  if (urgency && urgency.days <= 3) {
    reasons.push("Delai tres court pour verifier le dossier.");
    return { label: "Delai court", tone: "critical", reasons };
  }

  if (urgency && urgency.days <= 7) {
    reasons.push("A verifier rapidement cette semaine.");
    return { label: "A verifier vite", tone: "warning", reasons };
  }

  if (hasValue(tender.estimation)) reasons.push("Estimation disponible pour cadrer l'opportunite.");
  if (hasValue(tender.location)) reasons.push("Localisation indiquee.");
  if (!hasValue(tender.estimation)) reasons.push("Budget a verifier dans le DCE.");

  return {
    label: hasValue(tender.estimation) ? "Facile a comparer" : "Budget a verifier",
    tone: hasValue(tender.estimation) ? "positive" : "neutral",
    reasons,
  };
}

export function getTenderDecisionChecklist(tender: TenderWithDetails, now = new Date()): DecisionChecklistItem[] {
  const details = tender.details;
  const urgency = getTenderUrgency(tender.deadline, now);

  return [
    {
      id: "deadline",
      label: "Delai de reponse",
      value: urgency ? `${tender.deadline} (${urgency.label})` : tender.deadline || "Non indique",
      tone: urgency?.expired || (urgency && urgency.days <= 3) ? "critical" : urgency && urgency.days <= 7 ? "warning" : "positive",
      action: urgency?.expired
        ? "Ne pas poursuivre sans confirmation sur le portail source."
        : urgency && urgency.days <= 3
          ? "Verifier immediatement si le dossier est realiste."
          : "Planifier la lecture du DCE.",
    },
    {
      id: "location",
      label: "Lieu d'execution",
      value: details?.lieu_execution || tender.location || "Non indique",
      tone: details?.lieu_execution || tender.location ? "neutral" : "warning",
      action: "Confirmer que votre entreprise peut intervenir dans cette zone.",
    },
    {
      id: "budget",
      label: "Estimation ou budget",
      value: details?.estimation || tender.estimation || "A verifier dans le DCE",
      tone: details?.estimation || tender.estimation ? "positive" : "warning",
      action: "Comparer ce montant avec votre capacite commerciale et financiere.",
    },
    {
      id: "caution",
      label: "Caution provisoire",
      value: details?.caution_provisoire || "A verifier dans le DCE",
      tone: details?.caution_provisoire ? "neutral" : "warning",
      action: "Verifier si une garantie bancaire est necessaire avant de preparer l'offre.",
    },
    {
      id: "qualifications",
      label: "Qualifications ou agrements",
      value: details?.qualifications || details?.agrements || "A verifier dans le DCE",
      tone: details?.qualifications || details?.agrements ? "warning" : "neutral",
      action: "Controler les certificats, agrements ou references demandes.",
    },
    {
      id: "documents",
      label: "Documents",
      value: details?.dce_url ? "DCE disponible" : "DCE a recuperer sur le portail",
      tone: details?.dce_url ? "positive" : "warning",
      action: "Telecharger le DCE et lire le reglement de consultation en premier.",
    },
  ];
}

export function buildGuidedTenderQuery(input: GuidedTenderInput): Partial<TenderFilters> {
  return {
    q: input.activity.trim(),
    location: input.location.trim(),
    status: "en_cours",
    sort: "deadline",
    order: "asc",
    page: 1,
    per_page: input.deadlineWindow === "any" ? 20 : 50,
  };
}
```

- [ ] **Step 2: Verify helper compiles**

Run: `cd frontend && npm run build`

Expected: command exits 0. If it fails because an imported type name is wrong, fix the import to match `frontend/src/lib/types.ts` and rerun.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/tenderGuidance.ts
git commit -m "feat: add beginner tender guidance helpers"
```

---

### Task 2: Beginner Tender Card Component

**Files:**
- Create: `frontend/src/components/TenderCard.tsx`

**Interfaces:**
- Consumes: `Tender`
- Consumes: `favoriteIds?: Set<string>`
- Consumes: `onFavoriteToggle?: () => void`
- Consumes: `getTenderGuidance(tender: Tender): TenderGuidance`
- Produces: `TenderCard({ tender, favoriteIds, onFavoriteToggle, compact }: TenderCardProps)`

- [ ] **Step 1: Create card component**

Create `frontend/src/components/TenderCard.tsx` with:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Building2, Calendar, Heart, MapPin, Sparkles } from "lucide-react";
import { addFavorite, removeFavorite } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getTenderGuidance } from "../lib/tenderGuidance";
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import type { Tender } from "../lib/types";

interface TenderCardProps {
  tender: Tender;
  favoriteIds?: Set<string>;
  onFavoriteToggle?: () => void;
  compact?: boolean;
}

const TONE_CLASS = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-slate)]",
};

export default function TenderCard({ tender, favoriteIds, onFavoriteToggle, compact = false }: TenderCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toggling, setToggling] = useState(false);
  const guidance = getTenderGuidance(tender);
  const urgency = getTenderUrgency(tender.deadline);
  const isFavorite = favoriteIds?.has(tender.id);

  async function toggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(toTenderPath(tender.id))}`);
      return;
    }

    setToggling(true);
    try {
      if (isFavorite) await removeFavorite(tender.id);
      else await addFavorite(tender.id);
      onFavoriteToggle?.();
    } finally {
      setToggling(false);
    }
  }

  return (
    <article className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] transition-colors hover:border-[var(--color-border)]">
      <Link to={toTenderPath(tender.id)} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 font-sans text-xs font-semibold ${TONE_CLASS[guidance.tone]}`}>
                {guidance.label}
              </span>
              {tender.category && (
                <span className="rounded border border-[var(--color-border-subtle)] px-2 py-0.5 font-sans text-xs text-[var(--color-slate)]">
                  {tender.category}
                </span>
              )}
            </div>
            <h3 className="font-display text-base font-bold leading-snug text-[var(--color-charcoal)]">
              {tender.title || tender.reference}
            </h3>
            {!compact && tender.reference && (
              <p className="mt-1 font-sans text-xs text-[var(--color-slate)]">{tender.reference}</p>
            )}
          </div>
          <button
            type="button"
            className={`btn btn-ghost btn-sm btn-square shrink-0 ${isFavorite ? "text-[var(--color-crimson)]" : "text-[var(--color-slate)]"}`}
            onClick={toggleFavorite}
            disabled={toggling}
            aria-label={isFavorite ? "Retirer de mes opportunites" : "Ajouter a mes opportunites"}
          >
            <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 font-sans text-sm text-[var(--color-slate)] sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span className="truncate">{tender.entity || "Acheteur non indique"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span className="truncate">{tender.location || "Lieu a verifier"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span>{tender.deadline || "Date limite a verifier"}{urgency ? ` · ${urgency.label}` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Banknote size={14} className="shrink-0 text-[var(--color-crimson)]" />
            <span>{tender.estimation || "Budget a verifier"}</span>
          </div>
        </dl>

        {!compact && guidance.reasons.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 font-sans text-xs text-[var(--color-slate)]">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--color-crimson)]" />
            {guidance.reasons[0]}
          </p>
        )}
      </Link>
    </article>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd frontend && npm run build`

Expected: command exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TenderCard.tsx
git commit -m "feat: add guided tender card"
```

---

### Task 3: Journey-First Navigation

**Files:**
- Modify: `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Consumes: existing React Router paths
- Produces: primary nav labels `Decouvrir`, `Mes opportunites`, `Preparer`, `Suivre`

- [ ] **Step 1: Replace top-level nav groups**

In `frontend/src/components/Navbar.tsx`, replace `mainLinks` and `moreLinks` with:

```ts
const mainLinks = [
  { to: "/", label: "Decouvrir", icon: LayoutDashboard },
  { to: "/favorites", label: "Mes opportunites", icon: Heart },
  { to: "/guide", label: "Preparer", icon: Scale },
  { to: "/alerts", label: "Suivre", icon: Bell },
];

const moreLinks = [
  { to: "/tenders", label: "Toutes les consultations", icon: Search },
  { to: "/stats", label: "Statistiques", icon: BarChart3 },
  { to: "/blog", label: "Blog", icon: BookOpen },
  { to: "/pricing", label: "Tarifs", icon: CreditCard },
  { to: "/partenaires", label: "Partenaires", icon: Handshake },
];
```

Keep `navLinks = [...mainLinks, ...moreLinks]` for the mobile dropdown. On desktop, render all `navLinks` in the existing bottom nav, with the four journey links first. Do not add a new dropdown in this task.

- [ ] **Step 2: Update auth menu wording**

Change account dropdown labels:

```tsx
<Heart size={14} /> Mes opportunites
```

and:

```tsx
<Bell size={14} /> Mes suivis
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build`

Expected: command exits 0.

Manual check:

- Desktop nav starts with `Decouvrir`, `Mes opportunites`, `Preparer`, `Suivre`.
- Mobile dropdown still exposes all routes.
- User/account menu still opens.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Navbar.tsx
git commit -m "feat: reframe navigation around beginner journey"
```

---

### Task 4: Overview Guided Discovery

**Files:**
- Modify: `frontend/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `getOverview()`
- Consumes: `getTenders(filters?: Partial<TenderFilters>)`
- Consumes: `buildGuidedTenderQuery(input: GuidedTenderInput)`
- Consumes: `TenderCard`

- [ ] **Step 1: Import tender preview dependencies**

In `frontend/src/pages/Overview.tsx`, update imports:

```ts
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Layers, RefreshCw, Search, TrendingUp } from "lucide-react";
import TenderCard from "../components/TenderCard";
import { getOverview, getTenders, triggerScrape } from "../lib/api";
import { buildGuidedTenderQuery, type GuidedTenderInput } from "../lib/tenderGuidance";
import type { OverviewResponse, Tender } from "../lib/types";
```

- [ ] **Step 2: Add guided form and preview state**

Inside `Overview`, add:

```ts
const navigate = useNavigate();
const [previewTenders, setPreviewTenders] = useState<Tender[]>([]);
const [previewError, setPreviewError] = useState("");
const [guidedInput, setGuidedInput] = useState<GuidedTenderInput>({
  activity: "",
  location: "",
  deadlineWindow: "any",
  budgetRange: "any",
});

const guidedQuery = useMemo(() => buildGuidedTenderQuery(guidedInput), [guidedInput]);
```

Add a second `useEffect`:

```ts
useEffect(() => {
  getTenders({ status: "en_cours", sort: "deadline", order: "asc", page: 1, per_page: 6 })
    .then((res) => {
      setPreviewTenders(res.data.slice(0, 6));
      setPreviewError("");
    })
    .catch(() => setPreviewError("Impossible de charger les consultations actives."));
}, []);
```

Add submit handler:

```ts
function startGuidedSearch(event: React.FormEvent) {
  event.preventDefault();
  const params = new URLSearchParams();
  Object.entries(guidedQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      params.set(key, String(value));
    }
  });
  params.set("view", "guided");
  navigate(`/tenders?${params.toString()}`);
}
```

- [ ] **Step 3: Replace hero with guided discovery**

Replace the top hero block with:

```tsx
<section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
  <div>
    <p className="label-academic mb-2">Je decouvre les marches publics</p>
    <h1 className="font-display text-3xl font-bold leading-tight text-[var(--color-charcoal)] sm:text-4xl">
      Trouvez des consultations publiques que vous pouvez comprendre et verifier.
    </h1>
    <p className="mt-3 max-w-2xl font-sans text-base text-[var(--color-slate)]">
      Commencez avec quelques questions simples. L'application vous montre ensuite les opportunites actives et les points a verifier avant de preparer une candidature.
    </p>
    <div className="mt-5 flex flex-wrap gap-3">
      <Link to="/tenders?status=en_cours&view=guided" className="btn btn-primary gap-2 font-sans font-semibold">
        <Search size={16} /> Voir les opportunites
      </Link>
      <Link to="/guide" className="btn btn-outline gap-2 font-sans font-semibold">
        Comprendre les etapes
      </Link>
    </div>
  </div>

  <form onSubmit={startGuidedSearch} className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] p-4 sm:p-5">
    <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Recherche guidee</h2>
    <div className="mt-4 space-y-3">
      <label className="block space-y-1">
        <span className="label-academic text-xs">Que vendez-vous ?</span>
        <input className="input input-bordered w-full" value={guidedInput.activity} onChange={(event) => setGuidedInput((current) => ({ ...current, activity: event.target.value }))} placeholder="Ex: nettoyage, travaux, fournitures..." />
      </label>
      <label className="block space-y-1">
        <span className="label-academic text-xs">Ou pouvez-vous intervenir ?</span>
        <input className="input input-bordered w-full" value={guidedInput.location} onChange={(event) => setGuidedInput((current) => ({ ...current, location: event.target.value }))} placeholder="Ville ou region" />
      </label>
      <label className="block space-y-1">
        <span className="label-academic text-xs">Delai de reponse</span>
        <select className="select select-bordered w-full" value={guidedInput.deadlineWindow} onChange={(event) => setGuidedInput((current) => ({ ...current, deadlineWindow: event.target.value as GuidedTenderInput["deadlineWindow"] }))}>
          <option value="any">Tous les delais</option>
          <option value="7d">Cette semaine</option>
          <option value="14d">Deux semaines</option>
          <option value="30d">Un mois</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary w-full gap-2 font-sans font-semibold">
        Chercher <ArrowRight size={15} />
      </button>
    </div>
  </form>
</section>
```

- [ ] **Step 4: Add tender preview before sector grids**

After the scrape result/status block and before category sector cards, render:

```tsx
<section className="space-y-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h2 className="font-display text-xl font-bold text-[var(--color-charcoal)]">Opportunites actives a verifier</h2>
      <p className="font-sans text-sm text-[var(--color-slate)]">Un premier apercu pour comprendre ce qui est disponible maintenant.</p>
    </div>
    <Link to="/tenders?status=en_cours&view=guided" className="hidden font-sans text-sm font-semibold text-[var(--color-crimson)] hover:underline sm:inline">
      Voir tout
    </Link>
  </div>
  {previewError ? (
    <div className="rounded border border-[var(--color-crimson)] border-l-4 px-4 py-3 font-sans text-sm text-[var(--color-charcoal)]">{previewError}</div>
  ) : (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {previewTenders.map((tender) => <TenderCard key={tender.id} tender={tender} compact />)}
    </div>
  )}
</section>
```

- [ ] **Step 5: Demote sector grids copy**

Rename the sector grid heading area to support exploration:

```tsx
<h2 className="font-display text-xl font-bold text-[var(--color-charcoal)]">{cat}</h2>
```

Keep existing sector links. Do not remove stats data; it supports discovery after the tender preview.

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build`

Expected: command exits 0.

Manual check:

- Homepage first viewport explains beginner discovery.
- Guided form navigates to `/tenders?...&view=guided`.
- Active tender preview renders real cards or a clear error.
- Import button and scrape result still work.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Overview.tsx
git commit -m "feat: rebuild overview as guided tender discovery"
```

---

### Task 5: Consultations Guided View

**Files:**
- Modify: `frontend/src/pages/Tenders.tsx`
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/TenderTable.tsx`

**Interfaces:**
- Consumes: `TenderCard`
- Consumes: existing `view` URL query param
- Produces: guided/expert toggle controlled by `view=guided|expert`

- [ ] **Step 1: Add view mode to Tenders**

In `frontend/src/pages/Tenders.tsx`, import:

```ts
import TenderCard from "../components/TenderCard";
```

Add:

```ts
const viewMode = searchParams.get("view") === "expert" ? "expert" : "guided";
```

Add function:

```ts
function setViewMode(mode: "guided" | "expert") {
  const params = new URLSearchParams(searchParams);
  params.set("view", mode);
  setSearchParams(params);
}
```

- [ ] **Step 2: Preserve view param in filter updates**

At the end of `updateFilters`, before `setSearchParams(params)`, add:

```ts
params.set("view", viewMode);
```

- [ ] **Step 3: Add beginner header copy and toggle**

Below the title/result header, add:

```tsx
<div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-4 py-3">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)]">Comparez les opportunites avant d'ouvrir le detail.</p>
      <p className="font-sans text-xs text-[var(--color-slate)]">La vue guidee met en avant le delai, le lieu, le budget et les points a verifier.</p>
    </div>
    <div className="join">
      <button type="button" className={`btn join-item btn-sm ${viewMode === "guided" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("guided")}>Guidee</button>
      <button type="button" className={`btn join-item btn-sm ${viewMode === "expert" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("expert")}>Tableau</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Render guided cards by default**

Replace the unconditional `TenderTable` render with:

```tsx
{viewMode === "guided" ? (
  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
    {displayedTenders.map((tender) => (
      <TenderCard
        key={tender.id}
        tender={tender}
        favoriteIds={favoriteIds}
        onFavoriteToggle={loadFavorites}
      />
    ))}
  </div>
) : (
  <TenderTable
    tenders={displayedTenders}
    sort={filters.sort || "deadline"}
    order={filters.order || "asc"}
    onSort={handleSort}
    favoriteIds={favoriteIds}
    onFavoriteToggle={loadFavorites}
  />
)}
```

Keep `Pagination` below both modes.

- [ ] **Step 5: Change FilterBar copy to beginner questions**

In `frontend/src/components/FilterBar.tsx`, change heading and helper copy:

```tsx
<h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
  Trouver une opportunite
</h2>
<p className="font-sans text-xs text-[var(--color-slate)]">
  Commencez simple : activite, lieu, puis ajoutez des criteres si besoin.
</p>
```

Change search placeholder:

```tsx
placeholder="Activite, mot-cle, acheteur..."
```

Change the category label to:

```tsx
<span className="label-academic text-xs">Type d'achat public</span>
```

Change sector label to:

```tsx
<span className="label-academic text-xs">Domaine d'activite</span>
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build`

Expected: command exits 0.

Manual check:

- `/tenders` defaults to guided cards.
- Expert/table toggle works and preserves current filters.
- Advanced filters still apply the same API query.
- Favorites toggle works from guided cards for logged-in users.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Tenders.tsx frontend/src/components/FilterBar.tsx frontend/src/components/TenderTable.tsx
git commit -m "feat: add guided consultations view"
```

---

### Task 6: Tender Detail Decision Page

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`

**Interfaces:**
- Consumes: `getTenderDecisionChecklist(tender: TenderWithDetails): DecisionChecklistItem[]`
- Consumes: existing `downloadDce`, `downloadPdf`, `toTenderPath`
- Produces: decision-first tender detail layout

- [ ] **Step 1: Import checklist helper and action icons**

In `frontend/src/pages/TenderDetail.tsx`, add imports:

```ts
import { getTenderDecisionChecklist } from "../lib/tenderGuidance";
import { Bell, CheckCircle2, HelpCircle, Heart } from "lucide-react";
```

Avoid duplicate icon imports if these icons are already imported.

- [ ] **Step 2: Create tone classes**

Near `CATEGORY_COLORS`, add:

```ts
const CHECK_TONE_CLASS = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)]",
};
```

- [ ] **Step 3: Compute checklist**

After `const urgency = getTenderUrgency(tender.deadline);`, add:

```ts
const checklist = getTenderDecisionChecklist(tender);
```

- [ ] **Step 4: Add decision summary before info cards**

Insert after the header block and before info cards:

```tsx
<section className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] p-4 sm:p-5">
  <div className="flex items-start gap-3">
    <div className="rounded bg-[var(--color-crimson)] p-2 text-white">
      <HelpCircle size={18} />
    </div>
    <div>
      <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
        Dois-je poursuivre cette opportunite ?
      </h2>
      <p className="mt-1 font-sans text-sm text-[var(--color-slate)]">
        Verifiez d'abord les points qui bloquent souvent une PME : delai, lieu, budget, caution, qualifications et documents.
      </p>
    </div>
  </div>

  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
    {checklist.map((item) => (
      <div key={item.id} className={`rounded border p-3 ${CHECK_TONE_CLASS[item.tone]}`}>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-sans text-sm font-semibold">{item.label}</p>
            <p className="mt-0.5 font-sans text-sm">{item.value}</p>
            <p className="mt-1 font-sans text-xs opacity-80">{item.action}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 5: Move primary actions nearer decision area**

Keep the existing actions block, but place it immediately after the decision summary. Add the contextual alert action:

```tsx
<Link
  to={`/alerts?tender=${encodeURIComponent(tender.id)}&name=${encodeURIComponent(tender.title || tender.reference)}&sector=${encodeURIComponent(tender.sector_code || "")}&region=${encodeURIComponent(tender.location || "")}`}
  className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors text-[var(--color-charcoal)]"
>
  <Bell size={16} /> Recevoir des opportunites similaires
</Link>
```

If there is no favorite action on detail yet, add:

```tsx
<Link
  to="/favorites"
  className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors text-[var(--color-charcoal)]"
>
  <Heart size={16} /> Voir mes opportunites
</Link>
```

Do not implement a second favorite mutation in this task unless the existing favorite API state is already available on detail.

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build`

Expected: command exits 0.

Manual check:

- Tender detail first shows the decision checklist.
- Full raw details remain below.
- `Preparer ma candidature` still links to `/guide?tender=...#assistant`.
- Alert link opens `/alerts` with tender context query parameters.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/TenderDetail.tsx
git commit -m "feat: reframe tender detail as decision page"
```

---

### Task 7: Contextual Preparation And Tracking

**Files:**
- Modify: `frontend/src/pages/Guide.tsx`
- Modify: `frontend/src/pages/Alerts.tsx`
- Modify: `frontend/src/pages/Favorites.tsx`

**Interfaces:**
- Consumes: `tender`, `name`, `sector`, `region` URL query params
- Produces: beginner-context copy and prefilled alert creation

- [ ] **Step 1: Make Guide tender-aware**

In `frontend/src/pages/Guide.tsx`, import:

```ts
import { Link, useSearchParams } from "react-router-dom";
```

Inside `Guide`, add:

```ts
const [searchParams] = useSearchParams();
const tenderId = searchParams.get("tender");
```

Update the introductory paragraph:

```tsx
<p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
  {tenderId
    ? "Cette page vous aide a preparer la prochaine etape pour la consultation selectionnee."
    : "Comprendre la procedure, verifier votre eligibilite, chiffrer les cautions et preparer votre dossier."}
</p>
```

Add a contextual banner before the section grid:

```tsx
{tenderId && (
  <div className="mb-6 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-4 py-3">
    <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)]">
      Preparation depuis une consultation
    </p>
    <p className="mt-1 font-sans text-xs text-[var(--color-slate)]">
      Commencez par l'assistant, puis utilisez le calculateur ou les procedures si un point du DCE n'est pas clair.
    </p>
  </div>
)}
```

- [ ] **Step 2: Prefill alert form from tender query**

In `frontend/src/pages/Alerts.tsx`, import:

```ts
import { Link, useSearchParams } from "react-router-dom";
```

Inside `Alerts`, add:

```ts
const [searchParams] = useSearchParams();
const tenderContext = {
  tenderId: searchParams.get("tender") || "",
  name: searchParams.get("name") || "",
  sector: searchParams.get("sector") || "",
  region: searchParams.get("region") || "",
};
```

After options load and `user` is present, add a `useEffect`:

```ts
useEffect(() => {
  if (!user || !tenderContext.tenderId) return;
  setForm({
    ...EMPTY_FORM,
    name: tenderContext.name ? `Opportunites similaires - ${tenderContext.name.slice(0, 60)}` : "Opportunites similaires",
    sectors: tenderContext.sector ? [tenderContext.sector] : [],
    regions: tenderContext.region ? [tenderContext.region] : [],
  });
  setEditingId(null);
  setPreview(null);
  setShowForm(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user, tenderContext.tenderId]);
```

Update page heading:

```tsx
<h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Suivre mes opportunites</h1>
<p className="text-[var(--color-slate)] font-sans text-sm mt-1">
  Recevez par email les nouvelles consultations qui ressemblent a ce que vous cherchez.
</p>
```

- [ ] **Step 3: Reframe Favorites as opportunities**

In `frontend/src/pages/Favorites.tsx`, change heading:

```tsx
Mes opportunites sauvegardees
```

Add helper counts before the table:

```tsx
<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-4 py-3">
    <p className="label-academic">A verifier</p>
    <p className="font-display text-2xl font-bold text-[var(--color-charcoal)]">{favorites.length}</p>
  </div>
  <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-4 py-3">
    <p className="label-academic">Prochaine action</p>
    <p className="font-sans text-sm text-[var(--color-slate)]">Lire le DCE ou verifier l'eligibilite</p>
  </div>
  <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-4 py-3">
    <p className="label-academic">Suivi</p>
    <Link to="/alerts" className="font-sans text-sm font-semibold text-[var(--color-crimson)] hover:underline">Creer une alerte</Link>
  </div>
</div>
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build`

Expected: command exits 0.

Manual check:

- `/guide?tender=abc#assistant` shows contextual preparation copy.
- `/alerts?tender=abc&name=X&sector=Y&region=Z` opens the alert form with prefilled context for a logged-in user.
- Favorites page reads as opportunity tracking, not a generic favorites utility.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Guide.tsx frontend/src/pages/Alerts.tsx frontend/src/pages/Favorites.tsx
git commit -m "feat: connect preparation and tracking to tender journey"
```

---

### Task 8: Final Journey Verification

**Files:**
- Modify only if verification finds a journey-blocking issue in files touched by Tasks 1-7.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: verified beginner journey from Overview to tender detail to preparation/tracking.

- [ ] **Step 1: Run production build**

Run: `cd frontend && npm run build`

Expected: command exits 0 with Vite build output and no TypeScript errors.

- [ ] **Step 2: Start local app**

Run from repo root: `npm run dev`

Expected: backend starts on port `8000`, frontend starts on port `5173`, and Vite prints a local URL.

- [ ] **Step 3: Manually verify desktop journey**

Open `http://localhost:5173` and verify:

1. Homepage starts with "Je decouvre les marches publics" guidance.
2. Tender preview appears before sector/stat exploration.
3. Guided search navigates to `/tenders` with `view=guided`.
4. Consultations default to guided cards.
5. Expert/table toggle still works.
6. Opening a tender shows decision checklist before raw detail sections.
7. `Preparer ma candidature` opens Guide with tender context.
8. `Recevoir des opportunites similaires` opens Alerts with prefilled context for a logged-in user.

- [ ] **Step 4: Manually verify mobile journey**

Use browser responsive mode around `390x844` and verify:

1. Navbar does not overlap.
2. Homepage guided form fits without horizontal scroll.
3. Tender cards fit and text wraps professionally.
4. Advanced filters are collapsed by default.
5. Tender detail checklist is readable in one column.

- [ ] **Step 5: Fix only blocking issues**

If a blocking issue appears, make the smallest edit in the touched file. Example fixes:

```tsx
className="grid grid-cols-1 gap-3"
```

for overflowing grids, or:

```tsx
className="min-w-0 truncate"
```

for long buyer/location labels in compact rows.

- [ ] **Step 6: Re-run build**

Run: `cd frontend && npm run build`

Expected: command exits 0.

- [ ] **Step 7: Commit verification fixes if any**

If files changed:

```bash
git add frontend/src
git commit -m "fix: polish guided discovery journey"
```

If no files changed, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Guided start plus tender-first discovery: Tasks 4 and 5.
- Beginner tender comparison: Tasks 1, 2, and 5.
- Decision-first tender detail: Task 6.
- Contextual preparation: Task 7.
- Opportunity tracking: Task 7.
- Journey-first IA: Task 3.
- Advanced workflows preserved: Tasks 3 and 5.
- No backend data migration: all tasks use existing API calls and fields.

Known gap:

- There is no frontend test runner in the repo. The plan avoids adding a new dependency and relies on build plus manual journey verification.
