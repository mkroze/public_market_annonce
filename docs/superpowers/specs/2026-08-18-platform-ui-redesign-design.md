# Platform UI Redesign

Date: 2026-08-18

## Context

The project already has a React/Vite frontend with public content pages, authentication pages, authenticated tender discovery, tender detail, alerts, and an isolated admin area. The new `design/` folder provides the target visual direction:

- `design/maghreb_public_procurement_interface/DESIGN.md`
- `design/tender_dashboard/`
- `design/d_tails_de_l_appel_d_offres_pc/`
- `design/espace_membre_pc/`
- `design/espace_membre_mobile/`

The redesign should be inspired by these references, not copied literally. It should cover the user-facing pages that already exist in the app and preserve current API contracts and route behavior.

## Goals

- Replace the current warm academic styling with a compact institutional procurement interface.
- Use one shared design system across the public/member frontend.
- Promote alerts into the primary navigation with a bell icon that links to `/alerts`.
- Rearrange the alerts page as a notification center.
- Improve responsive behavior for tender lists, tender detail, auth pages, and content pages.
- Keep backend behavior, API calls, data shapes, and protected-route logic unchanged.

## Non-Goals

- Redesigning the isolated `/admin` app in this pass.
- Adding new backend alert features or notification counts.
- Copying static HTML from `design/` directly into React.
- Introducing new routing concepts beyond the current pages.
- Replacing lucide icons with Material Symbols.

## Visual System

The UI will use the `DESIGN.md` direction as the source of truth:

- Primary action and active navigation: deep institutional blue.
- Page background: light blue-gray surface.
- Panels and cards: white surfaces with 1px low-contrast borders.
- Urgency and deadlines: amber accent, reserved for time-sensitive states.
- Success/open states: green tint.
- Error states: red tint with accessible contrast.
- Typography: Inter/system sans, compact 14px default body, clear 20-30px page headings.
- Geometry: 4px controls, 8px panels/cards, pill badges for statuses.
- Depth: borders and tonal layers first; subtle shadows only for menus/modals.

Existing custom token names such as `--color-crimson` should be rationalized where practical so blue is not represented by a red semantic name. If a full rename causes excessive churn, compatibility aliases may remain during implementation, but new styles should use procurement-specific token names.

## Shared Shell

`Navbar` and `PublicLayout` will become the main user-facing app shell.

Desktop:

- Sticky top app bar with logo/brand, core navigation, alerts bell, and account menu.
- Tender discovery remains the primary destination.
- `/alerts` appears as a visible bell action in the header, not only inside the account dropdown.
- Authenticated account controls remain available through a compact menu.
- Public links such as About, FAQ, and Contact stay available without dominating the working UI.

Mobile:

- Compact sticky brand bar.
- Bell icon remains visible for authenticated users and links to `/alerts`.
- Navigation remains reachable from a menu.
- Touch targets must be at least 44px high/wide where practical.

The main content area should use the institutional page background and a max width suitable for dense procurement workflows.

## Page Designs

### Tenders

The tender discovery page will become a dense procurement dashboard/list view:

- Page header with title, result count, and export action.
- Compact status summary tiles inspired by the reference dashboard, including active/urgent/expired counts where data is available locally.
- Search and filter controls styled as institutional controls with clear borders and focus rings.
- Status tabs use blue active underline or filled state.
- Guided mode remains card-based and should resemble the mobile tender card reference.
- Expert mode remains table-based with sticky-feeling dense rows, uppercase headers, zebra or hover row affordance, tabular numeric values, and clear deadline urgency.
- Empty, loading, and error states keep the same behavior but adopt the new panel style.

### Tender Detail

The tender detail page will be reorganized around the desktop detail reference:

- Header with status/category badges, reference, title, buyer, location, and deadline.
- Summary metric cards for buyer, budget, caution, DCE availability, candidatures, and price signals.
- A timeline or process strip for publication, site visit/opening, and deadline when data exists.
- A right-side actions panel on desktop for DCE/PDF/source actions and metadata.
- Actions stack naturally below the header on mobile.
- Existing decision checklist, addresses, contacts, and source/detail sections remain, but visual hierarchy should be tightened into bordered panels and tabs/sections where useful.

### Alerts

The alerts page will become a notification center:

- Header includes bell icon, alert count, active count, and primary create action.
- Existing alert preferences list becomes the main left/primary area.
- Alert cards show enabled state, frequency, sectors/regions/keywords, budget range, and quick actions.
- Editor appears as a structured panel for create/edit.
- Live preview remains visible as a supporting panel, with loading and empty states.
- Test email action remains available and visually secondary.
- The navbar bell links directly to this page.

### Authentication

Login and register pages will be restyled to match the institutional platform:

- Centered white bordered panels on the blue-gray background.
- Brand-led header treatment.
- Same controls, validation/error behavior, and redirects as today.
- Accessible labels, visible focus, and password visibility controls remain.

### Public Content Pages

About, FAQ, Contact, and legal pages will use the same token system:

- Bordered content panels where appropriate.
- Less editorial warmth, more institutional document styling.
- Existing copy and routes remain unchanged.

## Components

Shared components to update:

- `Navbar`: app shell, visible alerts bell, account dropdown, mobile menu.
- `PageShell`: institutional content page layout.
- `FilterBar`: compact search, filter chips, and advanced panel styling.
- `TenderCard`: mobile/guided card style based on the reference.
- `TenderTable`: dense table styling and deadline/status affordances.
- `ExportDropdown`, `Pagination`, `Toast`, `Breadcrumbs`: token alignment and focus/hover polish.

New small helper components may be introduced only when they reduce duplication across pages, such as metric cards, status badges, or page section panels.

## Accessibility and Interaction

- Maintain semantic buttons/links for all interactive controls.
- Icon-only controls must have accessible labels.
- Focus states must be visible and use the primary blue ring.
- Text contrast must meet WCAG AA for normal text.
- Hover and transition effects should be subtle and disabled/reduced under `prefers-reduced-motion`.
- Mobile layouts must avoid horizontal page scroll; tables may remain horizontally scrollable inside their container.

## Data Flow

No data contracts change.

- `Tenders` continues to use `getTenders`, `exportTenders`, URL search params, view mode, and existing filters.
- `TenderDetail` continues to use `getTender`, `downloadDce`, `downloadPdf`, decoded route IDs, display signals, and decision checklist helpers.
- `Alerts` continues to use `getAlerts`, `getFilters`, create/update/delete, preview, and test email calls.
- Auth pages continue to use current login/register and auth provider flow.

## Testing and Verification

Implementation should verify:

- `npm run build` from `frontend/`.
- `npm run lint` from `frontend/` if the current lint setup is functional.
- Manual or screenshot checks at 375px, 768px, 1024px, and desktop width.
- Routes: `/login`, `/register`, `/tenders`, `/tenders/:id`, `/alerts`, `/about`, `/faq`, `/contact`.
- Keyboard access for navbar, filters, account menu, alert editor, and tender actions.
- The alerts bell is visible in the navbar and links to `/alerts`.

## Implementation Order

1. Update global tokens and base component styling.
2. Rebuild shared shell and navbar with the alerts bell.
3. Restyle tender discovery components and page.
4. Reorganize tender detail layout.
5. Rearrange alerts page.
6. Align auth and public content pages.
7. Run verification and fix responsive/accessibility regressions.

## Self-Review

- No placeholder requirements remain.
- Scope is limited to existing user-facing frontend pages and shared components.
- `/admin` is explicitly out of scope for this pass.
- Alerts bell behavior is explicit: visible in navbar and links to `/alerts`.
- Data/API behavior remains unchanged.
- The spec allows compatibility aliases for existing CSS tokens while steering new work to institutional names.
