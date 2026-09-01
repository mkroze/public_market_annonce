# Member Space Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected `/member/*` user space with a reusable side-panel shell, account theme preference, and password change.

**Architecture:** Backend account controls live behind `/api/account/*` in the existing FastAPI app, backed by an idempotent `users.theme` migration. Frontend member pages use a shared `MemberLayout` under protected routes, reuse existing alerts/favorites APIs, and keep the global navbar focused on top-level navigation.

**Tech Stack:** FastAPI, Pydantic, aiosqlite, unittest async tests, React 19, TypeScript, React Router, Tailwind CSS 4/daisyUI tokens, lucide-react icons, Vite.

## Global Constraints

- Use the approved spec at `docs/superpowers/specs/2026-09-01-member-space-shell-design.md`.
- Preserve existing `/alerts` behavior while adding `/member/alerts`.
- Member navigation labels must be: `Accueil`, `Mes consultations`, `Mes alertes`, `Recherches enregistrées`, `Profil & préférences`.
- Theme values must be exactly `system`, `light`, or `dark`.
- All `/api/account/*` routes require authentication.
- Login and `require_user` must reject users whose `status` is not `active`.
- Do not add billing, 2FA, session management, account deletion, full saved-search implementation, admin settings, tender collaboration, bidding workflow, or project workspaces.
- Use existing frontend visual tokens from `frontend/src/index.css`.
- Use lucide icons with visible labels.
- Avoid nested cards; repeated items may use cards, page sections should be unframed or simple bordered panels.
- Write failing tests before production code for backend behavior.

---

## File Structure

- Modify `backend/database.py`: add `users.theme` migration.
- Modify `backend/main.py`: allow `/api/account` paths, active-user checks, account view, theme preference update, password change endpoint.
- Create `backend/test_account.py`: backend TDD coverage for account/security behavior.
- Modify `frontend/src/lib/types.ts`: add account and theme types.
- Modify `frontend/src/lib/api.ts`: add account API helpers and richer JSON mutation helper.
- Modify `frontend/src/lib/auth.tsx`: expose `updateUser` and apply initial theme from the loaded user.
- Create `frontend/src/lib/theme.ts`: local theme preference/effective-theme utility.
- Create `frontend/src/components/MemberLayout.tsx`: reusable member shell and navigation.
- Create `frontend/src/pages/member/MemberOverview.tsx`: operational overview template.
- Create `frontend/src/pages/member/MemberConsultations.tsx`: favorites-backed consultations template.
- Create `frontend/src/pages/member/MemberSavedSearches.tsx`: saved-search empty state template.
- Create `frontend/src/pages/member/MemberAccount.tsx`: theme and password settings.
- Modify `frontend/src/pages/Alerts.tsx`: make breadcrumbs/layout compatible with member shell.
- Modify `frontend/src/App.tsx`: add protected member routes.
- Modify `frontend/src/components/Navbar.tsx`: point account menu to `/member`.
- Modify `frontend/src/index.css`: add theme preference selectors for light/dark user choice.

Execution order:

1. Task 1: Backend Account API
2. Task 2: Frontend Account Types, API, And Theme Utility
3. Task 4: Member Overview, Consultations, And Saved Searches
4. Task 5: Member Account Page
5. Task 3: Member Shell And Routing
6. Task 6: Final Verification

---

### Task 1: Backend Account API

**Files:**
- Create: `backend/test_account.py`
- Modify: `backend/database.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `hash_password(password: str) -> str`, `verify_password(password: str, stored: str) -> bool`, `create_token(user_id: int, email: str) -> str`
- Produces:
  - `GET /api/account`
  - `PATCH /api/account/preferences` with body `{ "theme": "system" | "light" | "dark" }`
  - `POST /api/account/change-password` with body `{ "current_password": string, "new_password": string }`

- [ ] **Step 1: Write failing backend tests**

Create `backend/test_account.py`:

```python
import os
import tempfile
import unittest

from fastapi import HTTPException

import auth


class AccountApiTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        cursor = await db.execute(
            """INSERT INTO users (email, password_hash, name, company, phone, status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("member@test.com", auth.hash_password("old-password"), "Member", "ACME", "0600000000", "active"),
        )
        self.user_id = cursor.lastrowid
        await db.commit()
        await db.close()
        self.authorization = f"Bearer {auth.create_token(self.user_id, 'member@test.com')}"

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    async def test_get_account_requires_authentication(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.get_account(None)

        self.assertEqual(ctx.exception.status_code, 401)

    async def test_get_account_returns_safe_current_account(self):
        import main

        account = await main.get_account(self.authorization)

        self.assertEqual(account["email"], "member@test.com")
        self.assertEqual(account["name"], "Member")
        self.assertEqual(account["company"], "ACME")
        self.assertEqual(account["phone"], "0600000000")
        self.assertEqual(account["theme"], "system")
        self.assertNotIn("password_hash", account)

    async def test_update_theme_accepts_allowed_values(self):
        import main

        for theme in ("system", "light", "dark"):
            account = await main.update_account_preferences(
                main.AccountPreferencesRequest(theme=theme),
                self.authorization,
            )
            self.assertEqual(account["theme"], theme)

    async def test_update_theme_rejects_invalid_value(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_preferences(
                main.AccountPreferencesRequest(theme="blue"),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 422)

    async def test_change_password_rejects_wrong_current_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="wrong-password",
                    new_password="new-password",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_rejects_short_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="old-password",
                    new_password="short",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_rejects_same_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="old-password",
                    new_password="old-password",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_updates_hash(self):
        import database
        import main

        result = await main.change_account_password(
            main.ChangePasswordRequest(
                current_password="old-password",
                new_password="new-password",
            ),
            self.authorization,
        )

        self.assertEqual(result, {"status": "updated"})

        db = await database.get_db()
        cursor = await db.execute("SELECT password_hash FROM users WHERE id = ?", (self.user_id,))
        stored = (await cursor.fetchone())["password_hash"]
        await db.close()

        self.assertTrue(auth.verify_password("new-password", stored))
        self.assertFalse(auth.verify_password("old-password", stored))

    async def test_login_rejects_non_active_user(self):
        import database
        import main

        db = await database.get_db()
        await db.execute("UPDATE users SET status = 'suspended' WHERE id = ?", (self.user_id,))
        await db.commit()
        await db.close()

        with self.assertRaises(HTTPException) as ctx:
            await main.login(main.LoginRequest(email="member@test.com", password="old-password"))

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_require_user_rejects_non_active_user(self):
        import database
        import main

        db = await database.get_db()
        await db.execute("UPDATE users SET status = 'deleted' WHERE id = ?", (self.user_id,))
        await db.commit()
        await db.close()

        with self.assertRaises(HTTPException) as ctx:
            await main.require_user(self.authorization)

        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail for missing behavior**

Run:

```bash
cd backend && python -m unittest test_account.py
```

Expected: FAIL/ERROR because `get_account`, `AccountPreferencesRequest`, `update_account_preferences`, `ChangePasswordRequest`, `change_account_password`, and active-status rejection are not implemented.

- [ ] **Step 3: Add database migration**

In `backend/database.py`, after the existing user metadata migrations, add:

```python
    await _add_column_if_missing(db, "users", "theme", "theme TEXT DEFAULT 'system'")
```

- [ ] **Step 4: Implement account helpers and endpoints**

In `backend/main.py`, extend `is_v1_catalog_api_path`:

```python
        or path == "/api/account"
        or path.startswith("/api/account/")
```

Update `require_user`:

```python
async def require_user(authorization: str | None = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    return user
```

Update `login` after converting the row to a dict and before updating `last_login`:

```python
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
```

Add these models near the auth models:

```python
class AccountPreferencesRequest(BaseModel):
    theme: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
```

Add these helpers and endpoints after `/api/auth/me`:

```python
ALLOWED_ACCOUNT_THEMES = {"system", "light", "dark"}


def account_view(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "company": user.get("company", "") or "",
        "phone": user.get("phone", "") or "",
        "plan": user.get("plan", "free"),
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "theme": user.get("theme", "system") or "system",
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
    }


@app.get("/api/account")
async def get_account(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    return account_view(user)


@app.patch("/api/account/preferences")
async def update_account_preferences(
    req: AccountPreferencesRequest,
    authorization: str | None = Header(None),
):
    user = await require_user(authorization)
    if req.theme not in ALLOWED_ACCOUNT_THEMES:
        raise HTTPException(status_code=422, detail="Theme must be system, light, or dark")

    db = await get_db()
    try:
        await db.execute("UPDATE users SET theme = ? WHERE id = ?", (req.theme, user["id"]))
        await db.commit()
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
        updated = await cursor.fetchone()
        return account_view(dict(updated))
    finally:
        await db.close()


@app.post("/api/account/change-password")
async def change_account_password(
    req: ChangePasswordRequest,
    authorization: str | None = Header(None),
):
    user = await require_user(authorization)
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 8 caracteres.")
    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit etre different.")
    if not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

    db = await get_db()
    try:
        await db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(req.new_password), user["id"]),
        )
        await db.commit()
    finally:
        await db.close()
    return {"status": "updated"}
```

Extend `/api/auth/register`, `/api/auth/login`, and `/api/auth/me` user payloads with:

```python
            "theme": user.get("theme", "system") or "system",
```

For register, return `"theme": "system"` because the row is newly created.

- [ ] **Step 5: Run backend tests to verify green**

Run:

```bash
cd backend && python -m unittest test_account.py test_auth.py test_alerts_api.py test_settings.py
```

Expected: all tests pass.

- [ ] **Step 6: Commit backend account API**

```bash
git add backend/database.py backend/main.py backend/test_account.py
git commit -m "feat(account): add member preferences and password API"
```

---

### Task 2: Frontend Account Types, API, And Theme Utility

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/auth.tsx`
- Create: `frontend/src/lib/theme.ts`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: backend account API from Task 1.
- Produces:
  - `ThemePreference = "system" | "light" | "dark"`
  - `AccountProfile extends User`
  - `getAccount(): Promise<AccountProfile>`
  - `updateAccountPreferences(data: { theme: ThemePreference }): Promise<AccountProfile>`
  - `changePassword(data: { current_password: string; new_password: string }): Promise<{ status: string }>`
  - `applyThemePreference(theme: ThemePreference): void`
  - `AuthContext.updateUser(patch: Partial<User>): void`

- [ ] **Step 1: Add frontend types**

In `frontend/src/lib/types.ts`, replace the `User` interface with:

```ts
export type ThemePreference = "system" | "light" | "dark";

export interface User {
  id: number;
  email: string;
  name: string;
  plan: string;
  company?: string;
  phone?: string;
  role?: string;
  status?: string;
  theme?: ThemePreference;
  created_at?: string | null;
  last_login?: string | null;
}

export interface AccountProfile extends User {
  theme: ThemePreference;
  company: string;
  phone: string;
  role: string;
  status: string;
  created_at?: string | null;
  last_login?: string | null;
}
```

- [ ] **Step 2: Add theme utility**

Create `frontend/src/lib/theme.ts`:

```ts
import type { ThemePreference } from "./types";

const STORAGE_KEY = "mp-theme";
const THEMES: ThemePreference[] = ["system", "light", "dark"];

export function normalizeThemePreference(value: unknown): ThemePreference {
  return THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
}

export function getStoredThemePreference(): ThemePreference {
  return normalizeThemePreference(localStorage.getItem(STORAGE_KEY));
}

export function storeThemePreference(theme: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyThemePreference(theme: ThemePreference) {
  const normalized = normalizeThemePreference(theme);
  const root = document.documentElement;
  root.dataset.themePreference = normalized;
  root.classList.toggle("dark", normalized === "dark");
  storeThemePreference(normalized);
}
```

- [ ] **Step 3: Add API helpers**

In `frontend/src/lib/api.ts`, import the new types:

```ts
  AccountProfile,
  ThemePreference,
```

Add a mutation helper below `fetchJSON`:

```ts
async function mutateJSON<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw new Error(body.detail || `API error: ${res.status}`);
  return body;
}
```

Add account functions near auth helpers:

```ts
export function getAccount(): Promise<AccountProfile> {
  return fetchJSON<AccountProfile>(`${BASE}/account`);
}

export function updateAccountPreferences(data: { theme: ThemePreference }): Promise<AccountProfile> {
  return mutateJSON<AccountProfile>(`${BASE}/account/preferences`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<{ status: string }> {
  return mutateJSON<{ status: string }>(`${BASE}/account/change-password`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 4: Extend auth context**

In `frontend/src/lib/auth.tsx`, import:

```ts
import { applyThemePreference, getStoredThemePreference } from "./theme";
```

Extend `AuthContextType`:

```ts
  updateUser: (patch: Partial<User>) => void;
```

Set the default:

```ts
  updateUser: () => {},
```

Before the auth-loading effect, add:

```ts
  useEffect(() => {
    applyThemePreference(getStoredThemePreference());
  }, []);
```

Inside the existing `getMe().then(...)`, replace `then(setUser)` with:

```ts
        .then((loadedUser) => {
          setUser(loadedUser);
          applyThemePreference(loadedUser.theme || getStoredThemePreference());
        })
```

In `setAuth`, add:

```ts
    applyThemePreference(newUser.theme || getStoredThemePreference());
```

Add:

```ts
  function updateUser(patch: Partial<User>) {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.theme) applyThemePreference(patch.theme);
      return next;
    });
  }
```

Return it from the provider:

```tsx
    <AuthContext.Provider value={{ user, token, setAuth, updateUser, logout, loading }}>
```

- [ ] **Step 5: Add CSS theme selectors**

In `frontend/src/index.css`, after the `.institutional-page` token block, add:

```css
html[data-theme-preference="dark"] .institutional-page {
  --color-app-bg: #101827;
  --color-surface: #172033;
  --color-surface-muted: #202b42;
  --color-surface-raised: #26344f;
  --color-surface-strong: #2f3f5f;
  --color-surface-elevated: #202b42;
  --color-primary: #b6c4ff;
  --color-primary-strong: #dce1ff;
  --color-primary-soft: #26344f;
  --color-on-primary: #101827;
  --color-ink: #f7f9ff;
  --color-muted: #c8d0e2;
  --color-muted-light: #9ea8bd;
  --color-border: #3f4f6d;
  --color-border-subtle: #2f3f5f;
  --color-warning-soft: #4a3717;
  --color-success-soft: #183a2a;
  --color-danger-soft: #4b2222;
}

@media (prefers-color-scheme: dark) {
  html[data-theme-preference="system"] .institutional-page {
    --color-app-bg: #101827;
    --color-surface: #172033;
    --color-surface-muted: #202b42;
    --color-surface-raised: #26344f;
    --color-surface-strong: #2f3f5f;
    --color-surface-elevated: #202b42;
    --color-primary: #b6c4ff;
    --color-primary-strong: #dce1ff;
    --color-primary-soft: #26344f;
    --color-on-primary: #101827;
    --color-ink: #f7f9ff;
    --color-muted: #c8d0e2;
    --color-muted-light: #9ea8bd;
    --color-border: #3f4f6d;
    --color-border-subtle: #2f3f5f;
    --color-warning-soft: #4a3717;
    --color-success-soft: #183a2a;
    --color-danger-soft: #4b2222;
  }
}
```

- [ ] **Step 6: Run TypeScript build**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes.

- [ ] **Step 7: Commit frontend account primitives**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/auth.tsx frontend/src/lib/theme.ts frontend/src/index.css
git commit -m "feat(account): add frontend theme primitives"
```

---

### Task 3: Member Shell And Routing

**Files:**
- Create: `frontend/src/components/MemberLayout.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Modify: `frontend/src/pages/Alerts.tsx`

**Interfaces:**
- Consumes: `useAuth()` with `user`, `logout`; React Router nested routes.
- Produces: protected `/member/*` routes and shell outlet.

- [ ] **Step 1: Create `MemberLayout`**

Create `frontend/src/components/MemberLayout.tsx`:

```tsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, BookmarkCheck, Home, LogOut, Search, Settings } from "lucide-react";
import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/member/overview", label: "Accueil", icon: Home },
  { to: "/member/consultations", label: "Mes consultations", icon: BookmarkCheck },
  { to: "/member/alerts", label: "Mes alertes", icon: Bell },
  { to: "/member/saved-searches", label: "Recherches enregistrées", icon: Search },
  { to: "/member/account", label: "Profil & préférences", icon: Settings },
];

function itemClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${
    isActive
      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
  }`;
}

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 px-4 py-6 lg:block">
        <div className="mb-6 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{user?.name || "Membre"}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)] truncate">{user?.email}</p>
          <p className="mt-3 inline-flex rounded-full bg-[var(--color-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
            Compte actif
          </p>
        </div>
        <nav className="space-y-1" aria-label="Navigation espace membre">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={itemClass}>
              <item.icon size={17} aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          <LogOut size={17} aria-hidden />
          Se déconnecter
        </button>
      </aside>

      <section className="min-w-0">
        <nav
          className="sticky top-16 z-30 flex gap-2 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 px-4 py-3 backdrop-blur lg:hidden"
          aria-label="Navigation espace membre"
        >
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={itemClass}>
              <item.icon size={16} aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Wire member routes**

In `frontend/src/App.tsx`, import:

```ts
import MemberLayout from "./components/MemberLayout";
import MemberOverview from "./pages/member/MemberOverview";
import MemberConsultations from "./pages/member/MemberConsultations";
import MemberSavedSearches from "./pages/member/MemberSavedSearches";
import MemberAccount from "./pages/member/MemberAccount";
```

Add protected routes inside `PublicLayout` before content pages:

```tsx
          <Route
            path="/member"
            element={
              <RequireAuth>
                <MemberLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/member/overview" replace />} />
            <Route path="overview" element={<MemberOverview />} />
            <Route path="consultations" element={<MemberConsultations />} />
            <Route path="alerts" element={<Alerts embedded />} />
            <Route path="saved-searches" element={<MemberSavedSearches />} />
            <Route path="account" element={<MemberAccount />} />
          </Route>
```

- [ ] **Step 3: Make alerts embeddable**

In `frontend/src/pages/Alerts.tsx`, change the component signature:

```tsx
export default function Alerts({ embedded = false }: { embedded?: boolean }) {
```

Wrap breadcrumbs and page padding conditionally:

```tsx
    <div className={embedded ? "space-y-6" : "px-4 sm:px-6 py-8"}>
      {!embedded && <Breadcrumbs items={[{ label: "Compte" }, { label: "Mes alertes" }]} className="mb-6" />}
```

Keep the rest of the page unchanged.

- [ ] **Step 4: Update navbar account links**

In `frontend/src/components/Navbar.tsx`, change both `Espace membre` links from `/alerts` to `/member/overview`.

Add an account-menu item in both desktop and mobile dropdowns:

```tsx
                <li>
                  <Link to="/member/account" className="text-sm">
                    <Settings size={14} />
                    Profil & préférences
                  </Link>
                </li>
```

Update the lucide import:

```ts
import { Search, Menu, LogIn, LogOut, UserRound, Bell, ShieldCheck, Settings } from "lucide-react";
```

- [ ] **Step 5: Run build for route errors**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes because Task 4 and Task 5 create the page components before this routing task runs.

- [ ] **Step 6: Commit shell routing**

```bash
git add frontend/src/components/MemberLayout.tsx frontend/src/App.tsx frontend/src/components/Navbar.tsx frontend/src/pages/Alerts.tsx
git commit -m "feat(member): add reusable member shell"
```

---

### Task 4: Member Overview, Consultations, And Saved Searches

**Files:**
- Create: `frontend/src/pages/member/MemberOverview.tsx`
- Create: `frontend/src/pages/member/MemberConsultations.tsx`
- Create: `frontend/src/pages/member/MemberSavedSearches.tsx`

**Interfaces:**
- Consumes: `getAlerts()`, `getFavorites()`, `removeFavorite()`, `Tender`, `AlertPreference`.
- Produces: route components used by `App.tsx`.

- [ ] **Step 1: Create overview template**

Create `frontend/src/pages/member/MemberOverview.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BookmarkCheck, Clock, Search } from "lucide-react";
import { getAlerts, getFavorites } from "../../lib/api";
import type { AlertPreference, Tender } from "../../lib/types";
import { useAuth } from "../../lib/auth";

export default function MemberOverview() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [favorites, setFavorites] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getAlerts(), getFavorites()])
      .then(([alertRes, favoriteRes]) => {
        setAlerts(alertRes.data);
        setFavorites(favoriteRes.data);
      })
      .catch(() => setError("Impossible de charger votre espace membre."))
      .finally(() => setLoading(false));
  }, []);

  const activeAlerts = alerts.filter((alert) => Boolean(alert.enabled)).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">
          Bonjour, {user?.name || "membre"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
          Voici ce qui mérite votre attention aujourd'hui.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">À traiter</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link to="/member/alerts" className="rounded-lg border border-[var(--color-border-subtle)] p-4 hover:border-[var(--color-primary)]">
            <Bell size={18} className="text-[var(--color-primary)]" aria-hidden />
            <p className="mt-3 text-2xl font-bold text-[var(--color-ink)]">{loading ? "-" : activeAlerts}</p>
            <p className="text-sm text-[var(--color-muted)]">alertes actives</p>
          </Link>
          <Link to="/member/consultations" className="rounded-lg border border-[var(--color-border-subtle)] p-4 hover:border-[var(--color-primary)]">
            <BookmarkCheck size={18} className="text-[var(--color-primary)]" aria-hidden />
            <p className="mt-3 text-2xl font-bold text-[var(--color-ink)]">{loading ? "-" : favorites.length}</p>
            <p className="text-sm text-[var(--color-muted)]">consultations suivies</p>
          </Link>
          <div className="rounded-lg border border-[var(--color-border-subtle)] p-4">
            <Clock size={18} className="text-[var(--color-warning)]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">Aucune échéance suivie pour le moment</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Les échéances proches apparaîtront ici quand vous suivrez des consultations.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Consultations suivies</h2>
            <Link to="/member/consultations" className="text-sm font-semibold text-[var(--color-primary)]">Voir tout</Link>
          </div>
          {favorites.length === 0 ? (
            <div className="mt-4 rounded-lg bg-[var(--color-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Aucune consultation suivie</p>
              <Link to="/tenders" className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)]">
                Explorer les consultations
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-border-subtle)]">
              {favorites.slice(0, 4).map((tender) => (
                <li key={tender.id} className="py-3">
                  <Link to={`/tenders/${encodeURIComponent(tender.id)}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">
                    {tender.title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{tender.entity} · {tender.location || "Lieu non précisé"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Alertes</h2>
          {alerts.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--color-muted)]">Vous n'avez pas encore créé d'alerte.</p>
              <Link to="/member/alerts" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]">
                <Bell size={15} aria-hidden />
                Créer une alerte
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-[var(--color-border-subtle)] p-3">
                  <p className="font-semibold text-[var(--color-ink)]">{alert.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{alert.enabled ? "Active" : "En pause"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Recherches enregistrées</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Les recherches enregistrées seront disponibles ici. Pour l'instant, utilisez les filtres du catalogue.
        </p>
        <Link to="/tenders" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)]">
          Ouvrir le catalogue
        </Link>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create consultations page**

Create `frontend/src/pages/member/MemberConsultations.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookmarkCheck, ExternalLink, Trash2 } from "lucide-react";
import { getFavorites, removeFavorite } from "../../lib/api";
import type { Tender } from "../../lib/types";
import EmptyState from "../../components/EmptyState";

export default function MemberConsultations() {
  const [favorites, setFavorites] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    const response = await getFavorites();
    setFavorites(response.data);
  }

  useEffect(() => {
    reload()
      .catch(() => setError("Impossible de charger vos consultations suivies."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(tenderId: string) {
    await removeFavorite(tenderId);
    setFavorites((current) => current.filter((tender) => tender.id !== tenderId));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <BookmarkCheck size={22} aria-hidden />
          Mes consultations
        </h1>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          size="md"
          icon={BookmarkCheck}
          title="Aucune consultation suivie"
          description="Enregistrez une consultation depuis le catalogue pour suivre son échéance depuis votre espace membre."
          action={
            <Link to="/tenders" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]">
              Explorer les consultations
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
          {favorites.map((tender) => (
            <li key={tender.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <Link to={`/tenders/${encodeURIComponent(tender.id)}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">
                  {tender.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{tender.entity}</p>
                <p className="mt-1 text-xs text-[var(--color-muted-light)]">
                  {tender.location || "Lieu non précisé"} · Échéance {tender.deadline || "non précisée"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/tenders/${encodeURIComponent(tender.id)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)]">
                  <ExternalLink size={15} aria-hidden />
                  Voir
                </Link>
                <button type="button" onClick={() => handleRemove(tender.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:border-[var(--color-danger)]">
                  <Trash2 size={15} aria-hidden />
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create saved searches page**

Create `frontend/src/pages/member/MemberSavedSearches.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import EmptyState from "../../components/EmptyState";

export default function MemberSavedSearches() {
  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Espace membre</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <Search size={22} aria-hidden />
          Recherches enregistrées
        </h1>
      </header>

      <EmptyState
        size="md"
        icon={Search}
        title="Aucune recherche enregistrée"
        description="Les recherches enregistrées seront ajoutées à cet espace. En attendant, le catalogue reste le point de départ pour filtrer les consultations."
        action={
          <Link to="/tenders" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]">
            Ouvrir le catalogue
          </Link>
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Run build after adding pages**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes or fails only because `MemberAccount` is not created until Task 5. There should be no errors in the three files from this task.

- [ ] **Step 5: Commit member content templates**

```bash
git add frontend/src/pages/member/MemberOverview.tsx frontend/src/pages/member/MemberConsultations.tsx frontend/src/pages/member/MemberSavedSearches.tsx
git commit -m "feat(member): add overview and work templates"
```

---

### Task 5: Member Account Page

**Files:**
- Create: `frontend/src/pages/member/MemberAccount.tsx`

**Interfaces:**
- Consumes: `getAccount`, `updateAccountPreferences`, `changePassword`, `useAuth().updateUser`, `applyThemePreference`.
- Produces: `/member/account` route component.

- [ ] **Step 1: Create account page**

Create `frontend/src/pages/member/MemberAccount.tsx`:

```tsx
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Palette, ShieldCheck, UserRound } from "lucide-react";
import { changePassword, getAccount, updateAccountPreferences } from "../../lib/api";
import type { AccountProfile, ThemePreference } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { applyThemePreference } from "../../lib/theme";

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "Système", description: "Suit les préférences de votre appareil." },
  { value: "light", label: "Clair", description: "Interface claire en permanence." },
  { value: "dark", label: "Sombre", description: "Interface sombre en permanence." },
];

export default function MemberAccount() {
  const { updateUser } = useAuth();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    getAccount()
      .then((loaded) => {
        setAccount(loaded);
        applyThemePreference(loaded.theme);
        updateUser(loaded);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleTheme(theme: ThemePreference) {
    setThemeSaving(true);
    setThemeMessage("");
    applyThemePreference(theme);
    try {
      const updated = await updateAccountPreferences({ theme });
      setAccount(updated);
      updateUser(updated);
      setThemeMessage("Préférence de thème enregistrée.");
    } catch {
      setThemeMessage("Impossible d'enregistrer le thème.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordDraft.new_password.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: passwordDraft.current_password,
        new_password: passwordDraft.new_password,
      });
      setPasswordDraft({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordMessage("Mot de passe mis à jour.");
    } catch (err: any) {
      setPasswordError(err?.message || "Impossible de modifier le mot de passe.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
        Impossible de charger vos préférences.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-label text-[var(--color-muted)]">Compte</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[var(--color-ink)]">
          <UserRound size={22} aria-hidden />
          Profil & préférences
        </h1>
      </header>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Aperçu du compte</h2>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Nom</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.name || "Non renseigné"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Email</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Organisation</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.company || "Non renseignée"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--color-muted)]">Offre</dt>
            <dd className="mt-1 text-sm text-[var(--color-ink)]">{account.plan || "free"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Thème</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Préférence de thème">
          {themes.map((theme) => {
            const active = account.theme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleTheme(theme.value)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                }`}
              >
                <span className="font-semibold text-[var(--color-ink)]">{theme.label}</span>
                <span className="mt-1 block text-sm text-[var(--color-muted)]">{theme.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 min-h-5 text-sm text-[var(--color-muted)]">
          {themeSaving ? "Enregistrement..." : themeMessage}
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-[var(--color-primary)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Mot de passe</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="mt-4 grid max-w-2xl gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Mot de passe actuel</span>
            <input
              type="password"
              autoComplete="current-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.current_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, current_password: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.new_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, new_password: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Confirmer le nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              className="institutional-control w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              value={passwordDraft.confirm_password}
              onChange={(e) => setPasswordDraft((current) => ({ ...current, confirm_password: e.target.value }))}
            />
          </label>
          {passwordError && <p className="text-sm text-[var(--color-danger)]">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-[var(--color-success)]">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={passwordSaving}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Mettre à jour le mot de passe
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit account page**

```bash
git add frontend/src/pages/member/MemberAccount.tsx
git commit -m "feat(member): add account preferences page"
```

---

### Task 6: Final Verification

**Files:**
- Verify changed backend and frontend files.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified local implementation.

- [ ] **Step 1: Run backend regression tests**

Run:

```bash
cd backend && python -m unittest test_account.py test_auth.py test_alerts_api.py test_settings.py test_v1_api_surface.py
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes.

- [ ] **Step 3: Run full app for manual inspection**

Run:

```bash
npm run dev
```

Open `http://localhost:5173/member`.

Manual checks:

- Logged-out users redirect to `/login`.
- Logged-in users land on `/member/overview`.
- Desktop viewport shows the side panel.
- Mobile viewport shows member navigation without horizontal page overflow.
- `/member/alerts` shows the existing alerts workflow.
- `/member/account` changes theme immediately.
- `/member/account` rejects mismatched password confirmation before the API call.

- [ ] **Step 4: Commit final fixes if verification required edits**

```bash
git add backend frontend
git commit -m "fix(member): complete shell verification fixes"
```

Only run this commit step if verification edits were made.

---

## Self-Review

- Spec coverage: backend account API, member side panel, mobile member navigation, overview, alerts route reuse, consultations template, saved-search template, theme preference, password change, navbar links, and verification are covered.
- Scope: billing, 2FA, sessions, account deletion, full saved searches, admin settings, collaboration, bidding, and project workspaces are excluded.
- Type consistency: `ThemePreference`, `AccountProfile`, account API helper names, and `/member/*` route names match across tasks.
