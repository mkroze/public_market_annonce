# Public Catalog Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-out users browse the live tender catalog and open a lightweight tender detail while keeping high-value actions behind authentication.

**Architecture:** The backend v1 guard becomes method-aware and allows only read-only catalog endpoints without a token. The frontend removes route-level auth from catalog/detail pages and gates member-only controls in-place using `useAuth()`. Existing logged-in flows continue to use the same API functions and route targets.

**Tech Stack:** FastAPI, Python unittest/TestClient, React 19, TypeScript, React Router, Vite, Tailwind CSS/daisyUI tokens, lucide-react.

## Global Constraints

- No anonymous DCE download.
- No anonymous PDF or list export.
- No anonymous alerts or favorites.
- No public admin, scrape, stats, cities, regions, sectors, or assistant endpoints.
- No redesign of the catalog or tender detail page beyond the login-aware states needed for this feature.
- Backend access control remains the source of truth.
- Tender IDs may contain slashes, so backend authorization must distinguish `/dce`, `/pdf`, and `/export` action routes before allowing catch-all detail reads.
- After authentication, users should land back on the tender or catalog path they came from.
- Do not revert or edit unrelated dirty worktree files.

---

## File Structure

- Modify `backend/main.py`: replace the all-non-auth API gate with method-aware public-read/private-action authorization helpers.
- Modify `backend/test_v1_api_surface.py`: document the new public catalog read contract and preserved private action gates.
- Modify `frontend/src/App.tsx`: remove `RequireAuth` around `/tenders` and `/tenders/:id`; keep `/alerts` protected.
- Modify `frontend/src/pages/Tenders.tsx`: show export only to signed-in users and show a compact auth CTA to visitors.
- Modify `frontend/src/pages/TenderDetail.tsx`: show existing full actions to signed-in users and login walls around visitor-locked actions/sections.
- Modify `frontend/src/components/Navbar.tsx`: show `Alertes` only to signed-in users; keep `Consultations` public.

---

### Task 1: Backend Public Read Authorization

**Files:**
- Modify: `backend/test_v1_api_surface.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: existing `get_current_user(authorization: str | None) -> dict | None`.
- Produces: `is_public_v1_api_path(path: str, method: str) -> bool`, `requires_v1_auth(path: str, method: str) -> bool`, and method-aware middleware behavior used by every `/api/*` request.

- [ ] **Step 1: Write failing API surface tests**

Remove `"/api/favorites"` from the `blocked_paths` list in `test_retired_public_routes_are_not_accessible`.

Replace `test_catalog_requires_authentication` in `backend/test_v1_api_surface.py` with these tests:

```python
    def test_catalog_read_routes_are_public(self):
        public_read_paths = [
            "/api/tenders",
            "/api/filters",
        ]

        for path in public_read_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotEqual(response.status_code, 401)
                self.assertNotEqual(response.status_code, 404)

    def test_catalog_actions_still_require_authentication(self):
        gated_paths = [
            "/api/tenders/export",
            "/api/tenders/A/B/pdf",
            "/api/tenders/A/B/dce",
            "/api/alerts",
            "/api/favorites",
        ]

        for path in gated_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)

    def test_slash_bearing_tender_detail_is_public_read_path(self):
        import main

        self.assertTrue(main.is_public_v1_api_path("/api/tenders/A/B", "GET"))
        self.assertFalse(main.requires_v1_auth("/api/tenders/A/B", "GET"))
        self.assertFalse(main.is_public_v1_api_path("/api/tenders/A/B/pdf", "GET"))
        self.assertTrue(main.requires_v1_auth("/api/tenders/A/B/pdf", "GET"))
```

Keep `test_retired_public_routes_are_not_accessible`, `test_auth_entry_points_are_public`, and `test_admin_surface_is_reachable_but_gated`.

- [ ] **Step 2: Run the focused failing tests**

Run:

```bash
cd backend && python -m unittest test_v1_api_surface.V1ApiSurfaceTest -v
```

Expected: `test_catalog_read_routes_are_public` fails because `/api/tenders` or `/api/filters` returns `401`; `test_slash_bearing_tender_detail_is_public_read_path` fails because the helper functions do not exist yet.

- [ ] **Step 3: Implement method-aware public read/private action guard**

In `backend/main.py`, replace the current `V1_PUBLIC_API_PATHS`, `V1_ALLOWED_API_PATHS`, `is_v1_catalog_api_path`, and `restrict_v1_api_surface` block with:

```python
# ── V1 catalog surface guard ─────────────────────────────────────────────────

# Auth entry points stay public so visitors can obtain a session.
V1_PUBLIC_API_PATHS = {"/api/auth/login", "/api/auth/register"}

# The launch API surface is intentionally narrow. Some paths are public reads;
# actions and account data are authenticated below.
V1_ALLOWED_API_PATHS = V1_PUBLIC_API_PATHS | {"/api/filters", "/api/auth/me"}


def is_tender_action_path(path: str) -> bool:
    return (
        path == "/api/tenders/export"
        or path.endswith("/pdf")
        or path.endswith("/dce")
    )


def is_public_v1_api_path(path: str, method: str) -> bool:
    if path in V1_PUBLIC_API_PATHS:
        return True
    if method != "GET":
        return False
    if path == "/api/filters":
        return True
    if path == "/api/tenders":
        return True
    if path.startswith("/api/tenders/") and not is_tender_action_path(path):
        return True
    return False


def requires_v1_auth(path: str, method: str) -> bool:
    if is_public_v1_api_path(path, method):
        return False
    return path.startswith("/api/")


def is_v1_catalog_api_path(path: str) -> bool:
    return (
        path in V1_ALLOWED_API_PATHS
        or path == "/api/tenders"
        or path.startswith("/api/tenders/")
        or path == "/api/alerts"
        or path.startswith("/api/alerts/")
        or path == "/api/favorites"
        or path.startswith("/api/favorites/")
        or path == "/api/admin"
        or path.startswith("/api/admin/")
    )


@app.middleware("http")
async def restrict_v1_api_surface(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and request.method != "OPTIONS":
        if not is_v1_catalog_api_path(path):
            return Response(status_code=404)
        if requires_v1_auth(path, request.method):
            user = await get_current_user(request.headers.get("authorization"))
            if not user:
                return Response(status_code=401)
    return await call_next(request)
```

This keeps `/api/tenders/export`, `/api/tenders/{id}/pdf`, and `/api/tenders/{id}/dce` authenticated even though slash-bearing detail routes are public reads.

- [ ] **Step 4: Run backend tests for authorization and slash-bearing routes**

Run:

```bash
cd backend && python -m unittest test_v1_api_surface.V1ApiSurfaceTest test_tender_routes.TenderRouteTest -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit backend authorization**

Run:

```bash
git add backend/main.py backend/test_v1_api_surface.py
git commit -m "feat(api): expose public catalog reads"
```

Expected: commit succeeds and includes only the two backend files.

---

### Task 2: Public Catalog Route And Export Gate

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Tenders.tsx`
- Modify: `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Consumes: `useAuth(): { user: User | null; loading: boolean; ... }`.
- Produces: public `/tenders` route, public catalog browsing UI, and authenticated-only export/navigation actions.

- [ ] **Step 1: Update frontend route expectations by code inspection**

Open `frontend/src/App.tsx` and confirm these current route wrappers exist before editing:

```tsx
<RequireAuth>
  <Tenders />
</RequireAuth>
```

```tsx
<RequireAuth>
  <TenderDetail />
</RequireAuth>
```

`/alerts` must remain wrapped in `RequireAuth`.

- [ ] **Step 2: Remove route guards from catalog and detail**

In `frontend/src/App.tsx`, replace the guarded tender routes with:

```tsx
          <Route path="/tenders" element={<Tenders />} />
          <Route path="/tenders/:id" element={<TenderDetail />} />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <Alerts />
              </RequireAuth>
            }
          />
```

Keep the `RequireAuth` function because `/alerts` still uses it.

- [ ] **Step 3: Gate catalog export with auth-aware UI**

In `frontend/src/pages/Tenders.tsx`, replace the current router import with:

```tsx
import { Link, useSearchParams } from "react-router-dom";
```

Add these imports:

```tsx
import { LockKeyhole } from "lucide-react";
import { useAuth } from "../lib/auth";
```

Inside `Tenders()`, after the toast state, add:

```tsx
  const { user } = useAuth();
```

Replace the current export rendering block:

```tsx
        {result && !loading && result.total > 0 && (
          <ExportDropdown total={result.total} onExport={handleExport} />
        )}
```

with:

```tsx
        {result && !loading && result.total > 0 && (
          user ? (
            <ExportDropdown total={result.total} onExport={handleExport} />
          ) : (
            <Link
              to="/login"
              state={{ from: "/tenders" }}
              className="btn btn-outline btn-sm gap-1.5 normal-case font-sans"
            >
              <LockKeyhole size={14} />
              Exporter après connexion
            </Link>
          )
        )}
```

This prevents logged-out users from calling `GET /api/tenders/export`.

- [ ] **Step 4: Hide alerts from logged-out primary navigation**

In `frontend/src/components/Navbar.tsx`, replace:

```tsx
  const navLinks = [
    { to: "/tenders", label: "Consultations", icon: Search },
    { to: "/alerts", label: "Alertes", icon: Bell },
  ];
```

with:

```tsx
  const navLinks = [
    { to: "/tenders", label: "Consultations", icon: Search, public: true },
    { to: "/alerts", label: "Alertes", icon: Bell, public: false },
  ].filter((link) => link.public || user);
```

This keeps `/alerts` route protection and avoids presenting alerts as a public area.

- [ ] **Step 5: Build the frontend**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 6: Commit public catalog UI route work**

Run:

```bash
git add frontend/src/App.tsx frontend/src/pages/Tenders.tsx frontend/src/components/Navbar.tsx
git commit -m "feat(ui): allow public catalog browsing"
```

Expected: commit succeeds and includes only the three frontend files.

---

### Task 3: Logged-Out Tender Detail Login Walls

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `frontend/src/lib/auth.tsx`, existing `downloadDce(tenderId: string)`, `downloadPdf(tenderId: string)`, existing display helpers, and React Router `Link`.
- Produces: visitor-safe tender detail where member-only actions are rendered as login CTAs and never call protected endpoints while logged out.

- [ ] **Step 1: Add auth imports and locked panel helper**

In `frontend/src/pages/TenderDetail.tsx`, add `LockKeyhole` to the lucide import list:

```tsx
  LockKeyhole,
```

Add the auth import:

```tsx
import { useAuth } from "../lib/auth";
```

After `sourceLabel`, add this helper component:

```tsx
function LockedPanel({ title, children, from }: { title: string; children: React.ReactNode; from: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-3">
      <div className="flex items-start gap-2">
        <LockKeyhole size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold text-[var(--color-ink)]">{title}</p>
          <p className="mt-0.5 font-sans text-sm text-[var(--color-muted)]">{children}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/register" state={{ from }} className="btn btn-primary btn-sm normal-case font-sans">
              Créer un compte
            </Link>
            <Link to="/login" state={{ from }} className="btn btn-outline btn-sm normal-case font-sans">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Read auth state in the detail page**

Inside `TenderDetail()`, after the existing state declarations, add:

```tsx
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);
  const returnPath = id ? `/tenders/${id}` : "/tenders";
```

- [ ] **Step 3: Gate action buttons and links**

Replace the current actions `<div className="flex flex-wrap gap-3">...</div>` with:

```tsx
      <div className="space-y-3">
        {isLoggedIn ? (
          <div className="flex flex-wrap gap-3">
            {d?.dce_url && (
              <button
                className="btn btn-primary font-sans font-semibold gap-2"
                disabled={dceLoading}
                onClick={async () => {
                  if (!tenderId) return;
                  setDceLoading(true);
                  setDceError("");
                  try { await downloadDce(tenderId); }
                  catch (e) { setDceError(e instanceof Error ? e.message : "Échec du téléchargement"); }
                  finally { setDceLoading(false); }
                }}
              >
                {dceLoading ? <span className="loading loading-spinner loading-sm"></span> : <Download size={16} />}
                {dceLoading ? "Téléchargement..." : "Télécharger le DCE"}
              </button>
            )}
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)] hover:text-[var(--color-ivory)] transition-colors"
              disabled={pdfLoading}
              onClick={async () => {
                if (!tenderId) return;
                setPdfLoading(true);
                setPdfError("");
                try { await downloadPdf(tenderId); }
                catch (e) { setPdfError(e instanceof Error ? e.message : "Échec de l'export PDF"); }
                finally { setPdfLoading(false); }
              }}
            >
              {pdfLoading ? <span className="loading loading-spinner loading-sm"></span> : <FileText size={16} />}
              Export PDF
            </button>
            {d?.avis_url && (
              <a href={d.avis_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors text-[var(--color-charcoal)]">
                <FileText size={16} /> Avis de publication
              </a>
            )}
            {tender.detail_url && (
              <a href={tender.detail_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-[var(--color-slate)] hover:text-[var(--color-charcoal)] transition-colors">
                <ExternalLink size={16} /> Voir sur marchespublics.gov.ma
              </a>
            )}
          </div>
        ) : (
          <LockedPanel title="Actions réservées aux comptes" from={returnPath}>
            Connectez-vous pour télécharger le DCE, exporter la fiche PDF et ouvrir les liens officiels de participation.
          </LockedPanel>
        )}
      </div>
```

This keeps the existing signed-in actions unchanged and prevents logged-out users from calling DCE/PDF endpoints.

- [ ] **Step 4: Gate addresses**

Replace the current addresses section:

```tsx
      {(d?.adresse_retrait || d?.adresse_depot || d?.lieu_ouverture) && (
        <Section icon={MapPin} title="Adresses">
          {d?.adresse_retrait && <Field label="Retrait des dossiers" value={d.adresse_retrait} />}
          {d?.adresse_depot && <Field label="Dépôt des offres" value={d.adresse_depot} />}
          {d?.lieu_ouverture && <Field label="Ouverture des plis" value={d.lieu_ouverture} />}
        </Section>
      )}
```

with:

```tsx
      {(d?.adresse_retrait || d?.adresse_depot || d?.lieu_ouverture) && (
        isLoggedIn ? (
          <Section icon={MapPin} title="Adresses">
            {d?.adresse_retrait && <Field label="Retrait des dossiers" value={d.adresse_retrait} />}
            {d?.adresse_depot && <Field label="Dépôt des offres" value={d.adresse_depot} />}
            {d?.lieu_ouverture && <Field label="Ouverture des plis" value={d.lieu_ouverture} />}
          </Section>
        ) : (
          <LockedPanel title="Adresses de retrait et dépôt" from={returnPath}>
            Les adresses opérationnelles sont disponibles après connexion afin de garder la participation dans l'espace membre.
          </LockedPanel>
        )
      )}
```

- [ ] **Step 5: Gate contact**

Replace the current contact section:

```tsx
      {d?.contact && (
        <Section icon={Phone} title="Contact">
          <ContactBlock text={d.contact} />
        </Section>
      )}
```

with:

```tsx
      {d?.contact && (
        isLoggedIn ? (
          <Section icon={Phone} title="Contact">
            <ContactBlock text={d.contact} />
          </Section>
        ) : (
          <LockedPanel title="Contact acheteur" from={returnPath}>
            Connectez-vous pour consulter les coordonnées et préparer vos échanges depuis la fiche complète.
          </LockedPanel>
        )
      )}
```

- [ ] **Step 6: Build frontend and run backend guard tests**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build complete successfully.

Run:

```bash
cd backend && python -m unittest test_v1_api_surface.V1ApiSurfaceTest test_tender_routes.TenderRouteTest test_tender_routes.TenderDetailApiTest -v
```

Expected: all tests pass.

- [ ] **Step 7: Manual route verification**

Run the app:

```bash
npm run dev
```

Open `http://localhost:5173/tenders` while logged out and verify:

- catalog loads live data instead of redirecting to `/login`
- export control says `Exporter après connexion`
- clicking a tender opens `/tenders/:id`
- detail page shows the action lock panel
- contact and address sections show lock panels when source data exists
- `/alerts` still redirects to `/login`

Stop the dev server with `Ctrl+C`.

- [ ] **Step 8: Commit logged-out detail walls**

Run:

```bash
git add frontend/src/pages/TenderDetail.tsx
git commit -m "feat(ui): gate tender detail actions for visitors"
```

Expected: commit succeeds and includes only `frontend/src/pages/TenderDetail.tsx`.

---

## Final Verification

- [ ] Run the complete focused backend suite:

```bash
cd backend && python -m unittest test_v1_api_surface test_tender_routes test_tender_display -v
```

Expected: all tests pass.

- [ ] Run the frontend production build:

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] Check git status:

```bash
git status --short
```

Expected: only pre-existing unrelated dirty files remain, or the worktree is clean if those files were handled separately.
