# Launch todo — domain + admin + real data (2026-08-22)

**Goal A:** the app opens on the purchased domain (HTTPS), with a working **admin/owner account** on Render.
**Goal B:** a brand-new visitor in an **incognito tab** on that domain sees the **correct, real tender data** (not empty, not stale, not an admin-only view).

Acceptance = both goals verified from a clean incognito session at the end (Phase 5).

---

## Status / context (already true)

- ✅ **Auto-promote on register** — an `ADMIN_EMAILS`-listed email becomes `owner` at signup, no restart needed (`backend/main.py` `register()`, `backend/admin.py` `is_bootstrap_admin_email`). Tests green (`test_admin.py`, 97 passing). ⚠️ Currently **uncommitted on `next-prod`** → see Phase 0.
- The catalog is **gated behind a session** by design: only `/api/auth/login` + `/api/auth/register` are public; `/api/tenders`, `/api/filters`, `/api/alerts`, `/api/admin/*` need a valid token (`main.py` `restrict_v1_api_surface`). So an incognito visitor must **register/login first**, then sees the catalog.
- Fresh deploy starts with an **empty DB**; nothing scrapes on startup. Population happens via **admin → `/admin/imports` → Run import** (`POST /api/admin/imports`). `POST /api/scrape` is intentionally 404'd by the middleware — don't rely on it.

---

## Phase 0 — Pre-deploy code fixes (required, do before/with deploy)

- [ ] **Persist the JWT secret across restarts.** `backend/auth.py:8` uses `SECRET_KEY = secrets.token_hex(32)` at import → **random every boot**, so every Render redeploy/restart invalidates all tokens and logs out the admin + all users. Change to read `os.getenv("SECRET_KEY")` with the random value as dev-only fallback. Then set `SECRET_KEY` on Render (Phase 1). _Acceptance:_ log in, redeploy, refresh — still logged in.
- [ ] **Commit the auto-promote change** and make sure it lands on the branch Render builds. Confirm which branch that is (`next-prod` per branch model → decide if Render tracks it or `main`/`prod`). _Acceptance:_ deployed image contains `register()` auto-promote.
- [ ] **Decision — catalog visibility.** Confirm "register-to-view" is the intended public face for launch. If the catalog should be publicly browsable in incognito **without** login, that's a middleware change (add `/api/tenders`, `/api/filters` to `V1_PUBLIC_API_PATHS` + drop `RequireAuth` on `/tenders`) — flag before proceeding. Default assumption: **keep it gated**.

---

## Phase 1 — Render service configuration

- [ ] Confirm the service is a **Docker** deploy from the correct branch; build succeeds (Vite frontend → `static/`, backend on `:8000`).
- [ ] **Add a persistent Disk** mounted at **`/app/data`** (size ~1 GB). ⚠️ The Dockerfile's `VOLUME /app/data` does **not** create a Render disk; without this, every deploy wipes users + tenders and Goal B fails. DB path is `data/tenders.db` (`config.py:14`).
- [ ] Set **environment variables** (see reference table at bottom). Minimum for launch: `ADMIN_EMAILS`, `SECRET_KEY`, `FRONTEND_URL`.
- [ ] Confirm **health check path = `/`** (SPA catch-all `serve_spa` serves `index.html`; there is no dedicated `/health`).
- [ ] Trigger a deploy; confirm logs show `init_db` + scheduler start with no errors.

_Acceptance:_ Render URL (`*.onrender.com`) loads the SPA over HTTPS.

---

## Phase 2 — Domain & DNS & SSL

- [ ] Add the **custom domain** in Render → Settings → Custom Domains (add both apex `example.ma` and `www` if desired).
- [ ] At the domain registrar, add the DNS records Render shows:
  - `www` → **CNAME** to the Render target.
  - apex/root → **A/ALIAS/ANAME** per Render's instructions (apex CNAME often not allowed).
- [ ] Decide + configure **apex↔www redirect** (pick a canonical host).
- [ ] Wait for DNS propagation, then confirm Render issues the **Let's Encrypt SSL cert** (status "Certificate issued").
- [ ] Set `FRONTEND_URL=https://<canonical-domain>` (used for links in alert/digest emails, `digest.py:180,237`) and redeploy if changed.

_Acceptance:_ `https://<domain>` loads the app with a valid padlock; http→https and non-canonical→canonical redirects work.

---

## Phase 3 — Admin/owner account on Render

- [ ] Ensure `ADMIN_EMAILS=<your-owner-email>` is set (comma-separated for multiple).
- [ ] On the live domain, **register** with that exact email.
- [ ] Confirm you're `owner`: `/api/auth/me` returns `"role":"owner"`, and **`/admin`** loads (not the "restricted to administrators" screen).
- [ ] Sanity-check the token survives a redeploy (validates the Phase 0 `SECRET_KEY` fix).

_Acceptance:_ owner can open `/admin/imports` with an enabled **Run import** button.

---

## Phase 4 — Populate real data

- [ ] From `/admin/imports`, click **Run import**; wait for it to finish (few minutes; view auto-refreshes).
- [ ] Verify the run row: status `done`, **found > 0**, **new > 0** (not `failed`). If `failed` or 0 found → the scraper can't reach `marchespublics.gov.ma` from Render's network; capture the error from the run detail and investigate (network egress / site change) before launch.
- [ ] Spot-check `/api/tenders` returns a real `total` and the fields look right (title, entity, deadline, location).
- [ ] Confirm the **07:00 Africa/Casablanca scheduler** will refresh daily. ⚠️ Note: on Render free/spun-down instances the in-process scheduler won't fire while asleep — if freshness matters, use a paid always-on instance or an external cron hitting a trigger.

_Acceptance:_ catalog shows a realistic count of current tenders.

---

## Phase 5 — Incognito acceptance test (verifies both goals)

Do this in a **fresh incognito window** (no cached token/admin session):

- [ ] Open `https://<domain>` → site loads over HTTPS.
- [ ] Register a **throwaway non-admin** test user → lands in the app.
- [ ] `/tenders` shows **populated, correct data**: filters (sector/category/location) work, pagination works, a tender detail page opens with sensible fields.
- [ ] Confirm the anonymous/non-admin user does **not** see admin UI, and `/admin` is denied.
- [ ] Log out → confirm gated routes bounce to `/login` (expected behavior).
- [ ] (Optional cleanup) suspend/delete the throwaway test user from `/admin/users`.

_Acceptance:_ Goal A (domain + admin) and Goal B (right data in incognito) both pass.

---

## Phase 6 — Post-launch hardening (nice-to-have, not blockers)

- [ ] **SMTP (Brevo)** for alert confirmations + daily digests — set via `.env`/Render or admin **Settings → Email**. Without it, alerts save but no email goes out.
- [ ] **`ANTHROPIC_API_KEY`** if the legal assistant should work (else `/api/assistant/ask` returns 503).
- [ ] Tighten **CORS** origins if the API is ever called cross-origin (currently localhost-only; harmless while SPA is served same-origin).
- [ ] Basic **error monitoring / log retention** on Render.
- [ ] Back up the SQLite DB on the disk (periodic copy / snapshot).
- [ ] Load-test the import lock behavior (concurrent Run import → 409, already handled).

---

## Environment variable reference (Render)

| Var | Required | Value | Why |
|---|---|---|---|
| `ADMIN_EMAILS` | ✅ | owner email(s), comma-sep | Promotes account to `owner` (bootstrap + register auto-promote) |
| `SECRET_KEY` | ✅ (after Phase 0 fix) | long random hex | Stable JWT signing so sessions survive redeploys |
| `FRONTEND_URL` | ✅ | `https://<domain>` | Correct links in alert/digest emails |
| `DIGEST_HOUR` | ⬜ | `7` (default) | Daily scrape+digest hour (Africa/Casablanca) |
| SMTP_* (`HOST/PORT/USER/PASSWORD/FROM/FROM_NAME`) | ⬜ | Brevo relay creds | Send alert/digest emails |
| `ANTHROPIC_API_KEY` | ⬜ | Claude API key | Legal assistant feature |

Persistent Disk: mount path **`/app/data`** (not an env var, but mandatory).

---

## Critical-path summary (shortest route to both goals)

1. Phase 0: add `SECRET_KEY` env support + commit auto-promote.
2. Phase 1: Render disk at `/app/data` + env vars + deploy.
3. Phase 2: domain + DNS + SSL, set `FRONTEND_URL`.
4. Phase 3: register owner email → `/admin`.
5. Phase 4: Run import → verify real data.
6. Phase 5: incognito acceptance test.
