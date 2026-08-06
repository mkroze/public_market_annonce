# Prompt: Build an Admin Space for MP Maroc

You are a senior full-stack engineer and product-minded UX designer. Build a production-quality admin space for MP Maroc, a full-stack dashboard for tracking Moroccan public procurement notices from `marchespublics.gov.ma`.

The existing application uses:

- Backend: Python, FastAPI, SQLite, scraper-based tender ingestion.
- Frontend: React, Vite, TypeScript, Tailwind CSS, daisyUI, lucide-react.
- Current core workflow: scrape/import tenders, browse/filter tender records, inspect statistics and tender details.

Base your admin work on the best practices documented in `admin_bp.md`. Treat the admin area as an operational control plane: safe, dense, auditable, permission-aware, and optimized for repeated use by operators and administrators.

## Primary Objective

Create an admin space that lets authorized operators manage the operational health and governance of the platform:

- Monitor and control tender data imports.
- Review tender records and detail-ingestion quality.
- Manage admin users, roles, and access.
- Inspect audit logs for important administrative and data operations.
- Manage system settings and integration credentials safely.
- Diagnose failures and recover from partial import or data-processing issues.

This is not a marketing page. The first screen of the admin area must be a usable operational dashboard, not a hero section or product overview.

## Non-Negotiable Principles

Follow these principles throughout the admin implementation:

- Least privilege first: design role and permission checks before exposing screens.
- MFA/SSO-ready: assume admin accounts require stronger authentication than normal users.
- Auditability: every sensitive action must produce an audit event.
- Safe mutation: destructive, bulk, privilege, export, impersonation, and integration actions require explicit confirmation.
- Dense but readable UI: admin users need scan-friendly operational layouts, not decorative cards or marketing composition.
- Accessibility: semantic HTML, keyboard navigation, visible focus states, WCAG AA contrast, and no color-only state communication.
- State preservation: search, filters, sorting, pagination, selected organization/context, and active nav state should be shareable or restorable when practical.
- Clear feedback: all async actions need loading, success, failure, retry, and partial-success states.
- Recovery over deletion: prefer disable, archive, revoke, suspend, restore, retry, and rollback patterns where possible.

## Recommended Admin Routes

Create a dedicated admin route group. Suggested routes:

- `/admin` - operational dashboard.
- `/admin/tenders` - administrative tender review and moderation table.
- `/admin/imports` - scrape/import control center and history.
- `/admin/users` - admin user management.
- `/admin/roles` - role and permission management.
- `/admin/audit-logs` - searchable audit event explorer.
- `/admin/settings` - system and data-retention settings.
- `/admin/integrations` - API keys, webhooks, email/digest providers, and external services.

If the current router structure suggests a different route shape, follow the existing pattern while keeping admin routes clearly separated.

## Admin Shell

Build a persistent admin shell with:

- Left side navigation for major admin destinations.
- Top bar with environment indicator, current admin identity, role label, and logout/profile entry.
- Global context controls where relevant, such as environment, dataset, region, or import source.
- Clear active-route state.
- Deep-linkable pages.
- Mobile fallback that remains usable, but optimize the primary layout for desktop/tablet admin work.

The admin shell should feel restrained, operational, and information-dense. Avoid large hero blocks, oversized headings, decorative illustrations, nested cards, and one-note color palettes.

## Roles and Permissions

Implement or design for role-based access control. At minimum, support these conceptual roles:

- `owner`: can manage roles, users, settings, integrations, and high-risk operations.
- `admin`: can manage tenders, imports, exports, and most operational settings.
- `operator`: can run imports, review records, retry jobs, and inspect non-sensitive logs.
- `auditor`: read-only access to admin data and audit logs.
- `support`: limited access to tender review and operational diagnostics.

Each admin route and each sensitive action should declare the permission it requires. If permission is missing:

- Hide controls that should not be discoverable.
- Disable controls that should be visible for context, with a clear explanation.
- Show a permission-aware error state for blocked pages.

Avoid making global administrator access the default path.

## Operational Dashboard

The `/admin` dashboard should prioritize exception queues and operational risk.

Include sections such as:

- Latest import status: queued, running, succeeded, failed, partial success.
- Data freshness: last successful scrape, last attempted scrape, tender count, detail coverage.
- Failure queues: failed import jobs, parsing errors, missing detail pages, stale records.
- Risk and governance: recent role changes, recent exports, recent destructive actions.
- System health: backend reachable, database reachable, scraper source reachable, email/digest status if applicable.

Every dashboard item must link to a filtered, actionable detail view. Metrics need freshness timestamps and source labels.

## Tender Administration

Build `/admin/tenders` as a high-quality data table. It should support:

- Search by title, reference, entity, local ID, source URL, location, and sector.
- Filters for category, sector, entity, location, status, deadline range, publication date, scraped date, detail availability, and data-quality status.
- Sortable columns.
- Pagination or infinite loading, depending on existing API conventions.
- Row selection and batch actions.
- Export where permitted.
- Row-level actions such as view details, open source portal, mark reviewed, retry detail fetch, archive, restore, or flag data issue.
- Clear empty states for no data, filtered-out results, failed loading, and permission denial.

Table requirements:

- Use stable row identifiers.
- Keep header and row density consistent.
- Avoid cramped modals for dense tender data.
- Use typed cells for dates, status, categories, source links, and quality indicators.
- Do not rely on color alone for status. Use labels/icons as well.

## Import Control Center

Build `/admin/imports` for scrape operations.

It should include:

- Manual import trigger with permission checks.
- Optional scoped import controls, such as category, sector, or limited test import, if backend support exists.
- Import history table with status, started time, finished time, duration, actor, records created, records skipped, records updated, warnings, and errors.
- Current running job panel if an import is active.
- Retry failed import where safe.
- View import log/details for each run.
- Partial-success reporting that lists failed sectors or records.

High-risk controls:

- Confirm before full refresh, destructive cleanup, or operations that could overwrite many records.
- Disable repeated submission while an import is already running unless concurrent imports are explicitly supported.
- Audit all import triggers, retries, cancellations, and cleanup actions.

## Users and Roles

Build `/admin/users` and `/admin/roles` around safe delegation.

User management should support:

- Invite admin user.
- View role, status, MFA status, last login, created date, invited by, and last activity.
- Suspend/deactivate rather than delete.
- Change role with confirmation.
- Force password reset or session revocation if supported.
- Filter by role, status, MFA state, and last activity.

Role management should support:

- List roles and permission summaries.
- Inspect permission details.
- Assign roles to users.
- Prevent accidental privilege escalation.
- Warn when assigning owner/global-level access.
- Show "last changed by" and "last changed at" context.

Audit every role assignment, role removal, invite, suspension, reactivation, and session revocation.

## Audit Logs

Build `/admin/audit-logs` as a first-class explorer, not a simple text log.

Log and display:

- Actor: user ID, email/name, role, session or request ID.
- Action: explicit event name.
- Target: resource type and ID.
- Timestamp with timezone.
- Result: success, failure, partial success, denied.
- Source context: IP/device when available, environment, route/API endpoint.
- Before/after values for important configuration and record mutations where appropriate.

The UI should support:

- Search.
- Filters by actor, action, target type, result, date range, severity, and route/source.
- Export with permission checks.
- Detail drawer/page for individual events.
- Links from record detail pages back to relevant audit history.

Access to audit logs should itself be permission-controlled and audited when exported.

## Settings

Build `/admin/settings` for operational configuration. Keep settings grouped and progressive:

- Scraper configuration: source URL, categories, sector mappings, timeout/retry policy, import limits if supported.
- Data policy: retention, archive behavior, export permissions.
- Notification policy: digest/email sender, alert recipients, import failure notifications if supported.
- Security policy: admin session duration, MFA requirement, allowed roles, export restrictions.

For each setting:

- Use visible labels and helper text.
- Validate near the field.
- Show unsaved changes.
- Confirm high-impact changes.
- Audit before/after values.
- Show last changed by and last changed time.

## Integrations

Build `/admin/integrations` for external-service governance.

Possible integrations include:

- Email or digest provider.
- Webhooks.
- Source portal/scraper endpoint configuration.
- Future API clients or service accounts.

Each integration should show:

- Name and type.
- Owner.
- Scope/permissions.
- Status.
- Created date.
- Last used date.
- Last rotated date if credentials exist.
- Revoke, rotate, disable, and test actions where appropriate.

Secrets must be copy-once and never revealed after creation. Credential creation, rotation, scope change, test, disable, and revocation must be audited.

## Data Model Guidance

If backend changes are needed, introduce focused tables or fields rather than overloading existing tender records.

Possible backend additions:

- `admin_users`: admin profile, role, status, MFA state or auth provider metadata if local auth exists.
- `admin_roles`: role definitions.
- `admin_permissions`: optional permission registry.
- `admin_audit_logs`: structured event log.
- `admin_import_jobs`: import runs, status, counts, warnings, errors, actor.
- `admin_settings`: key/value settings with changed metadata.
- `admin_integrations`: integration metadata, status, owner, scope, last used, rotation state.

Do not store raw secrets in SQLite. If credential support is implemented, use environment variables or an appropriate secret-management strategy for the deployment context.

## API Guidance

Prefer explicit admin endpoints under `/api/admin/...`.

Suggested endpoints:

- `GET /api/admin/overview`
- `GET /api/admin/tenders`
- `POST /api/admin/tenders/batch`
- `GET /api/admin/imports`
- `POST /api/admin/imports`
- `GET /api/admin/imports/{id}`
- `POST /api/admin/imports/{id}/retry`
- `GET /api/admin/users`
- `POST /api/admin/users/invite`
- `PATCH /api/admin/users/{id}`
- `GET /api/admin/roles`
- `PATCH /api/admin/users/{id}/role`
- `GET /api/admin/audit-logs`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- `GET /api/admin/integrations`
- `POST /api/admin/integrations`
- `PATCH /api/admin/integrations/{id}`

All admin endpoints should:

- Authenticate the user.
- Check permissions.
- Validate input.
- Return structured errors.
- Write audit logs for sensitive reads or any mutation.
- Handle partial success explicitly for batch operations.

## UI Behavior and States

For every admin page, implement:

- Loading state.
- Empty state.
- Filtered-empty state.
- Permission-denied state.
- Failed-load state with retry.
- Saving/pending mutation state.
- Success and failure feedback.
- Partial-success feedback for batch operations.

Use concise, literal UI copy. Examples:

- "Run import"
- "Retry failed sector"
- "Suspend user"
- "Assign role"
- "Export audit logs"
- "Disable integration"
- "Restore archived tender"

Avoid vague labels like "Submit", "OK", "Proceed", and "Manage" when the action can be named precisely.

## Confirmation Patterns

Use confirmation dialogs for:

- Suspending or reactivating admin users.
- Changing roles.
- Assigning owner-level access.
- Exporting sensitive data.
- Running full imports if they are expensive or state-changing.
- Cancelling or retrying jobs.
- Disabling integrations.
- Rotating or revoking credentials.
- Archiving, restoring, or deleting tender records.

Confirmations must include:

- Exact action.
- Target name or count.
- Expected consequence.
- Whether the action is reversible.
- Final action button with a specific label.

For highly sensitive actions, use step-up reauthentication or typed confirmation if the auth system supports it.

## Accessibility Requirements

Meet these requirements before considering the admin space complete:

- All interactive elements reachable by keyboard.
- Visible focus state on links, buttons, inputs, row actions, menus, tabs, pagination, and dialogs.
- Semantic table markup or accessible grid semantics.
- Dialog focus trap and focus return.
- Labels for all inputs.
- `aria-label` for icon-only buttons.
- No hover-only actions.
- Contrast meets WCAG AA.
- Status includes text, not only color.
- Motion respects `prefers-reduced-motion`.
- Table overflow is handled on small screens.

## Visual Direction

Use a restrained enterprise dashboard style:

- Dense layout with clear hierarchy.
- Neutral background with controlled accent colors.
- Status colors reserved for status, severity, and risk.
- Lucide icons for actions and navigation.
- Compact but legible typography.
- Cards only for individual repeated items, metric panels, detail panels, or modals. Do not put cards inside cards.
- No decorative gradient orbs, oversized hero art, bokeh effects, or marketing-style split hero sections.

The admin space should feel like a professional operations console for procurement data, not a landing page.

## Testing and Verification

Add or update tests proportional to the change.

Backend verification:

- Permission checks for admin endpoints.
- Audit log creation for mutations.
- Structured validation errors.
- Import-job status transitions.
- Batch-operation partial success behavior.

Frontend verification:

- Admin route rendering.
- Permission-aware controls.
- Table search/filter/sort/pagination behavior.
- Loading, empty, error, and denied states.
- Confirmation dialogs for high-risk actions.
- Keyboard interaction for primary workflows.

Before final delivery, run the relevant project commands:

- Backend tests, if backend behavior changed.
- Frontend build.
- Frontend lint, if available and currently configured.
- Manual or automated browser verification for the admin shell and key pages.

Report exactly what was verified and what remains unverified.

## Delivery Expectations

Deliver:

- Admin routes and shell.
- Working admin pages for the agreed scope.
- Backend endpoints and persistence needed for that scope.
- Permission and audit foundations.
- Clear empty/error/loading states.
- Accessible, dense, professional UI.
- Documentation of any assumptions or intentionally deferred work.

If scope must be reduced for a first iteration, prioritize:

1. Admin shell and route protection.
2. Import control center.
3. Tender administration table.
4. Audit logs.
5. Users and roles.
6. Settings and integrations.

Do not ship an admin area that can mutate important data without permission checks, audit events, and explicit high-risk confirmations.

