# Member Settings Design

Date: 2026-08-29

## Context

Authenticated users currently have tenders, tender detail, alerts, and logout. Admin users have a separate admin settings area for SMTP. Regular members do not yet have a personal settings page for account control. The requested member space should let users manage email/password and delete the account.

This spec depends partly on the email/security foundation for email verification and email-change confirmation.

## Goals

- Add a member settings page at `/settings`.
- Let users review basic profile information.
- Let users change password after entering current password.
- Let users request an email change with confirmation sent to the new address.
- Let users delete their account through a deliberate confirmation flow.
- Give users more control without exposing admin-only settings.

## Non-Goals

- No admin SMTP settings in the member area.
- No role management.
- No billing/subscription controls.
- No multi-factor authentication in this slice.
- No organization/team management.
- No export of personal data unless explicitly requested later.

## Navigation

Add `Parametres` or `Mon compte` to the authenticated account menu in `Navbar`.

Route:

- `/settings`

Access:

- Authenticated users only.
- Suspended/deleted users should not access the route.

## Backend API Design

Create member-account endpoints under `/api/account`.

### Get Account

`GET /api/account`

Response:

```json
{
  "id": 1,
  "email": "user@example.com",
  "email_verified": true,
  "pending_email": "",
  "name": "User Name",
  "company": "Company",
  "phone": "",
  "plan": "free",
  "role": "user",
  "status": "active",
  "created_at": "2026-08-29 10:00:00",
  "last_login": "2026-08-29 10:20:00"
}
```

### Update Profile

`PATCH /api/account`

Allowed fields:

- `name`
- `company`
- `phone`

Validation:

- `name` must not be blank.
- `company` and `phone` may be blank.
- Do not allow role, status, plan, password, or email changes through this endpoint.

### Change Password

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
- New password must differ from current password.

Behavior:

- Update `password_hash`.
- Return success.
- Existing JWT may remain valid in this slice.

### Request Email Change

`POST /api/account/change-email`

Request:

```json
{
  "new_email": "new@example.com"
}
```

Validation:

- Normalize email by trimming and lowercasing.
- Reject if new email already belongs to another active user.
- Reject if equal to current email.

Behavior:

- Set `users.pending_email = new_email`.
- Create a `change_email` token using the email/security foundation token table.
- Send confirmation email to `new_email`.
- Return `pending_email`.

### Confirm Email Change

`POST /api/account/confirm-email-change`

Request:

```json
{
  "token": "raw-token-from-email"
}
```

Behavior:

- Validate unused/unexpired `change_email` token.
- Confirm `target_email` still does not belong to another active user.
- Update `users.email = target_email`.
- Clear `pending_email`.
- Set `email_verified_at = datetime('now')`.
- Mark token used.
- Return updated user.

### Delete Account

`DELETE /api/account`

Request:

```json
{
  "password": "current-password",
  "confirm": "DELETE"
}
```

Behavior:

- Require current password.
- Require exact confirmation string `DELETE`.
- Soft-delete the account:
  - set `status = 'deleted'`
  - set `deleted_at = datetime('now')`
  - replace email with `deleted+<id>@local.invalid` so the original email can register again later
  - clear `pending_email`
  - optionally blank `name`, `company`, and `phone`
- Favorites, alerts, and digest logs may remain for audit/history in this slice, but deleted users should not receive emails.

Middleware/login impact:

- Login must reject users with `status != 'active'`.
- `require_user` should reject deleted users.
- Digest/alert sends should ignore deleted users.

## Frontend Page Design

`Settings` page sections:

1. Account overview
   - email
   - verification state
   - pending email if any
   - plan
   - account creation date if available

2. Profile
   - name
   - company
   - phone
   - save button

3. Security
   - current password
   - new password
   - confirm new password
   - change password button

4. Email
   - new email field
   - request confirmation button
   - resend/change pending state if `pending_email` exists

5. Danger zone
   - delete account button
   - confirmation dialog requiring password and `DELETE`

UX rules:

- Do not put all forms into one giant form.
- Each section saves independently.
- Show loading and success/error feedback per section.
- Do not expose admin settings here.
- Keep copy calm and clear.

## Files Likely To Change

Backend:

- `backend/database.py`
- `backend/main.py`
- `backend/auth.py` if helper reuse is needed
- New `backend/account.py` is preferred if `main.py` becomes too large
- `backend/digest.py` to exclude deleted users from sends if needed
- Backend tests under `backend/test_account.py`

Frontend:

- `frontend/src/pages/Settings.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/auth.tsx` if user shape changes need refresh support

## Testing

Backend tests:

- Account route requires auth.
- Profile patch changes only allowed fields.
- Password change rejects wrong current password.
- Password change accepts correct current password.
- Email change request rejects duplicate active email.
- Email change request creates pending email and sends confirmation.
- Email change confirmation updates email and verification status.
- Delete account requires password and `DELETE`.
- Deleted user cannot login.
- Deleted user is ignored by digest/alert sends.

Frontend checks:

- `/settings` is protected.
- Navbar links to settings for authenticated users.
- Profile form saves independently.
- Password form validates confirmation before request.
- Email form shows pending email state.
- Delete dialog requires explicit confirmation.

## Acceptance Criteria

- A signed-in user can open `/settings`.
- A signed-in user can update name/company/phone.
- A signed-in user can change password after entering current password.
- A signed-in user can request an email change and confirm it by email.
- A signed-in user can delete the account through a deliberate password-confirmed flow.
- Deleted users cannot log in or receive alert/digest emails.
