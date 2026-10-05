# Member Space Shell Design

Date: 2026-09-01

## Context

The product already has authenticated alerts, favorites, and account login, but the regular member area is represented only by links to existing screens. The reference file `/Users/mkroze/Downloads/member_space_best_practices.md` defines the desired model: the member space should behave like a control center for professional tender work, not a generic dashboard.

This slice creates the durable member-space template and the first account controls: theme preference and password change.

## Goals

- Add a protected `/member/*` area with a persistent side panel on desktop.
- Make the navigation easy to extend as future member material is added.
- Align the member IA with the best-practices document:
  - Accueil
  - Mes consultations
  - Mes alertes
  - Recherches enregistrées
  - Profil & préférences
- Add an operational overview template that prioritizes attention and next actions.
- Add an account/preferences page where the member can set a theme preference and change password.
- Persist the theme preference per account and apply it immediately in the frontend.
- Keep existing `/alerts` behavior available while introducing `/member/alerts` as the member-space route.

## Non-Goals

- No billing or subscription management.
- No two-factor authentication.
- No active-session management.
- No account deletion in this slice.
- No full saved-search implementation.
- No tender collaboration, bidding workflow, or project workspace.
- No admin settings inside the member area.

## Information Architecture

Routes:

- `/member` redirects to `/member/overview`.
- `/member/overview` shows the member command-center template.
- `/member/alerts` renders the existing alerts workflow inside the member shell.
- `/member/consultations` shows followed/saved consultations as a template backed by existing favorites where possible.
- `/member/saved-searches` shows an empty-state template for the future saved-search feature.
- `/member/account` shows profile, preferences, and security settings.

The existing `/alerts` route remains available for compatibility and can redirect or render the same alerts page. Navbar account-menu links should point to `/member/overview` for "Espace membre" and `/member/account` for account controls.

## Member Layout

Create a reusable `MemberLayout` component.

Desktop behavior:

- Two-column shell with a fixed-width side panel and a content region.
- Side panel contains the member identity summary, stable navigation, and a logout action.
- Active section is clearly indicated.
- Navigation labels use user-facing French nouns from the best-practices document.

Mobile behavior:

- The global navbar remains available.
- Member navigation becomes a compact horizontal tab row or bottom-friendly stacked nav at the top of the member content.
- Content becomes a prioritized vertical feed; do not shrink a dense desktop dashboard into a small grid.

Visual style:

- Use the existing institutional tokens from `frontend/src/index.css`.
- Keep panels quiet and operational, not marketing-like.
- Use lucide icons with visible labels.
- Avoid nested cards; repeated items may use cards, page sections should be unframed or simple bordered panels.

## Overview Page

The overview is a decision surface. It should answer:

- What needs attention?
- What is new?
- What am I following?
- Are my alerts configured?
- What should I do next?

Initial blocks:

- Header: `Bonjour, [Prénom]`
- Attention panel:
  - active alert count
  - saved/followed consultation count
  - near-deadline block that shows "Aucune échéance suivie pour le moment" until followed-tender deadline data is available
- Alerts summary:
  - links to `/member/alerts`
  - empty state when there is no alert
- Followed consultations:
  - use `/api/favorites` for the current user's saved tenders
  - show open/remove actions where available
- Saved searches:
  - future-feature empty state linking back to `/tenders`

Each block should have one clear next action.

## Account And Preferences Page

Sections:

- Account overview:
  - name
  - email
  - plan/status where available
- Theme preference:
  - system
  - light
  - dark
- Password:
  - current password
  - new password
  - confirm new password
  - inline validation and success/error feedback

Each section saves independently. Password fields clear after a successful change. Theme choice applies immediately and persists to the backend.

## Backend API

Add member account endpoints under `/api/account`.

`GET /api/account`

Returns:

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "company": "Company",
  "phone": "",
  "plan": "free",
  "role": "user",
  "status": "active",
  "theme": "system",
  "created_at": "2026-09-01 10:00:00",
  "last_login": "2026-09-01 10:20:00"
}
```

`PATCH /api/account/preferences`

Request:

```json
{
  "theme": "dark"
}
```

Validation:

- Theme must be one of `system`, `light`, or `dark`.

Behavior:

- Store the theme on `users.theme`.
- Return the updated account view.

`POST /api/account/change-password`

Request:

```json
{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

Validation:

- Current password must match.
- New password must be at least 8 characters.
- New password must differ from the current password.

Behavior:

- Update `users.password_hash`.
- Return `{ "status": "updated" }`.

Security:

- All `/api/account/*` routes require authentication.
- `require_user` should reject users whose status is not `active`.
- Login should reject users whose status is not `active`.

Database:

- Add `users.theme TEXT DEFAULT 'system'` through an idempotent migration.

## Frontend Data Flow

- Extend the `User` type with `theme`, `created_at`, `last_login`, `phone`, and optional account metadata.
- Add API helpers:
  - `getAccount()`
  - `updateAccountPreferences({ theme })`
  - `changePassword({ current_password, new_password })`
- Extend `AuthProvider` so it can refresh or update the current user after account changes.
- Add a small theme utility that stores the effective preference in local storage for immediate first paint and applies a document-level attribute or class.
- Account page updates backend first, then updates auth context and local theme state.

## Error Handling And Feedback

- Failed account load shows a local error state inside the member content.
- Failed theme save reverts or reports the failed save without breaking local navigation.
- Password errors are shown near the password form:
  - wrong current password
  - new password too short
  - confirmation mismatch
- Successful changes use existing toast patterns where practical.

## Testing

Backend tests:

- Account routes require authentication.
- `GET /api/account` returns current account without `password_hash`.
- Theme update accepts `system`, `light`, and `dark`.
- Theme update rejects invalid values.
- Password change rejects wrong current password.
- Password change rejects short password.
- Password change rejects same password.
- Password change accepts the correct current password.
- Login rejects non-active users.
- `require_user` rejects non-active users.

Frontend verification:

- TypeScript build passes.
- Member routes render behind auth protection.
- Navbar links point into `/member`.
- Theme selector applies the selected mode immediately.
- Password form validates confirmation before calling the API.

## Acceptance Criteria

- A signed-in user can open `/member` and land on the member overview.
- Desktop users see a persistent member side panel.
- Mobile users can navigate member sections without horizontal overflow.
- `/member/alerts` keeps the existing alert workflow usable.
- `/member/account` lets a user choose theme preference.
- `/member/account` lets a user change password with current-password verification.
- Invalid password/theme changes show clear errors.
- The member shell can accept future pages without changing the global navbar.
