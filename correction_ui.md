# UI Correction Audit

Source screenshots: `screenshots/roast_style_audit/`

Tone for Claude: mildly roast-y, but useful. The UI is not broken; it is just carrying a few design-system sins in broad daylight.

## Scope

Audit the visible UI only: spacing, hierarchy, alignment, contrast, component consistency, density, empty states, and responsive risk inferred from the desktop screenshots.

Do not change backend behavior, routing, auth logic, copy strategy, data loading, or feature scope unless a visual correction directly requires it.

## Highest Priority Fixes

### 1. Unify the Public and Admin Design Language

Evidence:
- `screenshots/roast_style_audit/03-tenders-catalog.png`
- `screenshots/roast_style_audit/12-admin-dashboard.png`
- `screenshots/roast_style_audit/18-admin-settings.png`

The public app is blue, airy, rounded, and polished. The admin app is beige, dense, square, and almost from another product. Admin can be utilitarian, but it should not look like it came from a different vendor.

Corrections:
- Keep admin dense, but bring in the same brand navy/blue accent system used publicly.
- Replace the beige admin canvas with a cleaner neutral background closer to the public shell.
- Standardize card borders, radii, shadows, and focus rings across public/admin.
- Make status chips consistent: same radius, same font size, same border weight, same capitalization logic.
- Sidebar selected state should use the product accent, not a nearly black slab that visually overpowers the page.

### 2. Fix the Card Addiction

Evidence:
- `screenshots/roast_style_audit/05-about.png`
- `screenshots/roast_style_audit/06-contact.png`
- `screenshots/roast_style_audit/07-faq.png`
- `screenshots/roast_style_audit/08-legal-notice.png`

Several public pages put a card inside a page that already feels like a carded surface. Contact goes further and puts a form card inside another card. This makes the UI look cautious rather than confident.

Corrections:
- Use cards for repeated items, forms, or distinct tool surfaces only.
- For static prose pages, use an article layout instead of giant bordered panels.
- Remove nested cards from Contact; use one surface with a two-column grid.
- Keep the hero/intro block distinct, but make the main content below feel like structured content, not another framed box.
- If a bordered surface remains, make its width intentional and align it with the content grid.

### 3. Use Desktop Width Intentionally

Evidence:
- `screenshots/roast_style_audit/05-about.png`
- `screenshots/roast_style_audit/08-legal-notice.png`
- `screenshots/roast_style_audit/09-privacy.png`
- `screenshots/roast_style_audit/10-terms.png`

Many content pages occupy the left 60% of a 1440px viewport while the right side is empty. Empty space is fine; accidental-looking empty space is not.

Corrections:
- Either center article content with a deliberate readable width, or add a right rail for section navigation/meta links.
- Align all public content pages to the same max-width rule.
- Legal pages should use a prose max width, probably `72ch` to `84ch`, centered or paired with a sticky mini table of contents.
- Avoid half-width cards that stop abruptly while the rest of the viewport does nothing.

### 4. Improve Empty States

Evidence:
- `screenshots/roast_style_audit/03-tenders-catalog.png`
- `screenshots/roast_style_audit/04-alerts.png`
- `screenshots/roast_style_audit/13-admin-imports.png`
- `screenshots/roast_style_audit/14-admin-tenders.png`
- `screenshots/roast_style_audit/15-admin-audit-logs.png`
- `screenshots/roast_style_audit/19-admin-integrations.png`

The empty states are technically present, but many are visually too passive. Some are oversized for tiny content; others are so pale they feel like placeholders left in production.

Corrections:
- Give empty states a consistent component: icon, title, explanation, optional action.
- Reduce vertical height where the content is simple.
- Use stronger title contrast and slightly softer body text, not two equally quiet lines.
- In public catalog empty state, hide or collapse advanced filters when there are zero total tenders; showing a full control cockpit for no data feels like opening a restaurant menu in an empty kitchen.
- In admin empty states, keep the box aligned with the filter/table area and avoid huge blank panels unless loading skeletons are expected.

### 5. Tighten Navigation and Brand Chrome

Evidence:
- `screenshots/roast_style_audit/01-login.png`
- `screenshots/roast_style_audit/03-tenders-catalog.png`
- `screenshots/roast_style_audit/12-admin-dashboard.png`

The top nav is clean, but the tiny standalone mark on the far left feels under-scaled compared with the large branded login panel and the footer mark. The admin sidebar similarly uses text identity only.

Corrections:
- Use a consistent logo treatment across navbar, footer, login, and admin.
- Increase the public navbar mark slightly or pair it with compact wordmark text on desktop.
- Keep active nav pills consistent between public routes.
- The theme/motion icon button in the top right is visually mysterious; ensure hover/focus label or a clearer icon state.
- In admin, use a compact brand lockup rather than plain `MP Maroc Admin`.

## Page-Level Corrections

### Login

Evidence: `screenshots/roast_style_audit/01-login.png`

What works:
- Strong split layout.
- Good brand presence.
- Form is readable.

Corrections:
- The form card sits a little too far right and feels detached from the blue brand slab. Pull the columns closer or reduce the empty center gap.
- The diagonal edge is dramatic but visually heavy; make sure it does not dominate on medium desktop widths.
- The form card and outer page card both have borders/shadows; reduce one layer.
- Navbar logo is too small next to this much brand theatre.

### Register

Evidence: `screenshots/roast_style_audit/02-register.png`

This screen looks like login's older sibling who refused the redesign.

Corrections:
- Match the login page composition or create a simpler sibling layout using the same brand system.
- Remove the old centered-card-only feeling.
- Align vertical spacing with login: intro, form title, field rhythm, CTA, secondary link.
- The breadcrumb row floats far above the form; either integrate it into the page header rhythm or remove it for auth pages.

### Catalog / Consultations

Evidence: `screenshots/roast_style_audit/03-tenders-catalog.png`

Corrections:
- The zero-data state should not show stats cards, explainer band, filter tabs, search, sort, active chips, and empty state all at once.
- Make the empty catalog page calmer: page title, concise empty state, maybe one disabled/secondary action.
- The search/filter block has too many horizontal rules and stacked controls; reduce border noise.
- The `Filtres + 1` row feels cramped and slightly misaligned with the search field above.
- The orange reset control is visually louder than it deserves.
- The stats cards all showing `0` should be hidden or visually de-emphasized when total results are zero.

### Alerts

Evidence: `screenshots/roast_style_audit/04-alerts.png`

Corrections:
- The empty-state container is too tall and too faint.
- Align the primary `Nouvelle alerte` button with the page title baseline more tightly.
- The title icon and text are acceptable, but the icon feels slightly ornamental; size and stroke should match the nav icon system.
- The explanatory paragraph is long for the top of a sparse page; tighten max width and line length.

### About

Evidence: `screenshots/roast_style_audit/05-about.png`

Corrections:
- Replace the large carded text block with an article layout.
- Add clearer section spacing: current headings are readable but all sections feel equally weighted.
- Bullet list spacing is okay, but bullets are visually plain next to the rest of the product polish.
- The right side of the viewport is unused; center the content or add a contextual rail.

### Contact

Evidence: `screenshots/roast_style_audit/06-contact.png`

Corrections:
- Remove the nested form card.
- Align contact methods and form top edges more precisely.
- Give the left contact column a stronger structure; current icons float beside text without enough grouping.
- Form fields need more consistent widths: the two half-width fields are fine, but the form block itself feels squeezed inside its card.
- Increase contrast of labels slightly.

### FAQ

Evidence: `screenshots/roast_style_audit/07-faq.png`

Corrections:
- The FAQ page has too many bordered rounded elements: category pills, icon tiles, accordion cards, CTA box, outer card.
- Category pills should feel like tabs or filters, not decorative counters.
- Accordion icon tiles are slightly heavy; reduce the tile background/border or make icons inline.
- Open accordion content has a large left indent that makes the answer feel disconnected from the question.
- CTA box at the bottom should align visually with accordion width and style.

### Legal Pages

Evidence:
- `screenshots/roast_style_audit/08-legal-notice.png`
- `screenshots/roast_style_audit/09-privacy.png`
- `screenshots/roast_style_audit/10-terms.png`
- `screenshots/roast_style_audit/11-cookies.png`

Corrections:
- Use one legal article template.
- Remove the big body card or make it a centered article with subtle section dividers.
- Improve heading rhythm: section headings are large and repeated, which makes legal content feel longer than it is.
- Add a small right-side table of contents on desktop if keeping the page left-aligned.
- The update date should be a quiet metadata row, not floating as normal paragraph text.

### Admin Dashboard

Evidence: `screenshots/roast_style_audit/12-admin-dashboard.png`

Corrections:
- Bring the admin color palette closer to the public brand.
- Metric cards need clearer hierarchy: label, number, helper should have distinct weights and spacing.
- The vertical accent bars on metric cards are inconsistent in emphasis; either use them systematically by status or remove them.
- `Reachable` green is visually isolated; define admin success/error chip styles.
- The huge empty lower half makes the dashboard feel unfinished when data is empty. Add a compact empty-state treatment or reduce panel heights.

### Admin Imports

Evidence: `screenshots/roast_style_audit/13-admin-imports.png`

Corrections:
- Fix the DCE cache metric row padding: the first `0` starts at the card edge.
- Disabled buttons are too low contrast and tiny; make disabled state clear but still legible.
- The two empty panels are very tall for one icon and two text lines.
- Primary actions in the top right are clear, but their black treatment should become brand-primary or admin-primary.

### Admin Tenders

Evidence: `screenshots/roast_style_audit/14-admin-tenders.png`

Corrections:
- Group filters under a visible filter row/container label.
- Use a consistent grid: the second row currently looks like leftover controls.
- Empty table panel is too tall for the message.
- The page subtitle says “Review, moderate, and moderate”; fix visually only if touching copy is acceptable, otherwise flag for copy cleanup separately.

### Admin Audit Logs

Evidence: `screenshots/roast_style_audit/15-admin-audit-logs.png`

Corrections:
- Filter layout wraps awkwardly: `From` is on row one while `To` drops to row two.
- Put date range fields together as one grouped control.
- Align export button with the filter grid or page header, not both.
- Empty state panel can be shorter and should align with the final filter row.

### Admin Users

Evidence: `screenshots/roast_style_audit/16-admin-users.png`

Corrections:
- Add breathing room between filters and table.
- Table header contrast is weak; make headers easier to scan.
- The `owner` role badge, `Active` status badge, and disabled `Suspend` button all use different visual languages.
- Row height is tight for the two-line user identity cell.
- The disabled action button should look intentionally disabled, not like it failed to load.

### Admin Roles

Evidence: `screenshots/roast_style_audit/17-admin-roles.png`

Corrections:
- Strongest admin page structurally; use it as the table baseline.
- Add subtle row grouping or zebra-striping to help scan permissions.
- Checkmark and dash symbols need stronger accessible contrast and consistent alignment.
- Role description cards below the matrix are useful but visually cramped; increase internal padding slightly.

### Admin Settings

Evidence: `screenshots/roast_style_audit/18-admin-settings.png`

Corrections:
- Form fields, labels, helper text, and card backgrounds are too close in tone.
- Make labels smaller/stronger and helper text quieter but still readable.
- Button row should align with the form width, not float under the form in a way that feels detached.
- Status row should use a proper success component, not just green text inside beige space.

### Admin Integrations

Evidence: `screenshots/roast_style_audit/19-admin-integrations.png`

Corrections:
- Sidebar says `COMING SOON`, page title says `Integrations`, empty state says `Coming soon`; this is visually redundant.
- Centered empty state floats in a huge blank canvas. Give it a bounded panel or reduce vertical dead space.
- Disabled sidebar item should still be legible enough to read comfortably.

## Reusable UI Rules for Claude

Apply these before touching individual pages:

1. Use one public design system and one admin variant, not two unrelated products.
2. Stop nesting cards. One surface is usually enough.
3. Make empty states compact, intentional, and consistent.
4. Use desktop width deliberately: center prose or add useful right-side context.
5. Standardize buttons, chips, badges, inputs, cards, and table headers.
6. Reduce border noise where multiple controls stack vertically.
7. Increase muted text contrast where it sits on tinted or beige backgrounds.
8. Keep icon stroke weight and icon container treatment consistent.
9. Make filter rows look designed, not just wrapped.
10. Preserve the current functional structure; this is a polish pass, not a product rewrite.

## Suggested Order of Work

1. Define shared UI tokens for card, border, background, text, muted text, primary action, disabled action, success, warning, and danger.
2. Normalize public page shell: navbar, footer, content width, intro blocks.
3. Normalize admin shell: sidebar, top bar, page header, action buttons.
4. Create reusable empty-state component and replace all empty screens.
5. Fix forms: auth, contact, admin settings.
6. Fix filter grids: catalog, admin tenders, audit logs, users.
7. Fix prose/legal templates.
8. Final pass at 1440px and mobile widths for alignment, overflow, and text wrapping.
