# Frontend Design

This document describes the current frontend architecture, UI model, and design conventions for the Marches Publics Maroc application. It is based on the code in `frontend/src` and should be updated when routes, layout primitives, API contracts, or core interaction patterns change.

## Product Shape

The frontend is a React/Vite application for discovering, reviewing, exporting, and monitoring Moroccan public tender opportunities. The public application is optimized for registered users who need to scan tender opportunities quickly, compare urgency and fit, then open a detail page for a bid/no-bid decision.

The codebase also contains a separate admin surface for operations work: imports, tender management, audit logs, users, roles, and future settings/integrations.

## Stack

- React 19 with TypeScript.
- React Router 7 for route composition.
- Vite 8 for local development and production builds.
- Tailwind CSS 4 and daisyUI 5 for utility styling and component primitives.
- Lucide React for icons.
- Browser `fetch` for API calls through the `/api` backend prefix.

The frontend has no global state library. Cross-route session state lives in `AuthProvider`; page-specific data and UI state stay local to each page component.

## Application Shell

`src/App.tsx` owns top-level route composition:

- Public routes render inside `PublicLayout`.
- Admin routes render inside a lazy-loaded `AdminApp` bundle behind `AdminGuard`.
- `AuthProvider` wraps both public and admin route trees.
- `RequireAuth` protects tender browsing, tender details, and alerts.
- The public layout includes skip-link accessibility, `Navbar`, a constrained main region, and `Footer`.

The public routes are:

- `/login`
- `/register`
- `/tenders`
- `/tenders/:id`
- `/alerts`
- `/about`
- `/contact`
- `/faq`
- `/legal/mentions-legales`
- `/legal/confidentialite`
- `/legal/conditions`
- `/legal/cookies`
- `/` redirects to `/tenders`
- unknown public paths redirect to `/tenders`

The admin routes are nested under `/admin/*` and include dashboard, imports, tenders, audit logs, users, roles, settings, and integrations.

## Public Navigation

`src/components/Navbar.tsx` is the public navigation component. It owns:

- Brand/logo link to `/tenders`.
- Primary navigation links.
- Light/dark theme toggle persisted to `localStorage`.
- Authenticated user dropdown and logout.
- Mobile dropdown navigation.

The navbar should stay compact and task-oriented. Primary public navigation should prioritize the active work surfaces (`/tenders`, `/alerts`) over informational pages. Informational pages can remain reachable from footer links or direct URLs.

## Theme And Styling

`src/index.css` defines the design system. The public application uses an institutional blue palette:

- `--color-primary`: primary action and active state.
- `--color-primary-soft`: selected backgrounds.
- `--color-surface`, `--color-surface-muted`, `--color-surface-raised`: page and panel surfaces.
- `--color-ink`, `--color-muted`: primary and secondary text.
- `--color-border`, `--color-border-subtle`: structural borders.
- `--color-warning`, `--color-success`, `--color-danger`: status semantics.

The file also preserves older alias tokens (`--color-ivory`, `--color-crimson`, `--color-charcoal`, etc.) so existing components can continue to render while the institutional palette is active.

The admin root uses `data-theme="academic"` and intentionally retains the editorial cream/black admin palette through scoped CSS. Do not assume public and admin visual tokens are interchangeable.

Reusable visual primitives:

- `.institutional-page`: public palette scope.
- `.institutional-panel`: bordered panel/card surface.
- `.font-display`, `.font-sans`: font roles.
- `.editorial-label`, `.label-academic`: compact label styles.

## Page Design

### Tenders Page

`src/pages/Tenders.tsx` is the main workbench for tender discovery.

Responsibilities:

- Read filters from URL search params.
- Fetch paginated tenders via `getTenders`.
- Show page summary tiles for visible, active, urgent, and expired tenders.
- Provide guided and expert views.
- Provide status segmentation: active, urgent, expired, all.
- Render `FilterBar`, `ExportDropdown`, `Pagination`, `ToastContainer`.
- Export filtered data through `exportTenders`.

The guided tender view uses `TenderCard` for decision-friendly scanning. The expert view uses `TenderTable` for dense sorting and comparison.

Responsive layout rules:

- Summary tiles are two columns on phone and four columns on desktop.
- Guided tender cards are one column on phone and four columns on desktop.
- Tables should remain in the expert view and must not create page-level horizontal overflow.

### Tender Detail Page

`src/pages/TenderDetail.tsx` is a decision page, not a raw data dump.

Responsibilities:

- Decode route-safe tender ids.
- Fetch a single tender via `getTender`.
- Display normalized values from `display`, `signals`, and raw `details`.
- Highlight deadline, budget, caution, DCE availability, applications, and market price.
- Render decision checklist guidance from `getTenderDecisionChecklist`.
- Support DCE download, PDF export, original notice link, and original portal link.
- Show source/confidence labels where detected values require verification.

The page should keep the first viewport focused on the decision: what this tender is, who buys, where it applies, when it closes, and which signals require verification.

### Alerts Page

`src/pages/Alerts.tsx` manages saved alert preferences.

Responsibilities:

- Fetch existing alerts and filter options.
- Create, edit, toggle, and delete alert preferences.
- Preview matching tenders while editing criteria.
- Send a test alert email.
- Use toasts for user feedback.

Alert criteria are stored as CSV strings for sectors, regions, and keywords to match the backend contract.

### Auth Pages

`src/pages/Login.tsx` and `src/pages/Register.tsx` use `AuthProvider` through `setAuth` and redirect authenticated users into protected workflows. Auth tokens are stored in `localStorage`.

If a protected API request returns `401`, `src/lib/api.ts` clears the token and redirects to `/login`.

### Content And Legal Pages

`About`, `Contact`, `Faq`, and legal pages are public informational routes. They should not block the procurement workflow, and they should avoid adding heavy dependencies or new global state.

## Components

Core public components:

- `Navbar`: public top navigation, theme toggle, auth controls.
- `Footer`: secondary navigation and legal/content links.
- `Breadcrumbs`: location trail with `/tenders` as home.
- `FilterBar`: tender filtering controls.
- `TenderCard`: guided tender card for scannable opportunity review.
- `TenderTable`: expert tender table with sorting.
- `Pagination`: paginated list navigation.
- `ExportDropdown`: CSV/Excel/JSON export action.
- `Toast`: transient feedback.
- `LegalAssistantSidebar`, `LegalTooltip`, `ComplianceChecklist`, `MoroccoMap`: supporting domain UI.

Component guidelines:

- Keep shared components presentation-focused.
- Keep page-owned data fetching in page components unless multiple routes need the same orchestration.
- Prefer URL state for filters, sorting, pagination, and view mode.
- Use Lucide icons for actions and navigation.
- Use buttons for commands and links for navigation.
- Preserve focus states and accessible labels for icon-only controls.

## Data And API Boundary

`src/lib/api.ts` is the API boundary for public pages. It wraps `/api` endpoints and exports typed functions for:

- Tenders: list, detail, export, DCE download, PDF download.
- Filters, overview, stats.
- Auth: login, register, current user.
- Geography and sectors.
- Favorites.
- Alerts: list, create, update, delete, preview, test email.
- Legal assistant.
- Blog.

`src/lib/types.ts` defines frontend-facing TypeScript contracts. Keep API return shapes there instead of redefining ad hoc types in pages.

URL-sensitive tender ids must go through the route helpers in `src/lib/tenderUtils.ts`.

## Domain Helpers

Domain logic lives under `src/lib`:

- `tenderGuidance.ts`: bid-decision labels and checklist guidance.
- `tenderUtils.ts`: tender paths, id encoding/decoding, urgency calculation.
- `displayValues.ts`: normalized display values, status, source, confidence.
- `tone.ts`: tone-to-class mappings for badges/panels.
- `compliance.ts`, `procedures.ts`, `partners.ts`: domain-specific static logic and mappings.

Pages should consume these helpers rather than duplicating tender interpretation rules.

## Admin Design

The admin bundle lives under `src/admin`.

Design principles:

- Keep admin visually separate from the public institutional surface.
- Use a left sidebar on desktop and a modal drawer on mobile.
- Gate routes through permissions in `permissions.ts`.
- Use admin-specific API and type modules.
- Use small, reusable admin primitives from `admin/components`.

`AdminLayout` owns admin navigation, environment badge, user identity display, and logout.

## Accessibility

Baseline expectations:

- Public layout includes a skip link to `#main-content`.
- Icon-only buttons need `aria-label` and, where useful, `title`.
- Navigation regions should have descriptive labels.
- Interactive elements must retain visible focus states.
- Route links should use `Link`/`NavLink`; commands should use `button`.
- Loading, empty, and error states must be present for fetch-driven pages.
- Color should not be the only way to communicate state; pair tone with text labels.

## Responsive Rules

The app is mobile-first:

- Start with a single-column reading flow unless the component is intentionally compact.
- Use Tailwind breakpoints to progressively add density.
- Avoid fixed pixel widths that can overflow small screens.
- Keep buttons and menu items touch-friendly.
- Do not introduce page-level horizontal scrolling.
- Dense comparison belongs in table/expert mode, not in the default guided mobile experience.

Current important layout rules:

- Public main width: `max-w-[1440px]`.
- Tender detail width: `max-w-4xl`.
- Admin main width: `max-w-[1400px]`.
- Tender summary tiles: `grid-cols-2 lg:grid-cols-4`.
- Tender guided cards: `grid-cols-1 lg:grid-cols-4`.

## Error And Feedback Patterns

- Fetch failures should render an inline error state with a retry action when appropriate.
- Mutations should show toast feedback for success and failure.
- Long actions such as exports, DCE download, PDF export, preview, and test email should expose loading state.
- Empty states should distinguish between no data and no matches after filters.

## Build And Verification

Frontend commands:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

From the repository root, public development usually runs through the root scripts, while frontend-only validation runs in `frontend`.

Before shipping frontend changes:

- Run `npm run build` in `frontend`.
- Run targeted checks for any changed layout or route behavior.
- Inspect responsive behavior for `/tenders`, `/tenders/:id`, `/alerts`, and auth pages when layout changes.
- Ensure no unrelated dirty files are accidentally included in commits.

## Change Guidelines

- Keep route-level behavior in pages and reusable rendering in components.
- Keep API shape changes centralized in `lib/api.ts` and `lib/types.ts`.
- Prefer existing tokens and classes over raw colors.
- Avoid broad visual rewrites when solving a local layout issue.
- Preserve admin/public theme isolation.
- Update this document when adding a page, changing the shell, changing responsive rules, or changing the API boundary.
