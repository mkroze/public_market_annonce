# Email Security Foundation Design

Date: 2026-08-29

## Context

The app already has password-based registration/login, JWT sessions, SMTP transport, admin-editable SMTP settings, alert confirmation emails, and daily digest emails. Users can currently create an account and immediately access the catalog. There is no email verification, no password reset flow, and no reusable transactional email template system for auth events.

The business need is practical trust: accounts should be validated through the domain email system, users should be able to recover access, and emails should look credible rather than improvised.

## Goals

- Add account email verification for new users.
- Add password reset by email.
- Add reusable transactional email templates for auth and account events.
- Reuse the existing SMTP configuration path from env/admin settings.
- Keep account creation usable even when SMTP is not configured, but clearly mark verification as pending.
- Give operators clear failure modes when SMTP is missing or delivery fails.

## Non-Goals

- No marketing newsletter system.
- No campaign automation.
- No provider-specific API integration; use the existing SMTP transport.
- No multi-factor authentication in this slice.
- No paid-plan or billing logic.
- No full identity provider migration.

## Domain Email Setup Requirement

This is partly outside the codebase. The operator must create at least one mailbox or sender identity on the purchased domain and configure DNS records required by the email provider.

Minimum sender setup:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_FROM_NAME`
- `FRONTEND_URL`

Deliverability requirements:

- The sender domain must have SPF configured.
- The sender domain must have DKIM configured.
- DMARC should be configured in monitoring mode first.
- `SMTP_FROM` should be an address on the verified domain, for example `contact@<domain>` or `alertes@<domain>`.

Provider-specific DNS records must be checked against the provider documentation at implementation/deployment time. Do not guess those records in code or docs.

## Backend Data Model

Add a token table for one-time email actions:

- `email_tokens`
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `user_id INTEGER NOT NULL REFERENCES users(id)`
  - `purpose TEXT NOT NULL`
  - `token_hash TEXT NOT NULL UNIQUE`
  - `target_email TEXT NOT NULL DEFAULT ''`
  - `expires_at TEXT NOT NULL`
  - `used_at TEXT`
  - `created_at TEXT DEFAULT (datetime('now'))`

Allowed `purpose` values:

- `verify_email`
- `password_reset`
- `change_email`

Add user account columns:

- `email_verified_at TEXT`
- `pending_email TEXT`
- `deleted_at TEXT`

Existing `users.status` remains the coarse account state. Deleted accounts should set `status = 'deleted'`.

Token storage rules:

- Store only a hash of the raw token.
- Generate raw tokens with strong randomness.
- Expire verification tokens after 24 hours.
- Expire password reset tokens after 60 minutes.
- Mark tokens as used after successful completion.
- Invalidate previous unused tokens for the same user and purpose when creating a new one.

## Backend API Design

### Registration

`POST /api/auth/register`

Current behavior creates a user and returns a token. New behavior:

- Normalize email by trimming and lowercasing before duplicate checks.
- Create the user with `email_verified_at = NULL`.
- Create a `verify_email` token.
- Attempt to send a verification email.
- Return the auth token and user as today, plus verification status.

Response user shape additions:

```json
{
  "email_verified": false
}
```

If SMTP is not configured or sending fails:

- Registration still succeeds.
- The API response includes `verification_email_sent: false`.
- The backend logs the failure.

### Current User

`GET /api/auth/me`

Add:

```json
{
  "email_verified": true
}
```

### Verify Email

`POST /api/auth/verify-email`

Request:

```json
{
  "token": "raw-token-from-email"
}
```

Behavior:

- Hash token.
- Find unused, unexpired `verify_email` token.
- Set `users.email_verified_at = datetime('now')`.
- Set token `used_at = datetime('now')`.
- Return updated user verification status.

### Resend Verification

`POST /api/auth/resend-verification`

Authenticated.

Behavior:

- If already verified, return `already_verified: true`.
- Otherwise create a fresh `verify_email` token and attempt email delivery.
- Rate-limit by refusing resend if the most recent unused token was created less than 2 minutes ago.

### Request Password Reset

`POST /api/auth/request-password-reset`

Request:

```json
{
  "email": "user@example.com"
}
```

Behavior:

- Always return a generic success response, even if the email does not exist.
- If an active user exists, create a `password_reset` token and send a reset email.
- Do not reveal whether the email is registered.

### Reset Password

`POST /api/auth/reset-password`

Request:

```json
{
  "token": "raw-token-from-email",
  "password": "new-password"
}
```

Behavior:

- Validate token exists, unused, and unexpired.
- Validate password length is at least 8 characters.
- Replace `users.password_hash`.
- Mark token used.
- Return generic success.

## Frontend Design

Routes to add:

- `/verify-email`
- `/forgot-password`
- `/reset-password`

Existing auth pages:

- `Register` should show a post-registration message when `verification_email_sent` is false or true.
- `Login` should add a "Mot de passe oublie" link to `/forgot-password`.
- Auth state should carry `email_verified`.

Catalog gating decision:

- Keep the catalog accessible after registration for now.
- Show a non-blocking verification notice in authenticated pages until `email_verified` is true.
- Do not block DCE downloads in this slice, because practical access is currently core to the product.

## Email Template Contract

Create a small template module that renders both HTML and plain text for transactional emails. The transport remains `send_email(config, to, subject, html, text)`.

Base template requirements:

- Brand name: `Marches Publics Maroc`.
- Clear subject line.
- One primary action button/link.
- Plain-text fallback with the full URL.
- Footer explaining why the recipient received the email.
- No tracking pixels.
- No remote decorative images.

Templates:

### Verify Email

Subject: `Confirmez votre email - Marches Publics Maroc`

Primary action: confirm email.

Plain-text fallback includes the full verification URL.

### Password Reset

Subject: `Reinitialisation de votre mot de passe`

Primary action: reset password.

Copy must state that the link expires in 60 minutes and can be ignored if the user did not request it.

### Change Email

Subject: `Confirmez votre nouvelle adresse email`

Primary action: confirm new email.

This supports the member settings spec.

## Error Handling

- SMTP missing on register: account created, verification pending, email status returned as not sent.
- SMTP failure on register/resend/reset: token created, failure logged, generic user-facing error when appropriate.
- Invalid/expired token: show a clear frontend state with a resend path when authenticated.
- Used token: show an expired/invalid state.
- Password reset request for unknown email: always show the same success screen.

## Testing

Backend tests:

- Registration creates an unverified user and attempts verification email.
- Registration succeeds when SMTP is not configured.
- `/api/auth/me` returns `email_verified`.
- Verify email accepts valid unused token and updates `email_verified_at`.
- Verify email rejects expired, used, and unknown tokens.
- Resend verification rate-limit works.
- Password reset request does not reveal whether account exists.
- Password reset changes the password for a valid token.
- Password reset rejects expired, used, and unknown tokens.

Frontend checks:

- Register flow shows verification message.
- Login page links to forgot password.
- Forgot password form shows generic success.
- Reset password form validates minimum length.
- Verify email route shows success/expired states.

## Acceptance Criteria

- A newly registered user has `email_verified = false`.
- A verification email is attempted at registration when SMTP is configured.
- Clicking a valid verification link marks the user verified.
- A user can request password reset without account enumeration.
- A valid reset link allows the user to set a new password.
- All transactional auth emails have HTML and plain-text versions.
- Existing alert/digest SMTP behavior remains intact.
