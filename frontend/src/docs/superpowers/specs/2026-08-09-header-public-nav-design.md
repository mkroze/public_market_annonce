# Header Public Navigation Design

## Goal

Make the public support pages easier to find by promoting a small subset of footer navigation links into the header.

## Scope

- Update `components/Navbar.tsx`.
- Add `À propos`, `FAQ`, and `Contact` to the header navigation.
- Keep legal links in the footer only.
- Keep the footer unchanged.
- Preserve the existing theme toggle, logo handling, responsive dropdown, and active-link behavior.

## Visual Direction

- Desktop header bottom nav shows `Toutes les consultations`, `À propos`, `FAQ`, and `Contact`.
- Mobile dropdown shows the same set of links.
- Each link uses a lucide icon, matching the existing header style.
- Active and hover states continue using the existing black, cream, slate, and border tokens.

## Accessibility

- Links remain semantic `Link` components.
- Icons are decorative and paired with visible labels.
- Mobile menu remains reachable from the existing menu button.

## Testing

- Run the existing lint command.
- Run the production build.
- Check that `/about`, `/faq`, and `/contact` are present in `Navbar.tsx`.
