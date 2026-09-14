# Paywall Implementation Plan

A plan for adding a paywall to the Moroccan public-procurement platform, grounded in the existing stack (JWT auth + `useAuth`/`RequireAuth`, `user.role`, the backend `restrict_v1_api_surface` allowlist, the admin control plane, Brevo email, and login-gated surfaces: DCE download, contact/addresses, `/assistant`).

The paywall adds a **plan** gate on top of the existing **login** gate. Reuse existing patterns — don't invent parallel ones.

---

## 1. Draw the tier line (product decision first)

- **Free (registered):** catalog browsing, stats/directories, basic tender detail, a few favorites, 1 saved search. Keep this generous — the catalog is the discovery/SEO funnel; paywalling it kills growth.
- **Premium (paid):** DCE download, PDF export, full contact + retrait/dépôt addresses, unlimited alerts + saved searches, **AI candidacy assistant** (`/assistant`), email digest.

The assistant and DCE are the strongest "reasons to pay" — and the assistant carries real Anthropic cost, so gating it protects margin, not just revenue.

## 2. Model capabilities, not booleans

Avoid `if (plan === 'premium')` scattered everywhere. Define **entitlements** (`can_download_dce`, `can_use_assistant`, `alerts_limit`, `saved_searches_limit`) resolved once per side:

- Backend: `get_entitlements(user)`
- Frontend: `useEntitlements()`

Future tiers (Pro, Team) become additive, not a rewrite.

## 3. Backend is the source of truth

Frontend gating is UX only; enforce server-side (same mindset as the surface allowlist).

- **Tables:** `subscriptions` (user_id, plan, status `trialing|active|past_due|canceled`, `current_period_end`, provider refs), optional `plans`, `payments`/`invoices` for audit.
- A `require_plan("premium")` FastAPI dependency on DCE download, `/assistant/ask`, PDF export. Add matching entries to `test_v1_api_surface.py`.
- Return a structured `402`/`403` with `reason: "upgrade_required"` so the UI renders an upgrade prompt, not a generic error.

## 4. Payments — the real constraint (Morocco)

This decides the timeline, not the code:

- **CMI** is the dominant Moroccan card gateway but onboarding is slow (bank/merchant contract, hosted-redirect + webhook). Stripe doesn't cleanly support Morocco payouts; local alternatives are PayZone, Naps, CashPlus/Payd.
- **Phase it:** launch **v1 as invoice / bank-transfer + manual admin activation** using the admin space that already exists (grant/revoke plan, set `current_period_end`). The audience is B2B procurement — annual invoice billing is normal here and lets the paywall ship now. Add **CMI hosted checkout + webhook → flip `subscription.status`** as v2 self-serve.

## 5. Frontend

- `RequirePlan` wrapper mirroring `RequireAuth` for `/assistant`; redirect to `/pricing` or `/member/subscription` preserving intent via the existing `state.from` pattern.
- Make the existing `LockedPanel` plan-aware: signed-out → login; free → "Passer Premium."
- Add a pricing page + a subscription section in `/member` (status, renewal date, invoices). Read entitlements from `user`, but still handle the backend `402` gracefully.

## 6. Lifecycle & compliance — don't skip

- Trial → renewal → expiry-downgrade → `past_due` grace; **webhook idempotency** for CMI.
- Brevo emails already available: welcome-to-premium, receipt, expiring-soon, payment-failed.
- Morocco invoicing: TVA 20% compliant facture + ICE; RGPD-equivalent data handling — often a prerequisite to even take card payments, so resolve before CMI onboarding.

---

## Sequencing

1. Entitlements layer + `subscriptions` table + `require_plan` on assistant/DCE/PDF (+ surface tests).
2. Admin manual grant/revoke + expiry.
3. Frontend `RequirePlan`, upgrade panels, pricing + member subscription page.
4. Invoice/bank-transfer launch.
5. CMI hosted checkout + webhook (self-serve v2).

**Honest caveat:** the hard part is Moroccan payment rails + invoicing, not the code. Build the entitlement layer provider-agnostic now, launch on manual/invoice activation, and treat CMI as a swappable backend behind `subscription.status`.
