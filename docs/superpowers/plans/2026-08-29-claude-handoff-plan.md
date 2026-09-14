# Claude Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the next product work so a separate implementation agent can execute email/security, member settings, and logged-out homepage work without re-discovering the project context.

**Architecture:** Treat the remaining work as three independent specs with one dependency chain: email/security first, member settings second, homepage independently. Keep the existing FastAPI/SQLite/React architecture and reuse the existing SMTP transport, auth provider, route shell, and API client.

**Tech Stack:** FastAPI, SQLite via aiosqlite, Python unittest, React, Vite, TypeScript, react-router-dom, lucide-react.

## Global Constraints

- Do not expose the full tender catalog publicly in this work.
- Do not block DCE downloads on email verification in this work.
- Do not add marketing/campaign emails in the auth email slice.
- Do not put SMTP/admin settings in the member settings page.
- Do not reveal whether an email address exists during password reset request.
- Do not store raw email action tokens.

---

Date: 2026-08-29

## Purpose

This document packages the next work session for a separate implementation agent. The urgent DCE button bug has already been fixed locally in:

- `backend/main.py`
- `backend/test_tender_routes.py`

Verification already run:

- `cd backend && python3 -m unittest discover`
- Result: 101 tests passed.

Do not rework the DCE fix unless tests fail or review finds a concrete issue. Deploying/committing that fix remains necessary for production.

## Priority Order

1. Email/security foundation.
2. Member settings.
3. Logged-out homepage.

Reason:

- Email/security unlocks verification, password reset, and safe email-change flows.
- Member settings depends on email/security for change-email confirmation.
- The logged-out homepage is important for trust, but it can be built without changing auth internals.

## Specs To Use

- `docs/superpowers/specs/2026-08-29-email-security-foundation-design.md`
- `docs/superpowers/specs/2026-08-29-member-settings-design.md`
- `docs/superpowers/specs/2026-08-29-logged-out-homepage-design.md`

## Execution Guidance

Use test-driven development for backend behavior. Keep each implementation slice independently reviewable and commit after each passing slice.

Recommended slices:

### Slice 1: Email Token Foundation

- [ ] Deliver:

- `email_tokens` migration.
- Token generation/hash/expiry helpers.
- Tests for token creation, lookup, expiration, use, and invalidation.

Do not build UI in this slice.

### Slice 2: Verification Email

- [ ] Deliver:

- Registration creates verification token.
- Verification email template.
- `POST /api/auth/verify-email`.
- `POST /api/auth/resend-verification`.
- `GET /api/auth/me` returns `email_verified`.
- Tests for success, missing SMTP, expired token, used token, and resend throttling.

### Slice 3: Password Reset

- [ ] Deliver:

- `POST /api/auth/request-password-reset`.
- `POST /api/auth/reset-password`.
- Password reset email template.
- No account enumeration.
- Tests for known email, unknown email, valid token, expired token, used token, and login with new password.

### Slice 4: Member Settings Backend

- [ ] Deliver:

- `/api/account` read/update.
- Change password endpoint.
- Request/confirm email change endpoints.
- Delete account endpoint.
- Login/session/digest behavior excludes deleted users.
- Tests in `backend/test_account.py`.

### Slice 5: Member Settings Frontend

- [ ] Deliver:

- `/settings` route.
- Navbar account-menu link.
- Settings page with independent profile, password, email, and delete sections.
- API client functions and type updates.
- `cd frontend && npm run build`.

### Slice 6: Logged-Out Homepage

- [ ] Deliver:

- `Home` page at `/` for logged-out users.
- Logged-in users redirect from `/` to `/tenders`.
- Static sample opportunity cards.
- Trust/story/how-it-works/coming-soon sections.
- Public navbar behavior suitable for logged-out users.
- `cd frontend && npm run build`.

## Existing Code Pointers

Backend:

- Auth routes live in `backend/main.py`.
- Password hashing and JWT helpers live in `backend/auth.py`.
- SQLite schema/migrations live in `backend/database.py`.
- SMTP config resolution lives in `backend/settings.py`.
- SMTP transport lives in `backend/emailer.py`.
- Existing alert email rendering lives in `backend/digest.py`.
- Admin SMTP settings live in `backend/admin.py` and `frontend/src/admin/pages/Settings.tsx`.

Frontend:

- Main routes live in `frontend/src/App.tsx`.
- Auth provider lives in `frontend/src/lib/auth.tsx`.
- API client lives in `frontend/src/lib/api.ts`.
- Shared user type lives in `frontend/src/lib/types.ts`.
- Navbar lives in `frontend/src/components/Navbar.tsx`.
- Login/register pages live in `frontend/src/pages/Login.tsx` and `frontend/src/pages/Register.tsx`.

## Verification Commands

Backend:

```bash
cd backend && python3 -m unittest discover
```

Frontend:

```bash
cd frontend && npm run build
```

Route smoke checks after frontend changes:

- `/`
- `/login`
- `/register`
- `/tenders`
- `/alerts`
- `/settings`

## Open Product Decisions

These are intentionally small and should not block implementation:

- Exact domain email provider and DNS records are an operator/deployment decision.
- Exact homepage copy can be replaced when the 14 homepage elements are supplied.
- A dedicated storytelling page is deferred; use a short homepage block plus existing `/about` first.
