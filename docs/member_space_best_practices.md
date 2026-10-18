# Member Space --- Best Practices

**Project:** MP Maroc / Public Tenders\
**Purpose:** Define the UX and information architecture principles for
the authenticated member area, using Google Account and Apple Account as
reference models.

------------------------------------------------------------------------

## 1. Executive principle

The member space should **not behave like a generic dashboard**.

Its job is to answer one question immediately:

> **What can I do here that helps me get value from the product right
> now?**

Google and Apple both treat the account area as a **control center**:
identity, security, data, subscriptions/devices, and account-level
actions are grouped into a small number of predictable categories. The
product-specific experience remains focused on the user's actual jobs.

For MP Maroc, this means separating:

1.  **Work** --- consultations, alerts, saved searches, followed
    opportunities.
2.  **Account** --- profile, notification preferences, security,
    subscription.
3.  **System feedback** --- deadlines, alert status, missing
    configuration, errors.

The member homepage should prioritize **work**, not settings.

------------------------------------------------------------------------

# 2. What Google does well

Google Account is organized around a persistent, centralized account
model. Google describes the account as a central place where users can
manage personal information, privacy, security, payments, subscriptions
and other cross-service information.

## 2.1 Clear category architecture

Google exposes account management through recognizable categories rather
than a giant settings page.

Typical categories include:

-   Personal information
-   Data & privacy
-   Security / sign-in
-   Payments
-   Subscriptions
-   Account-related activity

### Lesson for MP Maroc

Keep the main navigation shallow and semantic.

A member should never need to understand the internal structure of the
application to find something.

Recommended top-level navigation:

-   **Accueil**
-   **Mes consultations**
-   **Mes alertes**
-   **Recherches enregistrées**
-   **Profil & préférences**

Subscription/billing can become its own item only when monetization
makes it important enough.

------------------------------------------------------------------------

## 2.2 Action-oriented status

Google surfaces security recommendations rather than merely exposing
security settings. Its Security Checkup can show whether action is
required and uses status/severity signals.

### Lesson for MP Maroc

Do not make members inspect the system to discover problems.

Surface actionable states directly:

-   `3 nouvelles consultations correspondent à vos alertes`
-   `2 consultations clôturent dans moins de 48 h`
-   `Votre alerte "Travaux électriques" n'a aucune région sélectionnée`
-   `Votre adresse email n'est pas vérifiée`
-   `Aucune alerte active`

The interface should distinguish:

-   **Healthy**
-   **Needs attention**
-   **Urgent**
-   **Informational**

Only use urgency when it actually changes what the member should do.

------------------------------------------------------------------------

## 2.3 Centralized preferences

Google gives users a central place to manage information and controls
rather than scattering them unpredictably across products.

### Lesson for MP Maroc

Create one canonical source of truth for:

-   identity;
-   email;
-   organization;
-   notification channels;
-   notification frequency;
-   default regions;
-   preferred categories;
-   security;
-   account deletion/export when applicable.

Contextual shortcuts may exist elsewhere, but they should lead back to
the same underlying settings.

------------------------------------------------------------------------

## 2.4 History is useful when it supports action

Google groups purchases, reservations and subscriptions so users can
inspect past and ongoing items and take actions such as managing or
cancelling them.

### Lesson for MP Maroc

Member history should not be a dead archive.

For every saved/followed consultation, expose useful actions:

-   Open consultation
-   View source
-   Stop following
-   Add/remove from project or shortlist
-   Review deadline
-   Review downloaded documents
-   View changes, if change tracking exists

------------------------------------------------------------------------

# 3. What Apple does well

Apple's account model emphasizes **simplicity, identity, security,
trusted devices, payment information and subscriptions**.

Its account management experience generally avoids turning every
possible action into a dashboard widget.

## 3.1 Strong separation between account management and product usage

Apple Account manages the identity and infrastructure behind Apple
services, while product workflows remain inside their respective
services.

### Lesson for MP Maroc

Do not turn **Profil** into the product.

The member comes to MP Maroc primarily to:

-   discover opportunities;
-   decide what deserves attention;
-   follow relevant consultations;
-   receive alerts;
-   act before deadlines.

Profile/security/preferences should remain available but visually
secondary.

------------------------------------------------------------------------

## 3.2 Security is concrete

Apple exposes trusted devices and lets users identify devices associated
with their account and remove ones they no longer recognize or use.
Two-factor authentication is also treated as a first-class account
capability.

### Lesson for MP Maroc

Minimum account-security area:

-   Password change
-   Email verification status
-   Active sessions
-   Log out other sessions
-   Last login
-   2FA when justified by product maturity
-   Account deletion

For the MVP, **email verification + password management + session
revocation** is enough if implemented properly.

Do not build enterprise-grade security theater before the core tender
workflow works.

------------------------------------------------------------------------

## 3.3 Destructive actions are explicit

Apple makes account/security actions individually identifiable rather
than hiding them behind ambiguous controls.

### Lesson for MP Maroc

Dangerous actions must have:

-   explicit labels;
-   explanation of consequences;
-   confirmation;
-   strong visual separation from normal settings.

Examples:

-   Supprimer mon compte
-   Désactiver toutes les alertes
-   Déconnecter toutes les sessions

Never use vague labels such as `Réinitialiser` when the actual
consequence is destructive.

------------------------------------------------------------------------

# 4. The MP Maroc member-space model

The strongest model for this product is:

> **Command center first, account center second.**

Google/Apple patterns should inform the account architecture, but the
homepage should be closer to an operational cockpit because MP Maroc is
a task-oriented B2B product.

------------------------------------------------------------------------

# 5. Recommended information architecture

``` text
/member
│
├── /overview
│   └── Operational member homepage
│
├── /consultations
│   ├── followed
│   ├── saved
│   └── recently-viewed       [optional]
│
├── /alerts
│   ├── active
│   ├── paused
│   └── create/edit
│
├── /saved-searches
│
└── /account
    ├── profile
    ├── preferences
    ├── notifications
    ├── security
    └── subscription          [when applicable]
```

Avoid adding navigation sections without a clear recurring member job.

------------------------------------------------------------------------

# 6. Member homepage

The overview page should be a **decision surface**, not a collection of
vanity statistics.

## Header

``` text
Bonjour, [Prénom]

Voici ce qui mérite votre attention aujourd'hui.
```

Optional secondary information:

``` text
Dernière mise à jour du catalogue : [time]
```

## Priority block --- "À traiter"

This is the highest-value component.

Examples:

``` text
À traiter

2 consultations clôturent dans moins de 48 h
5 nouvelles consultations correspondent à vos alertes
1 alerte nécessite votre attention
```

Every item must be clickable and lead directly to the relevant work.

## New matches

Show a compact list of the newest high-relevance consultations generated
by the member's alerts.

Each row/card should expose only decision-making information:

-   Objet
-   Acheteur
-   Lieu
-   Date limite
-   Estimation, when available
-   Matching alert
-   Time remaining

Actions:

-   **Voir**
-   **Suivre / Enregistrer**

Do not reproduce the entire public catalog inside the dashboard.

## Followed consultations

Prioritize followed opportunities by urgency:

``` text
Échéance proche → recently changed → everything else
```

Recommended fields:

  Field           Purpose
  --------------- ------------------------
  Consultation    Identification
  Acheteur        Context
  Date limite     Primary urgency signal
  Temps restant   Faster cognition
  Statut          Current state
  Action          Open / manage

## Alerts summary

Show:

``` text
4 alertes actives
12 nouveaux résultats cette semaine
```

Then display the 2--4 most important alerts.

Primary CTA:

**Gérer mes alertes**

Secondary CTA:

**Créer une alerte**

------------------------------------------------------------------------

# 7. Alerts UX

Alerts are likely to become one of the product's strongest retention
mechanisms.

Each alert should behave like a manageable object.

## Alert card

``` text
Travaux électriques — Casablanca-Settat

Active

Mots-clés       électricité, installation électrique
Région          Casablanca-Settat
Catégorie       Travaux
Fréquence       Quotidienne

7 nouvelles correspondances

[Voir les résultats] [Modifier] [•••]
```

Overflow menu:

-   Pause
-   Duplicate
-   Delete

### Best practice

A user should understand an alert **without opening it**.

Never display only:

``` text
Alerte #482
```

Use a human-readable name generated automatically from its main filters
and allow the user to rename it.

------------------------------------------------------------------------

# 8. Empty states

Empty states must teach the next action.

Bad:

``` text
Aucune alerte.
```

Better:

``` text
Vous n'avez pas encore créé d'alerte.

Recevez automatiquement les nouvelles consultations
correspondant à votre activité.

[Créer ma première alerte]
```

Required empty states:

-   No alerts
-   No followed consultations
-   No saved searches
-   No matches
-   No recent activity

Each should contain **one dominant next action**.

------------------------------------------------------------------------

# 9. Progressive disclosure

Google and Apple both benefit from keeping high-level account navigation
understandable while placing detailed controls deeper in the hierarchy.

Apply the same rule here.

The overview should answer:

-   What is new?
-   What is urgent?
-   What am I following?
-   Are my alerts working?
-   What should I do next?

It should **not** expose every possible configuration field.

Detailed filters belong inside alert/search editing.

Security belongs inside Account.

Billing belongs inside Subscription.

------------------------------------------------------------------------

# 10. Notification preferences

Separate **what** the user follows from **how** the user is notified.

Example:

``` text
Mes alertes
└── What information should trigger a match?

Préférences de notification
└── How should MP Maroc contact me?
```

Recommended notification settings:

-   Email notifications: on/off
-   Frequency: immediate / daily digest
-   Deadline reminders: on/off
-   Product/service emails: separate consent
-   Critical account/security messages: mandatory where necessary

Do not mix marketing consent with operational tender alerts.

------------------------------------------------------------------------

# 11. Search → Save → Alert → Follow loop

This should become the core member loop.

``` text
SEARCH
   ↓
Find useful consultations
   ↓
SAVE SEARCH / CREATE ALERT
   ↓
Receive new matches
   ↓
OPEN CONSULTATION
   ↓
FOLLOW
   ↓
Track deadline
   ↓
Return to member space
```

Every member-space decision should reinforce this loop.

If a feature does not support this loop or account administration,
challenge whether it belongs in the MVP.

------------------------------------------------------------------------

# 12. Cross-navigation

Actions should connect naturally.

From a consultation:

``` text
Créer une alerte similaire
```

From search results:

``` text
Enregistrer cette recherche
Créer une alerte
```

From an alert:

``` text
Voir les consultations correspondantes
```

From a followed consultation:

``` text
Voir les consultations similaires
```

This reduces dead ends.

------------------------------------------------------------------------

# 13. UX rules

## Navigation

-   Maximum \~5 primary member navigation items.
-   Use nouns users already understand.
-   Keep navigation stable between pages.
-   Clearly indicate the active section.
-   Avoid nested navigation deeper than necessary.

## Calls to action

Each screen should have **one obvious primary action**.

Examples:

  Screen           Primary CTA
  ---------------- ----------------------------
  Overview         Explorer les consultations
  Alerts           Créer une alerte
  Saved searches   Nouvelle recherche
  Profile          Enregistrer
  Security         Context dependent

## Forms

-   Save automatically only when the behavior is obvious and reversible.
-   Otherwise provide an explicit **Enregistrer** action.
-   Validate inline.
-   Preserve entered values after errors.
-   Explain why required information is required.
-   Never ask twice for data already known by the account.

## Feedback

Every mutation needs visible feedback.

Examples:

``` text
Alerte créée.
Modifications enregistrées.
Consultation ajoutée à votre suivi.
Alerte mise en pause.
```

For destructive operations, allow undo when technically reasonable.

------------------------------------------------------------------------

# 14. Mobile behavior

The member space should remain operational on mobile, especially for
email-alert → consultation flows.

Mobile priorities:

1.  New alert matches
2.  Deadlines
3.  Consultation details
4.  Follow/save action
5.  Alert management
6.  Account settings

Do not shrink a desktop dashboard into a phone.

On small screens, convert dashboard grids into a prioritized vertical
feed.

------------------------------------------------------------------------

# 15. Accessibility

Minimum requirements:

-   Keyboard-accessible navigation
-   Visible focus states
-   Semantic headings
-   Form labels
-   Error text that does not rely solely on color
-   Sufficient contrast
-   Touch targets large enough for mobile
-   Icons accompanied by labels when meaning is not universally obvious

Status should never be communicated by color alone.

------------------------------------------------------------------------

# 16. Performance

The member overview is a frequent-entry page.

Target behavior:

-   Render useful structure immediately.
-   Load independent sections independently.
-   Use skeleton states only where useful.
-   Do not block the whole dashboard because one API call failed.
-   Cache data that does not require real-time freshness.
-   Display the catalog's last-update timestamp.

A failed widget should fail locally:

``` text
Impossible de charger vos alertes.
[Réessayer]
```

The rest of the member space should remain usable.

------------------------------------------------------------------------

# 17. Privacy and trust

Public procurement is professional activity data. A user's searches,
followed tenders and alerts can reveal commercial intent.

Therefore:

-   Member data is private by default.
-   Do not expose saved searches or followed consultations publicly.
-   Clearly explain notification behavior.
-   Provide account/data deletion mechanisms where legally/product-wise
    required.
-   Do not use confusing consent patterns.
-   Separate operational communications from marketing communications.

Google's account model explicitly emphasizes user control over personal
information and privacy settings; Apple's account guidance similarly
treats account information and security as sensitive centralized
controls.

------------------------------------------------------------------------

# 18. MVP scope

## Must ship

-   Member overview
-   Followed/saved consultations
-   Alerts list
-   Alert creation/editing
-   Alert results
-   Profile
-   Notification preferences
-   Email verification
-   Password management
-   Empty states
-   Responsive mobile layout
-   Loading/error/success states

## Ship soon

-   Saved searches
-   Deadline reminders
-   Active-session management
-   Alert duplication
-   Recently viewed consultations
-   Notification history

## Later

-   2FA
-   Organization/team accounts
-   Shared tender workspaces
-   Advanced activity history
-   Billing/subscription center
-   Role-based permissions
-   Tender change history
-   Multi-user collaboration

Do not allow "Later" features to delay the core member loop.

------------------------------------------------------------------------

# 19. Recommended component inventory

``` text
MemberLayout
├── MemberSidebar / MobileMemberNav
├── MemberHeader
└── PageContainer

MemberOverview
├── AttentionPanel
├── NewMatchesList
├── FollowedConsultationsList
├── AlertsSummary
└── EmptyState

Alerts
├── AlertCard
├── AlertStatus
├── AlertForm
├── AlertFiltersSummary
└── AlertResults

Consultations
├── ConsultationRow
├── DeadlineBadge
├── FollowButton
└── ConsultationStatus

Account
├── ProfileForm
├── NotificationPreferences
├── SecuritySettings
├── SessionList
└── DangerZone

Shared
├── EmptyState
├── ErrorState
├── LoadingState
├── ConfirmationDialog
├── Toast
└── Pagination
```

------------------------------------------------------------------------

# 20. Acceptance criteria for the redesign

The redesign is successful when a member can complete these tasks
without instruction:

1.  Identify new relevant tenders.
2.  Identify tenders approaching their deadline.
3.  Create an alert.
4.  Understand what an existing alert monitors.
5.  Modify or pause an alert.
6.  Follow a consultation.
7.  Return later and find that consultation.
8.  Change notification preferences.
9.  Update basic account information.
10. Understand whether an action succeeded or failed.

### Usability target

During testing, give a user the tasks without explaining the interface.

Target:

-   **≥ 90% task completion**
-   **0 assistance** for core flows
-   **\< 30 seconds** to locate an existing alert or followed
    consultation
-   **\< 60 seconds** to create a basic alert

These are internal product targets, not claims derived from Google or
Apple.

------------------------------------------------------------------------

# 21. Design principle to keep

> **The member space is not where the user manages MP Maroc. It is where
> MP Maroc manages the user's attention.**

Google and Apple are useful references for making identity, security,
privacy and preferences predictable.

MP Maroc should take that foundation and optimize the authenticated
experience around the user's scarce resource: **attention before a
procurement deadline**.

------------------------------------------------------------------------

# Sources reviewed

Official sources were prioritized.

-   Google Account Help --- *What is a Google Account?*\
    https://support.google.com/accounts/answer/15277265

-   Google Account Help --- *Make your account more secure*\
    https://support.google.com/accounts/answer/46526

-   Google Account Help --- *Find, control & delete the info in your
    Google Account*\
    https://support.google.com/accounts/answer/7660719

-   Google Account Help --- *Manage your Google payment info*\
    https://support.google.com/accounts/answer/9244912

-   Google Account Help --- *Find your purchases, reservations &
    subscriptions*\
    https://support.google.com/accounts/answer/7673989

-   Apple Support --- *Apple Account*\
    https://support.apple.com/apple-account

-   Apple Support --- *Keep your Apple Account secure*\
    https://support.apple.com/guide/personal-safety/keep-your-apple-account-secure-ips7d5628cc5/web

-   Apple Support --- *Check your Apple Account device list*\
    https://support.apple.com/102649

-   Apple Support --- *Two-factor authentication for Apple Account*\
    https://support.apple.com/102660

-   Apple Support --- *Subscriptions and Billing*\
    https://support.apple.com/billing

------------------------------------------------------------------------

**Research date:** 2026-09-01
