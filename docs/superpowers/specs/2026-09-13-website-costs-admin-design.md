# Website Costs Admin Design

Date: 2026-09-13
Status: Draft for user review

## Purpose

The website is moving toward paid features, API usage, AI-assisted bid preparation, email delivery, cached DCE documents, and production deployment. These services create recurring and usage-based expenses that should be visible from the admin panel before they become hard to track.

This design adds a dedicated admin cost ledger for internal website expenses only. It is not a customer billing, invoicing, subscription, payment, or entitlement system.

## Current State

The admin space already has a flat sidebar, role-based access control, audit logs, settings, imports, users, roles, and operational dashboards. Backend admin APIs live under `/api/admin` and enforce permissions server-side through `require_admin`. The frontend mirrors those permissions only to hide or disable UI affordances.

The app already stores admin-editable SMTP settings in `app_settings`, but secrets are handled as write-only values. That pattern should remain separate from cost tracking: API keys and SMTP passwords do not belong in the cost ledger.

Existing product and payment notes recommend manual invoice-based customer activation later, but this feature intentionally tracks only the platform owner's operating costs.

## Goals

- Give owners/admins a clear list of website expenses from the admin panel.
- Track recurring, usage-based, and one-off costs for providers such as hosting, domains, email, AI APIs, storage, monitoring, proxies, and software tools.
- Show monthly and upcoming-cost summaries so the operator can understand burn rate quickly.
- Keep secrets out of the expense records.
- Audit create, update, status-change, and archive actions.
- Use narrow RBAC permissions instead of reusing broad settings permissions.

## Non-Goals

- No customer invoices.
- No customer payments.
- No subscriptions or entitlements.
- No payment processor integration.
- No API-key storage.
- No automatic provider API synchronization in v1.
- No accounting-grade tax declaration workflow.
- No permanent deletion of expense history.

## Selected Approach

Build a dedicated admin page at `/admin/costs` named "Costs". This page is a manual operating-expense ledger with summary cards, filters, a table, and create/edit/status actions.

The label "Costs" is deliberate. It avoids confusion with future customer-facing billing, invoices, payments, and subscriptions. Later customer monetization work can own `/admin/billing` or `/admin/subscriptions` without colliding with this feature.

## Permissions

Add two admin permissions:

- `costs.view`
- `costs.manage`

Role access:

- `owner`: view and manage
- `admin`: view and manage
- `auditor`: view only
- `operator`: no access
- `support`: no access

The backend remains the source of truth. The frontend mirrors this matrix only for navigation visibility and disabled-control explanations.

## Data Model

Add a `website_costs` table:

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `provider TEXT NOT NULL`
- `category TEXT NOT NULL`
- `description TEXT NOT NULL DEFAULT ''`
- `amount_minor INTEGER NOT NULL`
- `currency TEXT NOT NULL DEFAULT 'MAD'`
- `billing_cycle TEXT NOT NULL`
- `service_period_start TEXT`
- `service_period_end TEXT`
- `due_date TEXT`
- `paid_date TEXT`
- `status TEXT NOT NULL DEFAULT 'planned'`
- `reference TEXT NOT NULL DEFAULT ''`
- `notes TEXT NOT NULL DEFAULT ''`
- `created_at TEXT DEFAULT (datetime('now'))`
- `updated_at TEXT DEFAULT (datetime('now'))`
- `created_by TEXT`
- `updated_by TEXT`
- `archived_at TEXT`

Allowed `category` values:

- `hosting`
- `domain`
- `email`
- `ai_api`
- `storage`
- `monitoring`
- `scraping`
- `software`
- `other`

Allowed `billing_cycle` values:

- `monthly`
- `yearly`
- `one_off`
- `usage_based`

Allowed `status` values:

- `planned`
- `due`
- `paid`
- `overdue`
- `cancelled`

Store money as integer minor units, for example cents/santimat, not floating point. The UI can format values as decimal currency, but the API and database should preserve integer precision.

Currencies allowed in v1:

- `MAD`
- `USD`
- `EUR`

No exchange-rate conversion is required in v1. Summary totals group by currency instead of inventing inaccurate conversions.

## Backend API Design

Add endpoints under `/api/admin/costs`.

`GET /api/admin/costs/summary`

- Requires `costs.view`.
- Returns current-month totals grouped by currency. A record belongs to the current month when its service period overlaps the current calendar month; if no service period is set, use `due_date`; if no due date is set, use `created_at`.
- Returns unpaid upcoming totals grouped by currency for records with `status IN ('planned', 'due', 'overdue')` and `due_date` in the next 45 days.
- Returns overdue totals grouped by currency for records with `status='overdue'` or unpaid records whose `due_date < date('now')`.
- Returns annualized recurring totals grouped by currency based on active monthly and yearly records.
- Returns the largest current-month category per currency when available.

`GET /api/admin/costs`

- Requires `costs.view`.
- Supports filters: `q`, `provider`, `category`, `status`, `currency`, `date_from`, `date_to`, `page`, `per_page`.
- Excludes archived rows by default.
- Returns paginated rows ordered by newest due/service date first.

`POST /api/admin/costs`

- Requires `costs.manage`.
- Validates allowed enums, required provider/category/amount/currency/cycle/status values, and ISO date strings when present.
- Inserts a row with `created_by` and `updated_by`.
- Writes audit action `cost.create`.

`PATCH /api/admin/costs/{cost_id}`

- Requires `costs.manage`.
- Validates the same fields as create.
- Updates `updated_at` and `updated_by`.
- Writes audit action `cost.update` with before/after JSON.

`POST /api/admin/costs/{cost_id}/mark-paid`

- Requires `costs.manage`.
- Sets `status='paid'` and `paid_date` to the provided date or `date('now')`.
- Writes audit action `cost.mark_paid`.

`POST /api/admin/costs/{cost_id}/archive`

- Requires `costs.manage`.
- Sets `archived_at=datetime('now')`.
- Does not permanently delete the row.
- Writes audit action `cost.archive`.

## Frontend Design

Add a new admin route:

- `/admin/costs`

Add a sidebar item:

- Label: `Costs`
- Icon: `Receipt` from `lucide-react`
- Permission: `costs.view`

The page should follow the existing admin style: restrained operational UI, summary cards, filters, and a dense table. It should not look like a marketing pricing page.

Top summary cards:

- Current month total, grouped by currency.
- Upcoming unpaid amount, grouped by currency.
- Overdue amount, grouped by currency.
- Annualized recurring estimate, grouped by currency.

Filters:

- Search provider/description/reference.
- Category.
- Status.
- Currency.
- Date range.

Table columns:

- Provider
- Category
- Description
- Amount
- Cycle
- Service period or due date
- Status
- Reference
- Updated by/date
- Actions

Actions:

- Add cost.
- Edit cost.
- Mark as paid.
- Archive.

Create/edit should use a modal or drawer so operators stay in context. Use select controls for enum fields, date inputs for dates, and numeric input for amount. Validate client-side for basic ergonomics, but rely on backend validation for correctness.

## Interaction Rules

- Do not ask admins to enter or paste API keys into this page.
- Use clear status badges that are not color-only.
- Keep destructive actions reversible by archiving rather than deleting.
- Disable management buttons for read-only users with tooltips explaining the missing permission.
- Preserve filters in the URL so admin views are shareable/bookmarkable.
- Empty states should distinguish no expenses recorded from no expenses matching filters.
- Use French professional copy where visible to product users, but admin operational labels may continue matching the current English admin style unless the wider admin space is localized later.

## Data Flow

1. Admin opens `/admin/costs`.
2. Frontend loads summary and paginated cost rows.
3. Admin creates or edits a cost record.
4. Backend validates, writes the row, and records an audit event.
5. Frontend refreshes summary and table.
6. Dashboard integration can later surface the monthly total and overdue amount.

## Error Handling

- Missing authentication returns 401.
- Missing permission returns 403 and the UI shows the existing denied state.
- Invalid enum values return 422 with a concise field-level message.
- Negative or zero amounts return 422.
- Invalid dates return 422.
- Updating, marking paid, or archiving a missing record returns 404.
- Summary endpoints return empty grouped totals instead of errors when there are no costs.

## Testing

Backend tests:

- Database initialization creates `website_costs` and indexes.
- `costs.view` and `costs.manage` are enforced.
- Owner/admin can create, update, mark paid, and archive costs.
- Auditor can view but cannot mutate costs.
- Operator/support cannot view costs.
- Invalid enum, invalid date, and non-positive amount are rejected.
- List filters and pagination work.
- Summary totals group by currency and exclude archived rows.
- Mutations write audit logs with redacted, non-secret before/after JSON.

Frontend tests:

- Costs nav item is visible only to roles with `costs.view`.
- Costs page renders summary cards, filters, rows, and empty states.
- Read-only users can view rows but cannot mutate them.
- Add/edit form sends integer minor-unit values to the API.
- Mark-paid and archive actions refresh summary and list state.

## Deployment Notes

This feature can ship before payment monetization and before API-provider integrations. It gives immediate operational value with manual entry while keeping future automation possible.

Provider API imports should be treated as a later phase after the team knows which expenses are frequent enough to justify integration. If automatic imports are added later, they should create or reconcile cost records without storing provider secrets in `website_costs`.
