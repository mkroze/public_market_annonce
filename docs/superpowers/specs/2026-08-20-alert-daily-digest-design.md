# Alert Daily Digest Design

## Context

The current alert page lets authenticated users create alert preferences, preview current matches, enable or pause alerts, and send a basic SMTP test email. The backend already has SMTP support, a daily scrape scheduler, alert matching, digest rendering, and `digest_log` deduplication. However, the user-facing behavior is incomplete for the beta product:

- Alert frequency exists in the model and UI, but daily/weekly behavior is not enforced by the digest job.
- Users can create multiple alerts even though the free beta should allow one alert per user.
- Saving an alert does not prove to the user that email delivery is configured.
- The daily digest currently focuses on newly imported tenders only, without a separate urgency-oriented shortlist of still-open matching tenders.

## Goals

- Allow one beta alert per user.
- Send a confirmation email when a user creates, edits, or reactivates an enabled alert.
- Send a daily digest at 07:00 Morocco time only when newly added tenders match the user's alert.
- Structure the daily email into a highlighted new-matches section and a secondary urgent-open-tenders section.
- Keep the email-rendering contract simple so a polished HTML template can replace the initial markup later.

## Non-Goals

- No weekly alert frequency in the beta flow.
- No daily email when there are no new matching tenders.
- No rollback of alert changes if confirmation email delivery fails.
- No multi-alert management for free beta users.
- No provider-specific email API integration beyond the existing SMTP setup.

## User Behavior

The `/alerts` page supports exactly one alert for each free beta user. If the user has no alert, they can create one. If they already have an alert, the page focuses on editing, pausing, reactivating, or deleting that alert.

When a user creates an enabled alert, edits an enabled alert, or reactivates a paused alert, the backend attempts to send a short confirmation email. The confirmation email summarizes the active criteria and states that the next digest is expected at 07:00 Morocco time.

Every day, after the scheduled scrape/import job, the digest system checks newly added tenders against the user's enabled alert. If there are no new matching tenders, no email is sent. If there are new matching tenders, the user receives one digest email.

The digest email contains:

1. `Nouveaux appels d'offres`: newly added matching tenders from the current import cycle, visually emphasized.
2. `A traiter bientot`: up to 5 still-open matching tenders sorted by closest deadline.
3. A link to view all matching tenders in the app.

## Backend Design

### Alert Limit

`POST /api/alerts` enforces one alert per user. If an alert already exists for the authenticated user, the endpoint returns a clear client error with a beta-limit message. This protects the beta rule even if someone bypasses the UI.

`PUT /api/alerts/{alert_id}` remains the update path for edits, pausing, and reactivation.

### Confirmation Email

The backend adds a confirmation-email renderer and sender around the existing `emailer.send_email` function.

Confirmation sends after successful persistence when:

- a new alert is created with `enabled = true`;
- an existing alert is edited while it is enabled;
- an existing alert changes from disabled to enabled.

The alert save/update remains successful if SMTP is disabled or if delivery fails. The API response should expose enough status for the UI to tell the user whether the alert was saved and whether the confirmation email was sent.

### Daily Digest

The existing scheduled job remains the entry point:

1. Scheduler runs at `DIGEST_HOUR=7`.
2. Scraper imports tenders and returns `new_ids`.
3. Digest service matches enabled alerts against `new_ids`.
4. Users with at least one new unmatched tender receive one email.

The digest service expands the email content:

- New section: tenders from `new_ids` that match the user's alert and are not already in `digest_log`.
- Urgent-open section: up to 5 currently open matching tenders, excluding tenders already shown in the new section where practical, sorted by nearest valid deadline.

`digest_log` continues to deduplicate newly sent tenders by `(user_id, tender_id)`. If sending fails, no log rows are written, so a later successful run can still notify the user.

### Timezone

The product behavior is 07:00 Morocco time. The current scheduler uses server-local time, so deployment must run the backend with the Morocco timezone configured. Explicit timezone support can be added later if deployment constraints require it.

## Frontend Design

The alert page reflects the one-alert beta model:

- If the user has no alert, show the create action and empty state.
- If the user already has one alert, hide or disable `Nouvelle alerte`.
- If the backend returns the beta-limit error, show a toast explaining that the free beta allows one alert.
- Remove or lock non-daily frequency controls so the UI matches actual behavior.
- After create, edit, or reactivation, show a success toast that distinguishes:
  - alert saved and confirmation email sent;
  - alert saved, but confirmation email could not be sent.
- Keep the manual `Email de test` action as secondary troubleshooting.

The alert card continues to show enabled state, criteria, last sent status, and quick actions.

## Email Content Contract

Initial email HTML can remain backend-generated, but the renderer should be structured around named content blocks so a future HTML template can replace the visual layer without changing matching logic.

Required confirmation-email content:

- Alert active status.
- Criteria summary: sectors, regions, keywords, budget.
- Next expected digest time: 07:00 Morocco time.
- Link to manage the alert.

Required digest-email content:

- Subject with the number of new matching tenders.
- Highlighted new matches section.
- Secondary urgent-open shortlist with up to 5 closest deadlines.
- Link to all matching opportunities or the alert page.
- Plain-text alternative for email clients that do not render HTML.

## Error Handling

- SMTP not configured: alert save/update succeeds; response marks confirmation email as skipped or failed.
- Confirmation send failure: alert save/update succeeds; response marks email failure.
- Digest send failure: do not write `digest_log`; log the failure for operators.
- No new matches: skip sending entirely.
- No valid deadlines in urgent-open candidates: place invalid or missing deadlines after valid dated tenders, or omit them if enough valid candidates exist.

## Testing

Backend tests should cover:

- One-alert beta limit in `POST /api/alerts`.
- Confirmation email attempts on create, enabled edit, and reactivation.
- No confirmation email when saving a disabled alert.
- Digest skips email when there are no new matching tenders.
- Digest renders new matches plus at most 5 urgent open tenders.
- Urgent-open tenders are sorted by closest valid deadline.
- Failed digest send does not write `digest_log`.

Frontend verification should cover:

- Existing alert hides or disables new-alert creation.
- Beta-limit API error displays a clear toast.
- Daily-only UI matches backend behavior.
- Save success messaging reflects confirmation-email status.
- `npm run build` from `frontend/` passes.

## Acceptance Criteria

- A free beta user cannot create more than one alert through the UI or API.
- Creating, editing, or reactivating an enabled alert saves the alert and attempts a confirmation email.
- Daily digest email sends only when new matching tenders exist.
- Daily digest email highlights new matching tenders separately from the closest-deadline open shortlist.
- The urgent-open shortlist contains no more than 5 tenders and is sorted by nearest deadline.
- If email delivery fails, user alert settings are still saved and digest deduplication is not falsely recorded.
