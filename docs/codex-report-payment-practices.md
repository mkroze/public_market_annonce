# Codex Report: Apple and Google Payment Practices Agent

Date: 2026-09-04

## Agent Mission

Create a payment-experience review and implementation agent that studies how Apple and Google handle payments, then applies those practices to product design, checkout flow, entitlement handling, and security architecture.

The agent must judge payment work from three perspectives:

1. User experience: Can the user understand, trust, authorize, complete, and recover from payment states without friction?
2. Platform and business operations: Does the flow respect platform rules, payment lifecycle requirements, reconciliation, support, refunds, and entitlement state?
3. Security and trust: Does the system minimize sensitive data exposure, verify payment state server-side, prevent abuse, and keep user/payment data bounded to the transaction purpose?

This agent should not blindly copy Apple Pay, Google Pay, App Store, or Google Play Billing UI. It should extract the underlying practices: fast checkout, minimal data collection, clear authorization, strong state handling, trusted platform primitives, and backend-owned entitlement decisions.

## Executive Standard

A 10/10 payment implementation should feel obvious, fast, hard to misuse, transparent about amount and state, and resilient when something goes wrong.

The target is not just "payment works." The target is:

- The right payment method appears only when usable.
- The user sees the final price before authorization.
- The user never wonders whether the payment succeeded.
- The backend, not the client, decides entitlement.
- Tokens, signed transactions, and lifecycle events are verified before access is granted.
- Refunds, cancellations, pending payments, renewals, and revoked purchases update access correctly.
- Sensitive payment data is never collected or retained beyond what is required.

## Perspective 1: User Experience Practices

### Make Payment Availability Contextual

Apple and Google both emphasize that accelerated payment options should be shown when they are actually available to the user. The agent should require capability checks before rendering wallet payment buttons.

Implementation rules:

- Use platform readiness checks before showing Apple Pay or Google Pay.
- Do not show a wallet button that leads to a dead end.
- If a preferred payment method was previously selected and is still available, make it easy to reuse.
- Keep payment options visually comparable, while giving platform wallets appropriate prominence when readiness is confirmed.

### Keep Checkout Inside One Coherent Flow

Apple guidance favors a cohesive checkout experience and warns against confusing handoffs. The agent should reject flows that open unnecessary pages, popups, or disconnected payment steps.

Implementation rules:

- Keep checkout in the same product context.
- Avoid unexplained redirects or windows.
- Keep brand, order summary, amount, and payment controls visually connected.
- Put express payment on product or detail pages when the purchase is simple and single-item.
- For cart or subscription purchases, preserve review and confirmation before final authorization.

### Minimize Fields And Data Requests

Both Apple Pay and Google Pay support returning contact, shipping, and billing data, but the agent should enforce data minimization.

Implementation rules:

- Request only data needed to process, fulfill, support, or legally document the transaction.
- Avoid asking for phone, billing address, or shipping address unless the product or service needs it.
- Use payment sheet data to reduce typing, not to enrich profiles without consent.
- If extra data is needed, explain why in the flow.

### Always Show Final Price Before Charge

Google requires a final price before processing when totals can change. Apple payment sheets also support line items, tax, shipping, discounts, and totals.

Implementation rules:

- Show total, currency, tax, fees, discount, recurring terms, and billing period before authorization.
- If shipping, address, coupon, tax, or plan change affects price, recalculate visibly before charge.
- For subscriptions, show renewal cadence, trial terms, cancellation terms, and first charge date.
- Do not rely on small legal text to communicate the amount.

### Give Clear State After Payment

Google Play Billing stresses notifying users after entitlement is granted. The agent should require success, pending, failure, cancellation, and refund states.

Implementation rules:

- Show immediate confirmation after successful payment.
- For pending payments, clearly state that access is not active yet and what happens next.
- For failed payments, show a recoverable error with retry and alternate payment routes.
- For cancelled payments, return to the previous context without destroying user work.
- For refunds or revoked purchases, explain access changes and support options.

### Support Restore And Cross-Device Continuity

Apple StoreKit and Google Play both treat transaction history, current entitlements, and lifecycle events as core. The user should not have to repurchase because they changed devices.

Implementation rules:

- Provide restore purchase or account entitlement sync where relevant.
- Make purchased access available across supported devices/accounts.
- Use backend entitlement records to recover state after app reinstall, device loss, network failure, or delayed notifications.

## Perspective 2: Platform And Business Operations Practices

### Route Payment Type Correctly

Apple and Google separate wallet payments, app-store in-app purchases, and play-store billing. The agent must classify the product before choosing the payment mechanism.

Payment routing:

- Physical goods, real-world services, donations, bookings, and web checkout: Apple Pay and Google Pay can be appropriate.
- Digital content, app features, app subscriptions, and in-app entitlements on Apple platforms: StoreKit / In-App Purchase is the primary platform route.
- Digital content, app features, and subscriptions in Android apps distributed through Google Play: Google Play Billing is the primary platform route.
- External billing, alternative offers, marketplace exceptions, or regulated flows require jurisdiction and platform-policy review before implementation.

### Treat Platform Policy As Product Architecture

Policy is not legal boilerplate at the end. It determines where payment can happen, what payment methods can be offered, what language must be shown, and how entitlements must be managed.

Implementation rules:

- Check Apple Pay acceptable-use restrictions before adding Apple Pay.
- Follow Apple Human Interface Guidelines for Apple Pay buttons and payment sheet behavior.
- Follow Google Pay brand, button, readiness, and integration checklist requirements.
- Confirm payment processor, acquirer, card networks, tokenization methods, and country support before design is finalized.
- Keep wallet payment options at parity with comparable third-party payment methods where required.

### Build A Payment Lifecycle System, Not A Checkout Button

Google Play and Apple App Store both provide server-side notification systems for transaction lifecycle events. The agent should reject implementations that grant access only from client callbacks.

Lifecycle states to model:

- initiated
- authorized
- pending
- purchased/paid
- entitlement_granted
- acknowledged/consumed
- renewed
- upgraded/downgraded
- expired
- refunded
- revoked
- disputed
- failed

Operational requirements:

- Store immutable payment event records.
- Keep a current entitlement table separate from raw payment events.
- Process server notifications idempotently.
- Deduplicate event IDs and purchase tokens.
- Reconcile platform reports with local entitlement state.
- Provide support staff enough payment state to explain user issues without exposing sensitive card data.

### Acknowledge Or Consume Purchases Correctly

Google Play requires acknowledgement after entitlement delivery, with automatic refund risk if this is missed. Apple StoreKit requires finishing transactions after delivery. The agent should treat this as a release blocker.

Implementation rules:

- Verify purchase legitimacy first.
- Grant entitlement only when the payment state is eligible.
- Acknowledge, consume, or finish only after entitlement is delivered.
- Never grant entitlement for pending purchases.
- If a validation or abuse check fails, do not grant entitlement; revoke or refund explicitly where the platform supports it.

### Test Full Payment Behavior

Google Pay and Play Billing emphasize test environments, supported devices, browser behavior, and pending transactions. Apple provides sandbox and StoreKit testing.

Minimum test matrix:

- readiness/capability unavailable
- wallet available
- payment cancelled
- payment authorized
- processor failure
- dynamic price update
- pending purchase
- duplicate notification
- duplicate purchase token
- refund/revoke
- renewal
- expiration
- restore purchase
- expired session/token
- backend unavailable after client purchase

## Perspective 3: Security And Trust Practices

### Prefer Tokenized Payment Primitives

Apple Pay and Google Pay are designed around tokenization and device/user authorization. The agent should avoid architectures that directly handle raw card data unless absolutely necessary and properly certified.

Security rules:

- Do not collect raw card numbers if a wallet, platform billing, or payment processor hosted flow can handle them.
- Do not store PAN/CVV.
- Prefer network/device tokens, signed transaction payloads, cryptograms, and processor tokens.
- Keep payment credentials scoped to the transaction.

### Verify On The Server Before Granting Access

Google Play recommends backend verification before entitlements. Apple supports server validation through App Store Server API, signed transactions, and notifications.

Server-side rules:

- Send purchase tokens or signed transaction data to the backend.
- Verify with Apple, Google, or the payment processor before entitlement.
- Treat the client as an untrusted presenter of payment state.
- Store purchase tokens as unique IDs and reject replay.
- Make entitlement writes idempotent.
- Re-check platform state during restore, renewal, refund, and support operations.

### Validate Cryptographic Payloads

Both ecosystems use cryptographic protection for transaction data. The agent should require explicit validation and key-management plans.

Security requirements:

- For Apple StoreKit 2, validate App Store-signed JWS transaction data or use StoreKit verified results where appropriate; use server validation for stronger control.
- For App Store Server Notifications V2, validate signed payloads server-side.
- For Google Pay DIRECT integrations, verify signatures and decrypt ECv2 payment tokens correctly.
- For Google Pay gateway integrations, ensure the processor handles token decryption and card processing.
- Rotate keys according to provider requirements.
- Keep private keys in server-side secret storage only.

### Keep Risk Controls Even When Using Wallets

Google is explicit that Google Pay validation and fraud checks do not replace merchant risk management. The agent should require normal risk controls for wallet payments.

Risk controls:

- Apply existing fraud/risk checks to wallet payments.
- Trigger 3-D Secure or step-up authentication under the same risk logic used for card payments, especially for PAN_ONLY flows.
- Use account identifiers or obfuscated IDs to bind payment state to the expected user.
- Detect impossible purchase velocity, repeated failed attempts, token replay, regional abuse, and mismatched account mappings.
- Monitor voided/refunded purchases and revoke access.

### Minimize Payment Data Usage

Apple and Google constrain payment data to payment purposes. The agent should enforce consent and retention boundaries.

Data governance:

- Use payment data only to process, fulfill, support, reconcile, prevent fraud, or meet legal/accounting obligations.
- Do not use wallet-returned identity/contact fields for marketing unless separately consented.
- Retain only what support, accounting, tax, and compliance require.
- Redact sensitive fields from logs.
- Never log tokens, cryptograms, full addresses, authorization headers, or signed payment payloads unless safely tokenized/redacted.

## Mapping To This Platform's Paywall Plan

The local paywall direction should be entitlements-first, not provider-first.

Recommended fit:

- Keep catalog browsing generous for signed-in/free users.
- Put premium value behind capabilities, not scattered plan checks.
- Make DCE download, PDF export, full contact/address details, unlimited alerts/saved searches, email digest, and the AI candidacy assistant premium capabilities.
- Treat `/assistant` as the strongest paid feature because it has real legal-preparation value and Anthropic cost exposure.
- Launch with invoice/bank-transfer and manual admin activation if Moroccan card rails are not ready.
- Add CMI or another hosted provider later behind the same subscription and entitlement model.

Capability examples:

- `can_download_dce`
- `can_export_pdf`
- `can_view_full_contact`
- `can_use_assistant`
- `alerts_limit`
- `saved_searches_limit`
- `can_receive_digest`

Backend principles:

- Backend owns subscription status and capabilities.
- Frontend gates are UX only.
- Premium endpoints should return structured upgrade responses such as `402` or `403` with `reason: "upgrade_required"`.
- Manual activation and future hosted checkout should both write into the same subscription state.
- Payment and subscription events should be immutable; current entitlements should be derived from the latest valid state.

Frontend principles:

- `RequirePlan` should mirror `RequireAuth`.
- Signed-out users should see login/register with preserved intent.
- Signed-in free users should see upgrade prompts with the exact feature they tried to access.
- Member subscription UI should show plan, status, renewal or expiry date, invoices, and support path.
- Backend upgrade responses must be handled gracefully even if frontend entitlements are stale.

Morocco-specific operational notes:

- Treat CMI or local hosted card payment as a v2 payment rail, not a prerequisite for launching the paywall.
- Invoice/bank-transfer activation is credible for B2B procurement users and reduces initial payment-rail risk.
- Invoicing should account for TVA, ICE, invoice numbering, receipts, and accounting export needs.
- External facts about local provider onboarding and tax treatment should be verified with the provider, accountant, or legal counsel before production launch.

## Platform Practice Comparison

| Area | Apple Practice | Google Practice | Agent Requirement |
| --- | --- | --- | --- |
| Wallet UX | Apple Pay shown only where supported, cohesive checkout, immediate payment sheet after tap | Google Pay button rendered after readiness checks and tested across browsers/devices | Payment buttons must be capability-gated and contextually placed |
| User authorization | Face ID, Touch ID, Optic ID, device passcode, or Apple Watch confirmation | Device unlock and cardholder verification methods for eligible flows | Payment must require explicit user authorization |
| Data exposure | Full card number is not shared with merchants in Apple Pay | Google Pay returns tokenized/signed/encrypted payment data depending on integration | App should avoid handling raw card data |
| Digital goods | StoreKit / In-App Purchase with signed transactions and App Store lifecycle support | Google Play Billing with purchase tokens, RTDN, acknowledgement, and lifecycle APIs | Digital entitlement must use platform billing where policy requires |
| Entitlement | StoreKit transactions/current entitlements and App Store Server API/Notifications | Backend verification, purchase state checks, acknowledgement/consume, RTDN | Backend-owned entitlement state is mandatory |
| Abuse controls | Server validation and signed notifications support lifecycle integrity | Backend logic, voided purchases, duplicate token checks | Fraud checks must survive client tampering |

## Agent Review Checklist

### User Experience

- Is the payment CTA visible at the right moment?
- Is the payment method available before it is shown?
- Does the user see the exact final amount before authorization?
- Are recurring terms clear before commitment?
- Is cancellation graceful?
- Are success, pending, failure, refund, and revoked states visible?
- Can the user restore or recover purchases?
- Does the flow avoid unnecessary windows, redirects, and duplicate forms?

### Platform And Business

- Is the product type classified correctly: physical/service/web, Apple digital, Google Play digital, subscription, donation, booking, or external transaction?
- Are platform rules and acceptable-use restrictions satisfied?
- Are processor/acquirer/country/card network/tokenization constraints confirmed?
- Are payment events stored separately from entitlement state?
- Are server notifications implemented and idempotent?
- Are refunds, chargebacks, voided purchases, renewals, expiration, and plan changes handled?
- Is support/reconciliation possible without exposing sensitive payment credentials?

### Security

- Does the system avoid raw PAN/CVV handling?
- Are payment tokens or signed transactions verified server-side?
- Are duplicate purchase tokens rejected?
- Are pending purchases blocked from entitlement?
- Are acknowledgements/consumption/finish calls performed only after entitlement delivery?
- Are sensitive logs redacted?
- Are keys stored only server-side and rotated when required?
- Are existing fraud checks applied to wallet payments?
- Are 3-D Secure or step-up rules applied consistently?

## Recommended Architecture Pattern

Use a state-machine approach:

1. Client starts checkout only after product, price, account, and payment readiness are known.
2. Client receives a wallet token, purchase token, or signed transaction payload.
3. Client sends only the minimum payment proof to backend.
4. Backend verifies with Apple, Google, or payment processor.
5. Backend records immutable payment event.
6. Backend computes entitlement state.
7. Backend grants entitlement only if payment state is valid.
8. Backend acknowledges, consumes, or finishes the platform transaction where required.
9. Backend listens to lifecycle notifications and reconciles state continuously.
10. Client displays current entitlement, not just the last checkout callback.

## Anti-Patterns The Agent Must Flag

- Payment button shown even when the device/account cannot use it.
- Client grants premium access immediately from a frontend success callback.
- Pending purchases unlock paid features.
- No duplicate-token protection.
- No restore purchase path.
- No server notification processing for subscriptions.
- No refund/revocation handling.
- Total price changes after authorization.
- Asking for address, phone, or company details with no transaction need.
- Raw card details handled by the app unnecessarily.
- Payment token, cryptogram, authorization header, or signed payload logged.
- Legal/policy requirements treated as copy text instead of flow architecture.

## Source Notes

Official sources consulted:

- Apple Human Interface Guidelines: Apple Pay  
  https://developer.apple.com/design/human-interface-guidelines/apple-pay
- Apple Pay planning and implementation guidance  
  https://developer.apple.com/apple-pay/planning/  
  https://developer.apple.com/apple-pay/implementation/
- Apple Pay acceptable-use guidelines for websites  
  https://developer.apple.com/apple-pay/acceptable-use-guidelines-for-websites/
- Apple platform security: paying with cards using Apple Pay  
  https://support.apple.com/guide/security/paying-with-cards-using-apple-pay-secfbd5c0e54/web
- Apple StoreKit In-App Purchase documentation  
  https://developer.apple.com/documentation/storekit/in-app-purchase
- Apple StoreKit transaction verification documentation  
  https://developer.apple.com/documentation/StoreKit/Transaction
- Apple App Store Server API and Server Notifications documentation  
  https://developer.apple.com/documentation/appstoreserverapi  
  https://developer.apple.com/documentation/AppStoreServerNotifications
- Google Pay API overview, tutorial, integration checklist, and payment cryptography  
  https://developers.google.com/pay/api/web/overview  
  https://developers.google.com/pay/api/web/guides/tutorial  
  https://developers.google.com/pay/api/web/guides/test-and-deploy/integration-checklist  
  https://developers.google.com/pay/api/web/guides/resources/payment-data-cryptography
- Google Pay security overview  
  https://developers.google.com/pay/issuers/overview/security
- Google Play Billing integration, security, backend, and lifecycle documentation  
  https://developer.android.com/google/play/billing/integrate  
  https://developer.android.com/google/play/billing/security  
  https://developer.android.com/google/play/billing/backend  
  https://developer.android.com/google/play/billing/lifecycle

