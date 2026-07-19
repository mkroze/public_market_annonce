# Stats Consolidation & KPI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold Villes/Régions/Secteurs into a tabbed Statistiques page (`/stats?tab=…`), upgrade the stats overview with market-activity KPIs from an extended `/api/stats`, and trim the navbar to three main links.

**Architecture:** Backend adds a `kpis` object and `by_procedure` list to the existing `/api/stats` payload (additive, non-breaking). Frontend converts `Stats.tsx` into a query-param tab shell; the old overview content moves to `src/pages/stats/OverviewTab.tsx` with a new KPI strip; `Cities`/`Regions`/`Sectors` gain an `embedded` prop and are reused as tab content. All existing routes stay.

**Tech Stack:** FastAPI + aiosqlite (backend), React 19 + TypeScript + react-router-dom 7 (`useSearchParams`), Tailwind 4 academic-theme CSS variables, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-19-stats-consolidation-design.md`

## Global Constraints

- All user-facing copy is French. The "new" KPI must be labeled **"Ajoutées (7 j)"** — it measures ingestion (`scraped_at`), not official publication.
- Style with the theme CSS variables (`--color-crimson`, `--color-charcoal`, `--color-slate`, `--color-ivory`, `--color-ivory-dim`, `--color-ivory-deep`, `--color-border-subtle`, `--color-gold`); no stock daisyUI tab classes.
- `/api/stats` existing fields (`total`, `by_category`, `top_sectors`, `top_entities`) must not change shape; new fields are additive. Frontend treats them as optional.
- Existing routes (`/cities`, `/cities/:name`, `/regions`, `/regions/:name`, `/sectors`, `/sectors/:code`) keep working standalone.
- `deadline` column format is text `DD/MM/YYYY HH:MM`; `scraped_at` is `YYYY-MM-DD HH:MM:SS` (SQLite `datetime('now')` format).
- Frontend has no unit-test framework: verification cycle is `npx tsc -b --noEmit`, `npx oxlint src`, and `npm run build` (final task). Backend verification is via `curl` against the running dev server.
- Frontend commands run from `/Users/mkroze/Developer/my_hub/public_market_annonce/frontend`; backend from `/Users/mkroze/Developer/my_hub/public_market_annonce/backend`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Extend `/api/stats` with KPIs and procedure distribution

**Files:**
- Modify: `backend/main.py:372-401` (the `stats()` handler)

**Interfaces:**
- Consumes: existing `get_db()` helper and `tenders` table.
- Produces: `/api/stats` response gains `"kpis": {"active": int, "closing_7d": int, "new_7d": int, "distinct_buyers": int}` and `"by_procedure": [{"procedure_type": str, "count": int}]`. Task 2 mirrors these names in `StatsResponse`.

- [x] **Step 1: Add the KPI queries to the handler**

In `backend/main.py`, replace the body of `async def stats()` (currently lines 373–401) with:

```python
@app.get("/api/stats")
async def stats():
    db = await get_db()

    total = (await (await db.execute("SELECT COUNT(*) FROM tenders")).fetchone())[0]

    cat_cursor = await db.execute(
        "SELECT category, COUNT(*) as count FROM tenders GROUP BY category ORDER BY count DESC"
    )
    by_category = [dict(r) for r in await cat_cursor.fetchall()]

    sector_cursor = await db.execute(
        """SELECT sector_code, sector_name, category, COUNT(*) as count
           FROM tenders GROUP BY sector_code ORDER BY count DESC LIMIT 20"""
    )
    top_sectors = [dict(r) for r in await sector_cursor.fetchall()]

    entity_cursor = await db.execute(
        "SELECT entity, COUNT(*) as count FROM tenders GROUP BY entity ORDER BY count DESC LIMIT 20"
    )
    top_entities = [dict(r) for r in await entity_cursor.fetchall()]

    active = (
        await (await db.execute("SELECT COUNT(*) FROM tenders WHERE status = 'en_cours'")).fetchone()
    )[0]

    # deadline is stored as 'DD/MM/YYYY HH:MM' — rebuild an ISO date for comparison
    closing_7d = (
        await (
            await db.execute(
                """SELECT COUNT(*) FROM tenders
                   WHERE status = 'en_cours'
                     AND length(deadline) >= 10
                     AND substr(deadline,7,4) || '-' || substr(deadline,4,2) || '-' || substr(deadline,1,2)
                         BETWEEN date('now') AND date('now', '+7 day')"""
            )
        ).fetchone()
    )[0]

    new_7d = (
        await (
            await db.execute(
                "SELECT COUNT(*) FROM tenders WHERE scraped_at >= datetime('now', '-7 day')"
            )
        ).fetchone()
    )[0]

    distinct_buyers = (
        await (await db.execute("SELECT COUNT(DISTINCT entity) FROM tenders")).fetchone()
    )[0]

    proc_cursor = await db.execute(
        "SELECT procedure_type, COUNT(*) as count FROM tenders GROUP BY procedure_type ORDER BY count DESC"
    )
    by_procedure = [dict(r) for r in await proc_cursor.fetchall()]

    await db.close()

    return {
        "total": total,
        "by_category": by_category,
        "top_sectors": top_sectors,
        "top_entities": top_entities,
        "kpis": {
            "active": active,
            "closing_7d": closing_7d,
            "new_7d": new_7d,
            "distinct_buyers": distinct_buyers,
        },
        "by_procedure": by_procedure,
    }
```

- [x] **Step 2: Verify against the running backend and cross-check with SQL**

Start the backend if not running: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && .venv/bin/uvicorn main:app --port 8000` (background).

Run:
```bash
curl -s http://localhost:8000/api/stats | python3 -m json.tool | head -30
```
Expected: JSON contains `kpis` with the four integer fields and `by_procedure` as a list; `total`, `by_category`, `top_sectors`, `top_entities` still present.

Cross-check each KPI against the database:
```bash
sqlite3 /Users/mkroze/Developer/my_hub/public_market_annonce/backend/data/tenders.db "
SELECT COUNT(*) FROM tenders WHERE status='en_cours';
SELECT COUNT(*) FROM tenders WHERE status='en_cours' AND length(deadline)>=10
  AND substr(deadline,7,4)||'-'||substr(deadline,4,2)||'-'||substr(deadline,1,2)
      BETWEEN date('now') AND date('now','+7 day');
SELECT COUNT(*) FROM tenders WHERE scraped_at >= datetime('now','-7 day');
SELECT COUNT(DISTINCT entity) FROM tenders;"
```
Expected: the four numbers match `kpis.active`, `kpis.closing_7d`, `kpis.new_7d`, `kpis.distinct_buyers` exactly.

- [x] **Step 3: Verify the Overview page consumer is unaffected**

Run: `curl -s http://localhost:8000/api/overview -o /dev/null -w "%{http_code}\n"`
Expected: `200`.

- [x] **Step 4: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce
git add backend/main.py
git commit -m "feat: add market-activity KPIs to /api/stats

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Extend `StatsResponse` type

**Files:**
- Modify: `frontend/src/lib/types.ts:40-45`

**Interfaces:**
- Consumes: Task 1's response shape.
- Produces: `StatsResponse` with optional `kpis?: StatsKpis` and `by_procedure?: { procedure_type: string; count: number }[]`; exported interface `StatsKpis`. Task 3 imports `StatsResponse` (and relies on these member names).

- [x] **Step 1: Update the interface**

In `frontend/src/lib/types.ts`, replace:

```ts
export interface StatsResponse {
  total: number;
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; category: string; count: number }[];
  top_entities: { entity: string; count: number }[];
}
```

with:

```ts
export interface StatsKpis {
  active: number;
  closing_7d: number;
  new_7d: number;
  distinct_buyers: number;
}

export interface StatsResponse {
  total: number;
  by_category: { category: string; count: number }[];
  top_sectors: { sector_code: string; sector_name: string; category: string; count: number }[];
  top_entities: { entity: string; count: number }[];
  kpis?: StatsKpis;
  by_procedure?: { procedure_type: string; count: number }[];
}
```

- [x] **Step 2: Typecheck**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit`
Expected: exit 0.

- [x] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: extend StatsResponse with kpis and by_procedure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Add `embedded` prop to Cities, Regions, Sectors

**Files:**
- Modify: `frontend/src/pages/Cities.tsx:18-25`
- Modify: `frontend/src/pages/Regions.tsx:18-25`
- Modify: `frontend/src/pages/Sectors.tsx:40-47`

**Interfaces:**
- Consumes: nothing new.
- Produces: each default export accepts `{ embedded?: boolean }`; when `embedded` is true the component hides its `<h1>` header block and drops its own page padding (`px-4 sm:px-6 py-8` → `pt-2`). Task 4 renders `<Cities embedded />`, `<Regions embedded />`, `<Sectors embedded />`. Standalone routes render unchanged (prop absent).

- [x] **Step 1: Update Cities.tsx**

In `frontend/src/pages/Cities.tsx`, change the signature and header block:

```tsx
export default function Cities({ embedded = false }: { embedded?: boolean }) {
```

and replace the outer JSX wrapper + header:

```tsx
    <div className={embedded ? "pt-2 space-y-6" : "px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Villes</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Marches publics par ville
          </p>
        </div>
      )}
```

(The rest of the component body is unchanged; the closing tags stay as they are.)

- [x] **Step 2: Update Regions.tsx the same way**

```tsx
export default function Regions({ embedded = false }: { embedded?: boolean }) {
```

```tsx
    <div className={embedded ? "pt-2 space-y-6" : "px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Regions</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Marches publics par region
          </p>
        </div>
      )}
```

- [x] **Step 3: Update Sectors.tsx the same way**

```tsx
export default function Sectors({ embedded = false }: { embedded?: boolean }) {
```

```tsx
    <div className={embedded ? "pt-2 space-y-6" : "px-4 sm:px-6 py-8 space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Secteurs</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Consultations par secteur d'activite
          </p>
        </div>
      )}
```

- [x] **Step 4: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/Cities.tsx src/pages/Regions.tsx src/pages/Sectors.tsx`
Expected: exit 0, no new warnings.

- [x] **Step 5: Commit**

```bash
git add src/pages/Cities.tsx src/pages/Regions.tsx src/pages/Sectors.tsx
git commit -m "feat: add embedded mode to Cities, Regions and Sectors pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: OverviewTab component and tabbed Stats shell

**Files:**
- Create: `frontend/src/pages/stats/OverviewTab.tsx`
- Modify: `frontend/src/pages/Stats.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getStats` from `../../lib/api`; `StatsResponse` (with optional `kpis`, `by_procedure`) from Task 2; `Cities`/`Regions`/`Sectors` with `embedded` prop from Task 3.
- Produces: `OverviewTab` default export (no props); `Stats` default export reading `?tab=` — values `villes`, `regions`, `secteurs`, anything else → overview.

- [x] **Step 1: Create `frontend/src/pages/stats/OverviewTab.tsx`**

This is the current `Stats.tsx` content moved and upgraded (KPI strip + procedure distribution). Exact content:

```tsx
import { useEffect, useState } from "react";
import { getStats } from "../../lib/api";
import type { StatsResponse } from "../../lib/types";

const CATEGORY_BAR: Record<string, string> = {
  Travaux: "bg-[var(--color-crimson)]",
  Fournitures: "bg-[var(--color-gold)]",
  Services: "bg-[var(--color-charcoal)]",
};

function KpiStrip({ kpis }: { kpis: NonNullable<StatsResponse["kpis"]> }) {
  const items = [
    { label: "Actives", value: kpis.active, accent: "text-[var(--color-crimson)]" },
    { label: "Clôture < 7 j", value: kpis.closing_7d, accent: "text-[var(--color-gold)]" },
    { label: "Ajoutées (7 j)", value: kpis.new_7d, accent: "text-[var(--color-charcoal)]" },
    { label: "Acheteurs", value: kpis.distinct_buyers, accent: "text-[var(--color-charcoal)]" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="bg-base-100 px-6 py-5">
          <p className="label-academic">{item.label}</p>
          <p className={`text-3xl font-bold font-display mt-1 tabular-nums ${item.accent}`}>
            {item.value.toLocaleString("fr-FR")}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatsStrip({ total, byCategory }: { total: number; byCategory: StatsResponse["by_category"] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
      <div className="bg-base-100 px-6 py-5">
        <p className="label-academic">Total importé</p>
        <p className="text-3xl font-bold font-display text-[var(--color-crimson)] mt-1 tabular-nums">
          {total.toLocaleString("fr-FR")}
        </p>
      </div>
      {byCategory.map((c) => (
        <div key={c.category} className="bg-base-100 px-6 py-5 border-l border-[var(--color-border-subtle)]">
          <p className="label-academic">{c.category || "Non classé"}</p>
          <p className="text-2xl font-bold font-sans text-[var(--color-charcoal)] mt-1 tabular-nums">
            {c.count.toLocaleString("fr-FR")}
          </p>
          <p className="text-xs text-[var(--color-slate)] mt-0.5 font-sans tabular-nums">
            {((c.count / total) * 100).toFixed(1)}%
          </p>
        </div>
      ))}
    </div>
  );
}

function TopList({
  title,
  items,
  maxCount,
  colorClass,
  getLabel,
}: {
  title: string;
  items: Array<{ count: number; [key: string]: any }>;
  maxCount: number;
  colorClass: string | ((item: any) => string);
  getLabel: (item: any) => string;
}) {
  return (
    <div className="border border-[var(--color-border-subtle)] rounded">
      <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
        <h2 className="font-display text-base font-bold text-[var(--color-charcoal)]">{title}</h2>
      </div>
      <div className="px-5 py-3 space-y-3">
        {items.map((item, index) => {
          const count = item.count;
          const label = getLabel(item);
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-sans text-[var(--color-charcoal)] truncate">{label}</div>
                <div
                  className="w-full bg-[var(--color-ivory-deep)] rounded h-1.5 mt-1"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${title} : ${label}`}
                >
                  <div
                    className={`h-1.5 rounded ${typeof colorClass === "function" ? colorClass(item) : colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-sans font-semibold tabular-nums w-10 text-right text-[var(--color-charcoal)]">
                {count.toLocaleString("fr-FR")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getStats()
      .then(setData)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 rounded px-4 py-3 text-sm font-sans text-red-700">
        Une erreur est survenue lors du chargement des statistiques. Veuillez réessayer.
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            getStats()
              .then(setData)
              .catch(setError)
              .finally(() => setLoading(false));
          }}
          className="ml-3 underline font-semibold"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="border border-[var(--color-border-subtle)] rounded px-4 py-3 text-sm font-sans text-[var(--color-slate)]">
        Pas de données. Importez d'abord les consultations depuis la page d'accueil.
      </div>
    );
  }

  const maxSectorCount = Math.max(...data.top_sectors.map((s) => s.count), 1);
  const maxEntityCount = Math.max(...data.top_entities.map((e) => e.count), 1);
  const byProcedure = data.by_procedure ?? [];
  const maxProcedureCount = Math.max(...byProcedure.map((p) => p.count), 1);

  return (
    <div className="space-y-8">
      {data.kpis && <KpiStrip kpis={data.kpis} />}

      <StatsStrip total={data.total} byCategory={data.by_category} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopList
          title="Top secteurs"
          items={data.top_sectors}
          maxCount={maxSectorCount}
          colorClass={(item) => CATEGORY_BAR[item.category] || "bg-[var(--color-slate)]"}
          getLabel={(item) => item.sector_name || item.sector_code}
        />
        <TopList
          title="Top entités"
          items={data.top_entities}
          maxCount={maxEntityCount}
          colorClass="bg-[var(--color-crimson)]"
          getLabel={(item) => item.entity}
        />
        {byProcedure.length > 0 && (
          <TopList
            title="Répartition par procédure"
            items={byProcedure}
            maxCount={maxProcedureCount}
            colorClass="bg-[var(--color-charcoal)]"
            getLabel={(item) => item.procedure_type || "Non précisé"}
          />
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Rewrite `frontend/src/pages/Stats.tsx` as the tab shell**

Replace the whole file with:

```tsx
import { useSearchParams } from "react-router-dom";
import OverviewTab from "./stats/OverviewTab";
import Cities from "./Cities";
import Regions from "./Regions";
import Sectors from "./Sectors";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "villes", label: "Villes" },
  { key: "regions", label: "Régions" },
  { key: "secteurs", label: "Secteurs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Stats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey =
    raw === "villes" || raw === "regions" || raw === "secteurs" ? raw : "overview";

  function selectTab(key: TabKey) {
    if (key === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Statistiques</h1>

      <div className="border-b border-[var(--color-border-subtle)] flex gap-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => selectTab(tab.key)}
            className={`px-4 py-2 font-sans text-sm transition-colors border-b-2 -mb-px ${
              active === tab.key
                ? "border-[var(--color-crimson)] text-[var(--color-charcoal)] font-semibold"
                : "border-transparent text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" && <OverviewTab />}
      {active === "villes" && <Cities embedded />}
      {active === "regions" && <Regions embedded />}
      {active === "secteurs" && <Sectors embedded />}
    </div>
  );
}
```

- [x] **Step 3: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src/pages/Stats.tsx src/pages/stats/OverviewTab.tsx`
Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add src/pages/Stats.tsx src/pages/stats/OverviewTab.tsx
git commit -m "feat: tabbed stats page with market-activity KPI overview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Trim navbar main links

**Files:**
- Modify: `frontend/src/components/Navbar.tsx:26-33` (`mainLinks`) and the lucide import (lines 2–6)

**Interfaces:**
- Consumes: nothing new.
- Produces: `mainLinks` = Apercu, Consultations, Statistiques. `moreLinks` unchanged.

- [x] **Step 1: Replace `mainLinks`**

In `frontend/src/components/Navbar.tsx`, replace:

```tsx
  const mainLinks = [
    { to: "/", label: "Apercu", icon: LayoutDashboard },
    { to: "/tenders", label: "Consultations", icon: Search },
    { to: "/cities", label: "Villes", icon: MapPin },
    { to: "/regions", label: "Regions", icon: Map },
    { to: "/sectors", label: "Secteurs", icon: Layers },
    { to: "/stats", label: "Statistiques", icon: BarChart3 },
  ];
```

with:

```tsx
  const mainLinks = [
    { to: "/", label: "Apercu", icon: LayoutDashboard },
    { to: "/tenders", label: "Consultations", icon: Search },
    { to: "/stats", label: "Statistiques", icon: BarChart3 },
  ];
```

- [x] **Step 2: Remove now-unused lucide imports**

`MapPin`, `Map`, `Layers` are no longer referenced in Navbar. Update the import to:

```tsx
import {
  LayoutDashboard, Search, BarChart3,
  CreditCard, BookOpen, Calculator, Scale, Bell, Heart, LogIn, LogOut, User, Menu,
  Sun, Moon, Sparkles, Handshake,
} from "lucide-react";
```

(If oxlint reports any of the remaining names as unused, remove exactly those too.)

- [x] **Step 3: Typecheck, lint, build**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src && npm run build`
Expected: all exit 0; build completes.

- [x] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: trim navbar to Apercu, Consultations, Statistiques

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end visual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: running backend (port 8000) + frontend dev server; all previous tasks committed.
- Produces: verification evidence; no code.

- [x] **Step 1: Start both servers**

Backend: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && .venv/bin/uvicorn main:app --port 8000` (background, if not already running).
Frontend: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npm run dev` (background). **Read the dev-server output to get the actual port — another Vite app may hold 5173 (a "rendezvous" app was seen there previously; this app then takes 5174).**

- [x] **Step 2: Verify the four tabs render**

For each of `/stats`, `/stats?tab=villes`, `/stats?tab=regions`, `/stats?tab=secteurs`, dump the rendered DOM with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=1280,2400 --virtual-time-budget=8000 --dump-dom "http://localhost:<PORT>/stats?tab=villes"
```

Check:
- `/stats`: "Vue d'ensemble" tab has `aria-selected="true"`; KPI labels "Actives", "Clôture < 7 j", "Ajoutées (7 j)", "Acheteurs" present; "Répartition par procédure" list present; "Total importé" strip present.
- `?tab=villes`: Villes tab selected; city cards render; no duplicate `<h1>` (only "Statistiques").
- `?tab=regions` and `?tab=secteurs`: same pattern.
- KPI numbers in the DOM match the `curl http://localhost:8000/api/stats` values.

- [x] **Step 3: Verify navbar and standalone routes**

- Navbar in the dumped DOM contains links to `/`, `/tenders`, `/stats` and NOT to `/cities`, `/regions`, `/sectors` in the main link row (the "more" dropdown items Assistant/Procedures/Blog/Tarifs/Calculateur/Partenaires are unchanged).
- `/cities/<some-city>` standalone still renders with its own header (pick a city name from the `?tab=villes` dump).
- `/` (Overview) still renders without errors.

- [x] **Step 4: Stop dev servers and mark plan executed**

Kill background servers. Tick the plan checkboxes and commit the plan file:

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce
git add docs/superpowers/plans/2026-07-19-stats-consolidation.md
git commit -m "docs: mark stats consolidation plan as executed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- Spec coverage: backend KPIs (Task 1), types (Task 2), embedded prop (Task 3), tab shell + OverviewTab with KPI strip and procedure list (Task 4), navbar trim (Task 5), verification incl. deep links, navbar and Overview regression (Task 6). Out-of-scope untouched. ✓
- Optional-field guards: `data.kpis &&` and `byProcedure.length > 0` implement the spec's older-backend tolerance. ✓
- Name consistency: `kpis.active/closing_7d/new_7d/distinct_buyers`, `by_procedure.procedure_type`, `embedded`, tab keys `villes|regions|secteurs`. ✓
- No placeholders; all code complete. ✓
