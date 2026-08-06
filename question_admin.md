# Open Questions for the Admin Space

These questions should be answered before implementation starts. If answers are not available, proceed with the stated default assumption and document it in the implementation notes.

## Product and Scope

1. Should the first admin version be a full admin console or an MVP limited to imports, tenders, and audit logs?
   - Default assumption: start with admin shell, import control center, tender administration, and audit logs.

2. Who are the expected admin users?
   - Default assumption: internal operators, product owners, support users, and read-only auditors.

3. Should the admin space be available only internally, or should customer organization admins also use it later?
   - Default assumption: internal-only for the first version.

## Authentication and Permissions

4. What authentication provider should admin users use: existing local auth, SSO, email/password, or another provider?
   - Default assumption: integrate with the current auth layer if present, but design permissions so SSO can be added later.

5. Is MFA required for all admin users from day one?
   - Default assumption: yes for production; allow a development bypass only through explicit environment configuration.

6. Which roles should exist in the first version?
   - Default assumption: owner, admin, operator, auditor, and support.

7. Should role and permission management be editable in the UI, or seeded/configured by developers at first?
   - Default assumption: seeded roles first, UI assignment second.

## Tender Operations

8. What administrative actions are allowed on tenders?
   - Default assumption: view, flag data issue, mark reviewed, retry detail fetch, archive, restore, and export where permitted.

9. Should admins be able to manually edit scraped tender fields?
   - Default assumption: no direct edits to scraped source fields in the first version; allow review flags and admin notes instead.

10. Should tender export include all fields, or should sensitive/internal fields be excluded by default?
   - Default assumption: exclude internal audit and system fields unless the user has export-sensitive permission.

## Import and Scraper Control

11. Should imports support scoped runs by category, sector, or date range?
   - Default assumption: support full import first, then add scoped imports if the backend scraper already supports it.

12. Should concurrent imports be blocked?
   - Default assumption: yes, block concurrent full imports.

13. Should failed import jobs be retryable from the UI?
   - Default assumption: yes, if the failure is not caused by configuration or upstream source unavailability.

14. What import logs should be visible in the UI?
   - Default assumption: status, duration, actor, counts, warnings, errors, failed sector/category, and request ID.

## Audit and Compliance

15. How long should audit logs be retained?
   - Default assumption: retain indefinitely in development and define production retention before launch.

16. Who can export audit logs?
   - Default assumption: owner and auditor only.

17. Should audit logs include IP address and device/session metadata?
   - Default assumption: include if available from the request context.

18. Are there legal or privacy constraints for storing admin action history?
   - Default assumption: keep structured operational audit data, avoid storing secrets or unnecessary personal data.

## Settings and Integrations

19. Which settings are safe to edit from the admin UI?
   - Default assumption: start read-only for scraper/source configuration, then allow controlled edits after permission and audit flows exist.

20. Which integrations exist or are planned?
   - Default assumption: email/digest provider and future webhook/API clients.

21. Should API keys or service accounts be part of the first version?
   - Default assumption: not unless required; design the navigation and data model so they can be added later.

## UI and Localization

22. What language should the admin space use: English, French, Arabic, or multilingual?
   - Default assumption: English for technical admin labels unless the existing product language direction requires French.

23. Should the admin UI support right-to-left layouts for Arabic?
   - Default assumption: not in the first version unless Arabic is selected as a required admin language.

24. What visual relationship should the admin space have with the public-facing app?
   - Default assumption: reuse existing Tailwind/daisyUI foundations, but make the admin area denser and more operational.

## Deployment and Environment

25. Should production, staging, and development environments be visually distinguished?
   - Default assumption: yes, always show an environment indicator in the admin shell.

26. Are there deployment constraints around SQLite, background jobs, or long-running scraper operations?
   - Default assumption: keep the first version compatible with the current FastAPI plus SQLite deployment, but isolate import-job state for future migration.

27. Should the admin space support organization or tenant separation?
   - Default assumption: not for the first version unless the product already has multi-tenant accounts.

