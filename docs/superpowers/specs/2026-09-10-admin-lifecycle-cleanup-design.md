# Admin Lifecycle Cleanup Design

Date: 2026-09-10
Status: Draft for user review

## Purpose

The admin space already has RBAC, audit logs, import controls, tender moderation, and DCE cache cleanup, but expired tenders are not treated as a first-class operational queue. Operators can archive selected records, yet there is no clear path to remove old expired tenders from the active working set, and archived records may still leak into public or member-facing surfaces.

This design introduces a reversible lifecycle cleanup workflow: make expired tenders visible, measurable, and safely archivable in bulk before adding any irreversible purge feature.

## Design Inputs

Three read-only agents informed this design:

- Code/layout audit: reviewed the admin app, tender moderation page, import/DCE controls, backend admin API, scraper insertion flow, and tender schema.
- Apple/Google synthesis: reviewed current official Apple HIG and Google Material guidance for admin workflows, tables, filters, destructive actions, accessibility, and retention clarity.
- Gap mapper: translated the code audit and standards into the smallest high-impact implementation slice.

Relevant external guidance:

- Apple HIG: lists and tables, alerts, writing, feedback, accessibility, settings, disclosure controls, toolbars, privacy, and account deletion guidance. Entry points include https://developer.apple.com/design/human-interface-guidelines/lists-and-tables, https://developer.apple.com/design/human-interface-guidelines/alerts, and https://developer.apple.com/design/human-interface-guidelines/accessibility.
- Google Material: canonical layouts, data tables, dialogs, chips, states, snackbars, and Material Web component guidance. Entry points include https://m3.material.io/foundations/layout/canonical-examples/overview, https://m2.material.io/develop/web/components/data-tables, and https://material-web.dev/components/dialog.

## Current State

Admin routes are mounted under `/admin/*` with a sticky sidebar and topbar. The flat IA includes Dashboard, Imports, Tenders, Audit logs, Users, Roles, Settings, and disabled Integrations.

Scraping is managed in `frontend/src/admin/pages/Imports.tsx`, which combines full imports, DCE cache warming, import history, DCE cache history, and DCE cache clearing. Tender moderation is managed in `frontend/src/admin/pages/Tenders.tsx` with filters, row selection, and batch actions for review, flag, retry detail, archive, and restore.

Backend admin endpoints live in `backend/admin.py`. The scraper currently inserts new tenders with `INSERT OR IGNORE`, so existing records are not refreshed and old tenders are not reconciled. The dashboard counts stale records, but the SQL compares `DD/MM/YYYY` deadline strings directly against `date('now')`, which is unreliable. DCE cache cleanup already has a better normalized date expression, but it only clears cached ZIP files.

## Selected Approach

Implement a Lifecycle Cleanup Queue as the first admin enhancement.

This means:

- Normalize tender deadline lifecycle data.
- Add an expired/open/unknown filter in admin tenders.
- Rename the dashboard stale metric to an actionable "Expired active" queue.
- Add a bulk "Archive expired active" action with typed confirmation.
- Make archive meaningful by excluding archived tenders from public/member/alert surfaces.
- Preserve restore for reversible recovery.
- Defer permanent purge to a later phase.

This approach gives operators immediate control over old junk while protecting against accidental data loss and scraper/date parsing mistakes.

## Non-Goals

- No permanent tender deletion in this phase.
- No major admin IA rebuild into separate Sources, Cleanup, and DCE pages yet.
- No full scraper-source registry.
- No duplicate detection workflow.
- No redesign of public tender cards or member pages beyond archived-record visibility rules.

## Backend Design

Add `backend/tender_lifecycle.py` as the shared lifecycle helper module. It should provide:

- A SQL expression or helper for converting stored `DD/MM/YYYY HH:MM` deadlines into `YYYY-MM-DD`.
- A reusable `deadline_state` expression: `expired`, `open`, or `unknown`.
- A reusable public visibility condition for non-admin tender surfaces.
- A Python helper for deriving `deadline_date` from scraped deadline text.

Extend the `tenders` table through idempotent migrations in `backend/database.py`:

- `deadline_date TEXT`
- `source_last_seen_at TEXT`
- `last_seen_import_id INTEGER`
- `archived_at TEXT`
- `archived_reason TEXT`

Add indexes for:

- `deadline_date`
- `admin_status`
- `last_seen_import_id`

Backfill `deadline_date` during database initialization for existing rows where it is missing and derivable from `deadline`.

Update `GET /api/admin/overview`:

- Replace the current stale count with an "expired active" count based on normalized deadline dates.
- Count only tenders with `admin_status != 'archived'` and `deadline_date < date('now')`.

Update `GET /api/admin/tenders`:

- Accept `deadline_state=expired|open|unknown`.
- Return lifecycle fields for each row:
  - `deadline_date`
  - `deadline_state`
  - `public_visible`
  - `source_last_seen_at`
  - `archived_at`
  - `archived_reason`
- Sort and filter using normalized lifecycle fields where relevant.

Update batch actions:

- `archive` sets `admin_status='archived'`, `archived_at=datetime('now')`, and `archived_reason='manual'`.
- `restore` sets `admin_status='active'`, clears `archived_at`, and clears `archived_reason`.
- `flag` continues to set `review_status='flagged'`, but the frontend will now send a note.

Add `POST /api/admin/tenders/cleanup-expired`:

- Requires `tenders.moderate`.
- Archives active tenders whose `deadline_date < date('now')`.
- Sets `archived_reason='expired_deadline'`.
- Optionally clears outdated DCE cache entries when requested.
- Writes an audit event named `tender.cleanup.expired_archive`.
- Returns `{ matched, archived, dce_removed, dce_freed_bytes }`.

Update scraper persistence:

- Replace `INSERT OR IGNORE` with an upsert.
- Update existing tender fields, `deadline`, `deadline_date`, `source_last_seen_at`, and `last_seen_import_id`.
- Populate `tenders_updated` and `tenders_skipped` in `scrape_log`.
- Preserve manual archives.
- Only auto-restore rows archived with `archived_reason='expired_deadline'` if they reappear with a future deadline.

Update public/member/alert surfaces:

- Exclude archived tenders by default from public list, public detail, exports, DCE/PDF download paths, favorites, stats/directories, alert previews, and digest sending.
- Use the shared public visibility condition instead of repeating ad hoc SQL.

## Frontend Design

Update admin navigation copy:

- Rename "Imports" to "Scraping runs" in the sidebar and page title.
- Keep the existing route `/admin/imports` for compatibility.
- Leave a deeper Sources/Cleanup split for a later phase.

Update `frontend/src/admin/types.ts`:

- Add lifecycle fields to `AdminTender`.
- Add a cleanup endpoint response type.

Update `frontend/src/admin/api.ts`:

- Add `cleanupExpiredTenders({ clear_dce_cache })`.
- Continue using structured `ApiError`.

Update `frontend/src/admin/components/StatusBadge.tsx`:

- Add `DeadlineStateBadge`.
- Add `RetentionBadge` for active/manual archive/expired archive.
- Continue using icon plus text so status is not color-only.

Update `frontend/src/admin/pages/Dashboard.tsx`:

- Rename "Stale (past deadline)" to "Expired active".
- Link the metric to `/admin/tenders?deadline_state=expired&admin_status=active`.
- Use warning tone only when the queue is non-empty.

Update `frontend/src/admin/pages/Tenders.tsx`:

- Add `deadline_state` to URL-driven filters.
- Add a filter control with options: Any deadline, Expired, Open, Unknown.
- Show deadline as date plus `DeadlineStateBadge`.
- Show public visibility and retention state in the row, without making the table feel bloated.
- Add a page-level action: "Archive expired active".
- Confirm this action with a typed confirmation value: `ARCHIVE EXPIRED`.
- Offer an option in the dialog to clear outdated DCE cache at the same time.
- Update the flag action to collect and send `flag_note`.
- Keep selected-row batch actions for manual moderation.

## Interaction Rules

The admin UI should follow these rules:

- Common controls stay close to the data they affect.
- Bulk actions appear only after selection, with selected count visible.
- Reversible archive actions need confirmation and success feedback.
- Cleanup actions that affect many records require typed confirmation.
- Permanent deletion remains unavailable in this phase.
- Empty states distinguish "no tenders" from "no results for these filters".
- Failed cleanup/import operations show a concise operator-facing cause and a retry path where applicable.
- Tables remain keyboard accessible with labels on icon-only controls and checkboxes.

## Data Flow

1. Scraper runs and upserts tenders.
2. Each tender receives normalized lifecycle metadata.
3. Admin dashboard counts expired active tenders.
4. Operator opens the expired active queue from the dashboard.
5. Operator reviews/filter rows and triggers "Archive expired active".
6. Backend archives matching records, optionally clears outdated DCE cache, and audits the action.
7. Public and member surfaces stop showing archived tenders.
8. Operator can restore records if needed.

## Error Handling

- If cleanup matches zero records, return success with `archived=0` and show a neutral toast.
- If DCE cache cleanup fails after tender archive succeeds, keep the tender archive committed, return the archive counts plus a `dce_error` message, and show a warning toast for the cache failure.
- If the user lacks permission, backend returns 403 and the UI shows a denied state or disabled control explanation.
- If deadline parsing fails, the tender receives `deadline_state='unknown'` rather than being archived automatically.
- Scraper upsert failures are isolated per tender and recorded in the import warning/error path.

## Testing

Backend tests:

- `backend/test_admin.py`
  - Normalized expired active overview count.
  - `deadline_state` filter.
  - Cleanup endpoint archives only active expired rows.
  - Cleanup endpoint audits the action.
  - Permission enforcement for cleanup.
  - Manual archive and restore maintain lifecycle fields.
- `backend/test_tender_routes.py`
  - Archived tenders are excluded from public list/detail/export/download surfaces.
- `backend/test_dce_cache.py`
  - Outdated DCE cleanup uses normalized lifecycle fields.
- Scraper tests
  - Existing tenders are updated on re-scrape.
  - Manual archives are preserved.
  - Expired-deadline archives can be auto-restored only when a future deadline reappears.

Frontend tests:

- Dashboard expired-active metric links to the filtered queue.
- Tender deadline-state filter updates URL params and query calls.
- Cleanup dialog requires typed confirmation.
- Cleanup success/empty/partial outcomes render useful toasts.
- Flag action submits `flag_note`.

Verification commands:

```bash
cd backend && .venv/bin/python -m unittest test_admin.py test_tender_routes.py test_dce_cache.py
cd frontend && npm test -- --run
cd frontend && npm run build
```

## Sequencing

1. Add lifecycle helper, schema migrations, indexes, and backfill.
2. Fix admin overview and admin tender filtering/response fields.
3. Add cleanup endpoint and audit coverage.
4. Update public/member/alert visibility to exclude archived tenders.
5. Update scraper upsert and lifecycle reconciliation.
6. Update admin frontend types/API/badges.
7. Update dashboard and admin tenders UI.
8. Add focused tests and run backend/frontend verification.

## Open Follow-Up

Permanent purge should be designed separately after reversible cleanup is working. That phase must explicitly handle tender details, favorites, digest logs, audit logs, cached DCE files, legal traceability, and typed irreversible confirmation.
