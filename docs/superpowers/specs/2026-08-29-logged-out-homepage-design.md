# Logged-Out Homepage Design

Date: 2026-08-29

## Context

The root route currently redirects to `/tenders`, and logged-out visitors are then pushed into login/registration before seeing useful product context. This makes the product feel abrupt and untrustworthy. The next public-facing priority is to give logged-out users a credible homepage that explains what the service is, shows realistic sample value, and invites account creation without making the form the first impression.

## Goals

- Replace logged-out root behavior with a public homepage at `/`.
- Keep authenticated users moving quickly to `/tenders`.
- Show enough product context to make registration feel reasonable.
- Include sample tender data without exposing the full gated catalog.
- Keep the story short, authentic, and procurement-specific.
- Preserve existing public pages: `/about`, `/faq`, `/contact`, legal pages.

## Non-Goals

- No pricing page.
- No public full catalog search in this slice.
- No blog/storytelling CMS.
- No marketing automation.
- No changes to backend auth gating for `/api/tenders`.
- No redesign of the admin app.

## Routing Behavior

`/` behavior:

- Logged-out user: render `Home`.
- Logged-in user: redirect to `/tenders`.

Existing protected routes stay protected:

- `/tenders`
- `/tenders/:id`
- `/alerts`

Public routes stay public:

- `/`
- `/login`
- `/register`
- `/about`
- `/faq`
- `/contact`
- `/legal/mentions-legales`
- `/legal/confidentialite`
- `/legal/conditions`
- `/legal/cookies`

## Homepage Sections

The user mentioned 14 homepage elements may be supplied later. Until that copy exists, Claude should implement the page with a content map that is easy to edit and reorder.

Recommended section order:

1. Hero: clear product identity and value.
2. Trust strip: source, country, daily monitoring, account-gated access.
3. Sample opportunities: static or public sample cards based on realistic tender fields.
4. How it works: search, inspect, download DCE, track alerts.
5. Practical value: reduce time spent checking portals manually.
6. Feature snapshot: filters, tender detail, DCE access, exports, alerts.
7. Coming soon: better matching, richer account controls, more verification.
8. Short story/about: why the product exists.
9. Data responsibility: official-source orientation and verification caution.
10. CTA band: create account / log in.
11. FAQ preview: 3-4 high-friction questions.
12. Contact prompt.
13. Legal footer links.
14. Optional storytelling link if a dedicated story page is later approved.

## Copy Direction

Tone:

- Short.
- Direct.
- Credible.
- Moroccan public procurement context.
- Avoid hype.
- Avoid pretending the platform replaces legal/procurement judgment.

Hero headline options:

- `Marches publics marocains, plus faciles a suivre`
- `Un acces plus clair aux consultations publiques`
- `Suivez les appels d'offres sans repartir de zero chaque jour`

Recommended hero:

`Marches publics marocains, plus faciles a suivre`

Supporting copy:

`Reperez les consultations utiles, ouvrez les details, telechargez le DCE quand il est disponible, et gardez vos alertes au meme endroit.`

Primary CTA:

- `Creer un compte`

Secondary CTA:

- `Se connecter`

## Sample Data Design

Do not call `/api/tenders` from the logged-out homepage because it is intentionally gated.

Use a small static sample array in the frontend, shaped like tender cards:

- reference
- title
- buyer
- location
- deadline
- category
- signals shown as labels, for example `DCE disponible`, `Budget a verifier`, `Echeance proche`

The sample cards must be clearly labeled as examples. They should demonstrate the interface value without implying the live catalog is public.

## Visual Design

Use the current institutional direction:

- white surfaces
- low-contrast borders
- compact sections
- restrained primary color
- no oversized decorative marketing layout
- no vague stock imagery unless a real/domain-relevant visual asset is selected

The first viewport must show:

- brand/product name
- value proposition
- primary CTA
- hint of sample opportunities below the fold

Mobile:

- CTA buttons stack if needed.
- Sample cards should be readable and not overflow.
- Avoid dense grids above the fold.

Desktop:

- Hero can pair concise copy with sample opportunity preview.
- Avoid making the registration form the primary visual object.

## Dedicated Storytelling Page Decision

Do not add a dedicated story page in the first slice. Add a short story/about block on the homepage and link to existing `/about`.

Reason:

- The urgent problem is trust before registration.
- A separate story page adds routing/copy burden before the core homepage is credible.
- If the story later grows, it can become `/story` or be folded into `/about`.

## Files Likely To Change

- Create `frontend/src/pages/Home.tsx`.
- Modify `frontend/src/App.tsx` for root route behavior.
- Modify `frontend/src/components/Navbar.tsx` so logged-out users can navigate Home/About/FAQ/Contact/Login/Register cleanly.
- Optionally create `frontend/src/lib/homeContent.ts` if the 14 elements are large enough to keep page code clean.
- Optionally adjust `frontend/src/index.css` only for reusable homepage section utilities.

## Testing

Frontend build:

- `cd frontend && npm run build`

Manual route checks:

- Logged-out `/` shows homepage.
- Logged-in `/` redirects to `/tenders`.
- Logged-out `/tenders` redirects to `/login`.
- `/login` and `/register` remain reachable.
- Public pages remain reachable.

Responsive checks:

- 375px mobile
- 768px tablet
- 1280px desktop

## Acceptance Criteria

- Logged-out visitors see a credible homepage before registration.
- The homepage includes hero, sample opportunities, how-it-works, coming-soon, short about/story, trust/data responsibility, FAQ preview, and CTA sections.
- Authenticated users still land in the working catalog flow.
- No private tender API data is exposed to logged-out users.
- The registration form is no longer the first impression of the product.
