# Core Procurement Journey Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the core procurement journey so users can discover active tenders, inspect details, save or monitor opportunities, and continue into candidacy preparation without routing, loading, mobile-filter, status, or alert-setup friction.

**Architecture:** Add small shared helpers for route-safe tender IDs, deadline parsing, and auth return intent, then reuse them in the list, detail, auth, overview, and alert pages. Keep the current React/Vite/Tailwind/daisyUI structure and avoid broad IA or backend schema changes.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite 8, Tailwind CSS 4, daisyUI 5, lucide-react, existing FastAPI API contract.

## Global Constraints

- Scope is limited to overview, consultations, tender detail, favorite/alert handoff, and guide assistant handoff.
- Blog, partners, and pricing stay unchanged except for blocking layout bugs.
- No backend data model migrations unless required for the existing route/API contract.
- Keep styling aligned with the current academic theme.
- Use French procurement terminology consistently with correct accents.
- Do not add new dependencies unless the task cannot be completed with the existing stack.
- Preserve existing user changes in the dirty worktree.

---

## File Structure

- Create `frontend/src/lib/tenderUtils.ts`: route-safe tender ID helpers, deadline parsing, urgency/status derivation.
- Modify `frontend/src/App.tsx`: keep the existing detail route and rely on encoded tender IDs unless browser verification proves a wildcard route is required.
- Modify `frontend/src/components/TenderTable.tsx`: accessible detail links, safer urgency, status labels, favorite return intent.
- Modify `frontend/src/components/FilterBar.tsx`: mobile-collapsible advanced filters, active filter count, better copy.
- Modify `frontend/src/pages/Tenders.tsx`: workbench state, status segments, API error retry, alert-from-search entry.
- Modify `frontend/src/pages/TenderDetail.tsx`: decode route ID, decision-first layout, save/alert actions, error recovery.
- Create `frontend/src/lib/returnIntent.ts`: login/register return-url helpers.
- Modify `frontend/src/pages/Login.tsx` and `frontend/src/pages/Register.tsx`: return to intended tender/action after auth.
- Modify `frontend/src/pages/Alerts.tsx`: prefill alert form from query params and use selector-like inputs where possible.
- Modify `frontend/src/pages/Overview.tsx`: launchpad status row, retry/import states, clear CTA into consultations.
- Modify `frontend/src/pages/Pricing.tsx`: fix the highlighted plan badge overlap.
- Verify with `npm run build` and Playwright screenshots.

---

### Task 1: Route-Safe Tender IDs And Deadline Helpers

**Files:**
- Create: `frontend/src/lib/tenderUtils.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/TenderTable.tsx`
- Modify: `frontend/src/pages/TenderDetail.tsx`

**Interfaces:**
- Produces: `toTenderPath(id: string): string`
- Produces: `decodeTenderRouteId(routeId: string | undefined): string`
- Produces: `parseTenderDeadline(deadline: string): Date | null`
- Produces: `getTenderUrgency(deadline: string, now?: Date): TenderUrgency | null`
- Consumes: existing `Tender.deadline`, `Tender.id`, `useParams`

- [ ] **Step 1: Add helper module**

Add `frontend/src/lib/tenderUtils.ts`:

```ts
export interface TenderUrgency {
  label: string;
  tone: "expired" | "critical" | "warning" | "normal";
  days: number;
  expired: boolean;
}

export function toTenderPath(id: string): string {
  return `/tenders/${encodeURIComponent(id)}`;
}

export function decodeTenderRouteId(routeId: string | undefined): string {
  return routeId ? decodeURIComponent(routeId) : "";
}

export function parseTenderDeadline(deadline: string): Date | null {
  if (!deadline) return null;
  const iso = Date.parse(deadline);
  if (!Number.isNaN(iso)) return new Date(iso);

  const match = deadline.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const [, day, month, year, hour = "00", minute = "00"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTenderUrgency(deadline: string, now = new Date()): TenderUrgency | null {
  const parsed = parseTenderDeadline(deadline);
  if (!parsed) return null;

  const diffMs = parsed.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return { label: "Expirée", tone: "expired", days, expired: true };
  if (days <= 3) return { label: `${days}j`, tone: "critical", days, expired: false };
  if (days <= 7) return { label: `${days}j`, tone: "warning", days, expired: false };
  return { label: `${days}j`, tone: "normal", days, expired: false };
}
```

- [ ] **Step 2: Change detail route to accept encoded IDs**

In `frontend/src/App.tsx`, keep the route path `/tenders/:id`; encoded slashes will be treated as one path segment. Do not add a wildcard route unless encoded navigation fails in browser verification.

- [ ] **Step 3: Use helpers in table navigation**

In `frontend/src/components/TenderTable.tsx`, import:

```ts
import { getTenderUrgency, toTenderPath } from "../lib/tenderUtils";
import { Link, useLocation, useNavigate } from "react-router-dom";
```

Replace any `navigate(`/tenders/${t.id}`)` with:

```ts
navigate(toTenderPath(t.id));
```

Use `toTenderPath(t.id)` for title links.

- [ ] **Step 4: Decode IDs in detail page**

In `frontend/src/pages/TenderDetail.tsx`, import:

```ts
import { decodeTenderRouteId, getTenderUrgency } from "../lib/tenderUtils";
```

Replace API calls that use `id` directly with:

```ts
const tenderId = decodeTenderRouteId(id);
```

Use `tenderId` for `getTender`, `downloadDce`, and `downloadPdf`.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build`

Expected: TypeScript and Vite build exit 0.

Manually inspect: clicking a tender whose ID contains slashes opens a detail route with `%2F` in the URL and renders the detail request using the decoded original ID.

---

### Task 2: Consultations Workbench And Mobile Filter Collapse

**Files:**
- Modify: `frontend/src/pages/Tenders.tsx`
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/TenderTable.tsx`

**Interfaces:**
- Consumes: `getTenderUrgency`, `toTenderPath`
- Produces: query-driven status segments through existing `status` and derived `urgent` query behavior

- [ ] **Step 1: Add workbench status segments**

In `frontend/src/pages/Tenders.tsx`, add segment definitions near the component:

```ts
const STATUS_SEGMENTS = [
  { key: "active", label: "En cours", filters: { status: "en_cours" } },
  { key: "urgent", label: "Urgentes", filters: { status: "en_cours", urgency: "urgent" } },
  { key: "expired", label: "Expirées", filters: { status: "cloture" } },
  { key: "all", label: "Toutes", filters: { status: "" } },
] as const;
```

If the backend does not support `urgency`, keep urgent as a client-side visual segment only after results load; do not send unsupported query params.

- [ ] **Step 2: Default to active tenders**

Change filter initialization so `status` defaults to `"en_cours"` when the URL has no `status` query:

```ts
status: searchParams.has("status") ? searchParams.get("status") || "" : "en_cours",
```

- [ ] **Step 3: Show API error with retry**

Add `error` state in `Tenders.tsx`:

```ts
const [error, setError] = useState("");
```

In fetch failure:

```ts
setError("Impossible de charger les consultations. Vérifiez l'API ou réessayez.");
setResult(null);
```

On success clear it:

```ts
setError("");
```

Render an error panel with retry:

```tsx
{error && (
  <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3">
    <p className="font-sans text-sm text-[var(--color-charcoal)]">{error}</p>
    <button className="btn btn-sm btn-primary mt-3" onClick={() => updateFilters({ ...filters })}>
      Réessayer
    </button>
  </div>
)}
```

- [ ] **Step 4: Collapse advanced filters on mobile**

In `FilterBar.tsx`, add:

```ts
const [advancedOpen, setAdvancedOpen] = useState(false);
```

Wrap the advanced grid with:

```tsx
<div className={`${advancedOpen ? "grid" : "hidden"} grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-4`}>
```

Add a mobile-only button before the grid:

```tsx
<button
  type="button"
  className="inline-flex items-center justify-center gap-2 rounded border border-[var(--color-border-subtle)] px-3 py-2 font-sans text-sm md:hidden"
  onClick={() => setAdvancedOpen((open) => !open)}
>
  <Filter size={14} />
  {advancedOpen ? "Masquer les filtres" : `Filtres avancés${activeFilters.length ? ` (${activeFilters.length})` : ""}`}
</button>
```

- [ ] **Step 5: Make table title a real link**

In `TenderTable.tsx`, wrap the title text with:

```tsx
<Link
  to={toTenderPath(t.id)}
  className="font-medium text-sm leading-tight text-[var(--color-charcoal)] hover:text-[var(--color-crimson)] hover:underline"
  onClick={(e) => e.stopPropagation()}
>
  {t.title || t.reference}
</Link>
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

Capture mobile screenshot for `/tenders`; expected: search and primary apply action are visible before advanced filters, and advanced filters are collapsed by default.

---

### Task 3: Overview Launchpad API States

**Files:**
- Modify: `frontend/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `getOverview`, `triggerScrape`
- Produces: visible loading, error, empty, success, and import-result states

- [ ] **Step 1: Add error state and retry function**

Add state:

```ts
const [error, setError] = useState("");
```

Create:

```ts
async function loadOverview() {
  setLoading(true);
  setError("");
  try {
    const overview = await getOverview();
    setData(overview);
  } catch {
    setError("Impossible de charger les données du portail pour le moment.");
    setData(null);
  } finally {
    setLoading(false);
  }
}
```

Call `loadOverview()` in `useEffect`.

- [ ] **Step 2: Add launchpad CTAs**

Add imports:

```ts
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
```

Add primary CTA beside import:

```tsx
<Link to="/tenders" className="btn btn-outline btn-sm gap-2 font-sans font-semibold">
  <Search size={14} />
  Voir les consultations
</Link>
```

- [ ] **Step 3: Replace silent spinner failure with error panel**

Before the success branch, render:

```tsx
{!loading && error && (
  <div className="border border-[var(--color-crimson)] border-l-4 rounded px-5 py-4 bg-[var(--color-ivory)]">
    <p className="font-display text-lg text-[var(--color-charcoal)]">Données indisponibles</p>
    <p className="font-sans text-sm text-[var(--color-slate)] mt-1">{error}</p>
    <div className="flex flex-wrap gap-2 mt-4">
      <button className="btn btn-primary btn-sm" onClick={loadOverview}>Réessayer</button>
      <Link to="/tenders" className="btn btn-ghost btn-sm">Consulter la base locale</Link>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

With API unavailable, overview shows the error panel rather than an indefinite spinner.

---

### Task 4: Tender Detail Decision Area And Actions

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`
- Modify: `frontend/src/lib/api.ts` only if favorite/alert helpers already exist and need typed exports

**Interfaces:**
- Consumes: decoded `tenderId`, `getTenderUrgency`, `toTenderPath`
- Produces: first-screen action area for candidacy, save, alert, DCE, PDF, portal fallback

- [ ] **Step 1: Add decision summary facts**

After `const d = tender.details;`, add:

```ts
const urgency = getTenderUrgency(tender.deadline);
const tenderId = decodeTenderRouteId(id);
```

In the header section, add a compact facts grid:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
  <InfoCard icon={Building2} title="Acheteur public" value={d?.acheteur || tender.entity || "Non renseigné"} />
  <InfoCard icon={MapPin} title="Lieu d'exécution" value={d?.lieu_execution || tender.location || "Non renseigné"} />
  <InfoCard icon={Calendar} title="Échéance" value={`${tender.deadline}${urgency ? ` · ${urgency.label}` : ""}`} highlight={urgency?.tone === "critical"} />
  <InfoCard icon={Banknote} title="Estimation" value={d?.estimation || tender.estimation || "Non renseignée"} highlight={Boolean(d?.estimation || tender.estimation)} />
</div>
```

- [ ] **Step 2: Add alert handoff action**

Add a link in the action row:

```tsx
<Link
  to={`/alerts?tender=${encodeURIComponent(tender.id)}&category=${encodeURIComponent(tender.category || "")}&sector=${encodeURIComponent(tender.sector_code || "")}&location=${encodeURIComponent(tender.location || "")}&entity=${encodeURIComponent(tender.entity || "")}`}
  className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)]"
>
  <Bell size={16} /> Créer une alerte similaire
</Link>
```

Import `Bell`.

- [ ] **Step 3: Preserve portal fallback on DCE/PDF failures**

For DCE catch, set:

```ts
setDceError("Le DCE n'a pas pu être téléchargé depuis l'application. Essayez à nouveau ou ouvrez la consultation sur le portail officiel.");
```

For PDF catch, add a `pdfError` state and render an equivalent error panel.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

Open a tender detail; expected first decision area includes candidacy, alert, documents, and portal actions.

---

### Task 5: Auth Return Intent For Favorite And Alert

**Files:**
- Create: `frontend/src/lib/returnIntent.ts`
- Modify: `frontend/src/components/TenderTable.tsx`
- Modify: `frontend/src/pages/TenderDetail.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx`

**Interfaces:**
- Produces: `loginWithReturnPath(path: string, action?: string): string`
- Produces: `getReturnPath(search: string): string`
- Consumes: React Router `useLocation`, `useNavigate`

- [ ] **Step 1: Add return helper**

Create `frontend/src/lib/returnIntent.ts`:

```ts
export function loginWithReturnPath(path: string, action?: string): string {
  const params = new URLSearchParams({ returnTo: path });
  if (action) params.set("intent", action);
  return `/login?${params.toString()}`;
}

export function registerWithReturnPath(path: string, action?: string): string {
  const params = new URLSearchParams({ returnTo: path });
  if (action) params.set("intent", action);
  return `/register?${params.toString()}`;
}

export function getReturnPath(search: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");
  return returnTo && returnTo.startsWith("/") ? returnTo : "/";
}
```

- [ ] **Step 2: Use return intent for favorite**

In `TenderTable.tsx`, import `useLocation` and `loginWithReturnPath`. When no user:

```ts
const location = useLocation();
navigate(loginWithReturnPath(`${location.pathname}${location.search}`, "favorite"));
```

- [ ] **Step 3: Use return intent for detail actions**

In `TenderDetail.tsx`, for save/alert actions that require auth, navigate to:

```ts
loginWithReturnPath(`/tenders/${encodeURIComponent(tender.id)}`, "alert")
```

- [ ] **Step 4: Redirect after login/register**

In `Login.tsx` and `Register.tsx`, import:

```ts
import { useSearchParams } from "react-router-dom";
import { getReturnPath } from "../lib/returnIntent";
```

After successful auth:

```ts
navigate(getReturnPath(searchParams.toString()));
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

Manual flow: click favorite while logged out, login, and return to the originating list/detail route.

---

### Task 6: Alert Prefill From Search Or Tender Context

**Files:**
- Modify: `frontend/src/pages/Alerts.tsx`
- Modify: `frontend/src/pages/Tenders.tsx`

**Interfaces:**
- Consumes: URL params `q`, `category`, `sector`, `location`, `entity`, `tender`
- Produces: prefilled alert form values and explicit create-alert entry from search

- [ ] **Step 1: Add alert-from-search link**

In `Tenders.tsx`, add a link near export when there are filters:

```tsx
<Link
  to={`/alerts?${searchParams.toString()}`}
  className="btn btn-outline btn-sm font-sans font-semibold"
>
  Créer une alerte
</Link>
```

Import `Link`.

- [ ] **Step 2: Prefill alert form from URL**

In `Alerts.tsx`, import `useSearchParams`. Add:

```ts
const [searchParams] = useSearchParams();
```

In an effect after state declarations:

```ts
useEffect(() => {
  const keyword = searchParams.get("q") || "";
  const sector = searchParams.get("sector") || "";
  const location = searchParams.get("location") || "";
  const entity = searchParams.get("entity") || "";
  const tender = searchParams.get("tender") || "";

  if (keyword || sector || location || entity || tender) {
    setFormName(tender ? "Alerte similaire à cette consultation" : "Alerte depuis ma recherche");
    setFormKeywords(keyword);
    setFormSectors(sector);
    setFormRegions(location);
    setShowForm(true);
  }
}, [searchParams]);
```

- [ ] **Step 3: Improve sector-code copy**

Change the sector label from code-heavy wording to:

```tsx
<span className="label-academic">Secteurs surveillés</span>
```

Change placeholder to:

```tsx
placeholder="Secteur sélectionné depuis une recherche ou une consultation"
```

- [ ] **Step 4: Make existing alert toggle actionable if API supports it**

If no update endpoint exists in `api.ts`, leave toggle disabled and add visible copy "Modification bientôt disponible" only when a user tries to click it. Do not pretend it toggles.

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

Open `/alerts?sector=1.12&location=Rabat&q=route`; expected form opens prefilled without requiring sector-code recall.

---

### Task 7: Pricing Badge Visual Bug

**Files:**
- Modify: `frontend/src/pages/Pricing.tsx`

**Interfaces:**
- No cross-task dependencies.

- [ ] **Step 1: Fix highlighted badge layout**

Replace the heading/badge row classes with wrapping and a normal badge, not `seal-badge`:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <h2 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
    {tier.name}
  </h2>
  {tier.highlighted && (
    <span className="inline-flex items-center rounded border border-[var(--color-gold-light)] bg-[var(--color-ivory)] px-2 py-1 text-[10px] font-sans font-semibold uppercase text-[var(--color-gold)]">
      Recommandé
    </span>
  )}
</div>
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build`

Expected: build exits 0.

Capture mobile and desktop pricing screenshots; expected the badge no longer overlaps "Pro".

---

### Task 8: Final Verification And Cleanup

**Files:**
- Review all modified files.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified rebuild.

- [ ] **Step 1: Run build**

Run: `cd frontend && npm run build`

Expected: TypeScript build and Vite build exit 0.

- [ ] **Step 2: Start local app**

Run: `npm run dev`

Expected: frontend available on a local Vite port and backend either running or failure states visible.

- [ ] **Step 3: Capture screenshots**

Run:

```bash
playwright screenshot --viewport-size=1440,1000 http://localhost:5173/ /private/tmp/mp-overview-rebuild.png
playwright screenshot --viewport-size=1440,1000 http://localhost:5173/tenders /private/tmp/mp-tenders-rebuild.png
playwright screenshot --viewport-size=390,844 http://localhost:5173/tenders /private/tmp/mp-tenders-mobile-rebuild.png
playwright screenshot --viewport-size=390,844 http://localhost:5173/pricing /private/tmp/mp-pricing-mobile-rebuild.png
```

If Vite uses another port, replace `5173` with the reported port.

- [ ] **Step 4: Manual acceptance checklist**

Confirm:

- Slash-containing tender IDs open detail through encoded URLs.
- Overview API failure shows retry/consult-local actions.
- Mobile consultations do not show the full advanced filter wall by default.
- Active/expired tender state is visible.
- Detail first screen contains decision summary and actions.
- Alert page opens prefilled from search or tender query params.
- Login/register return to `returnTo`.
- Pricing badge does not overlap.

- [ ] **Step 5: Report changed files and verification**

Summarize exactly which files changed, what was verified, and any residual risk.
