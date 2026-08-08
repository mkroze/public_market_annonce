# FAQ Redesign Design

## Goal

Redesign the FAQ page to match the overall layout and shape language of the supplied reference while preserving the existing French content, black and cream theme, routing, and dark mode behavior.

## Scope

- Update `pages/Faq.tsx` only unless verification exposes a local styling issue that must be handled in shared CSS.
- Keep the existing FAQ questions and answers.
- Keep single-open accordion behavior.
- Keep the current `PageShell` wrapper so breadcrumbs and static-page spacing remain consistent with the rest of the site.

## Visual Direction

- Use a centered FAQ composition inspired by the reference.
- Add compact category pills above the accordion: `General`, `Consultation`, `Compte`, and `Donnees`; `General` is the active visual state.
- Render FAQ items as thin bordered rounded rows with a square icon cell on the left, question text in the middle, and a chevron on the right.
- Use the existing black, cream, slate, and border tokens. Do not introduce new brand colors.
- Keep the layout compact on desktop and full-width on mobile.

## Components

- `FAQS`: add a category and icon key for each item.
- `CATEGORIES`: provide the category pill labels and counts.
- `Faq`: render the centered intro, category pills, accordion list, and contact prompt.

## Accessibility

- Accordion buttons expose `aria-expanded`.
- Each answer is linked to its question button with `aria-controls` and `id`.
- Icon-only visual affordances are decorative unless they communicate button state.
- Focus states remain visible through existing Tailwind and theme styling.

## Testing

- Run the project build.
- If practical, start Vite and inspect the page in a browser-sized viewport for responsive layout, accordion state, and text fit.
