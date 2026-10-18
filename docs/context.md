# Context — MP Maroc (public procurement platform)

> Paste this into a ChatGPT project as background. It's written for strategy,
> positioning and market-segmentation thinking — not engineering. Product terms
> are kept in French because the product is francophone (Moroccan market).

---

## 1. One-line description

An online platform that aggregates **Moroccan public tenders** ("marchés
publics" / "consultations"), lets businesses **search and filter** them, sends
**alerts before deadlines**, and helps them **prepare a bid**. Domain:
`mp-maroc.com`.

## 2. The market & the problem

- Moroccan public bodies (ministries, communes, régions, public enterprises)
  publish thousands of tenders on the official state portal
  (`marchespublics.gov.ma`). That portal is comprehensive but **hard to monitor
  daily, hard to search well, and unforgiving on deadlines**.
- Businesses that live off public contracts (construction, supplies,
  IT, consulting, services…) miss opportunities simply because nobody on the
  team is watching the portal every morning.
- The pain is **attention + timing**, not access to raw data. The data is
  public; the value is in *filtering it to what's relevant to me* and
  *never missing a deadline*.

We turn a firehose of public data into a **personalized, deadline-aware feed**.

## 3. What the product does (plain language)

- **Catalog** — a searchable, filterable list of current tenders (by
  sector/category, region, city, buyer, deadline, estimated value).
- **Alerts** — the user defines what matters to them (keywords + region +
  category); we notify them by **email** when new matching tenders appear.
- **Saved searches & favorites ("suivi")** — save a search, follow a specific
  tender, track its deadline.
- **Tender detail** — objet, acheteur, lieu, dates, and the official bid
  documents (**DCE** = the downloadable tender dossier), plus contact and
  retrait/dépôt addresses.
- **Directories & stats** — browse by city / region / sector, with a stats
  dashboard and a map, useful for market discovery and SEO.
- **Bid-prep assistant ("Préparer ma candidature")** — a guided flow + an
  AI assistant that helps a business understand and assemble a candidacy
  (the legal/administrative side of bidding).

**The core loop we want every user to repeat:**
`Search → Save search / Create alert → Receive matches → Open tender → Follow → Track deadline → Come back.`

## 4. Who it's for (raw material for segmentation)

The buyer is a **Moroccan business that competes for public contracts**. That's
one label hiding several very different segments. Dimensions worth slicing on:

- **By sector of activity** — travaux/BTP, fournitures (supplies/équipement),
  services, études/conseil, IT. Each has different volume, deadline rhythm, and
  document complexity.
- **By company size / maturity** —
  - *TPE / artisan / auto-entrepreneur*: price-sensitive, bids occasionally,
    needs hand-holding on the candidacy paperwork.
  - *PME établie*: bids regularly, values time saved and not missing deadlines,
    can justify a subscription.
  - *Grande entreprise / bureau d'études*: multiple people, many tenders,
    wants coverage + possibly team features later.
- **By geography** — national vs a firm that only bids in its region
  (Casablanca-Settat, Rabat-Salé-Kénitra, etc.).
- **By role of the person** — the *dirigeant* (owner deciding what to chase),
  the *responsable commercial / chargé d'appels d'offres* (daily monitoring),
  the *assistant admin* (assembling the dossier).
- **By behavior** — occasional bidder (a few tenders/year) vs. professional
  bidder (public contracts are their main revenue channel). The professional
  bidder is the natural paying core.

*Open strategic question:* which segment do we optimize the product and pricing
for first? The professional PME bidder is the most likely to pay; the TPE is the
largest, cheapest-to-acquire, but hardest to monetize.

## 5. How it makes (or will make) money

Model: **freemium → subscription**, with a login required to see the catalog
(registration is the top of the funnel).

- **Free (registered):** browse the catalog, stats/directories, basic tender
  detail, a few favorites, **1 saved search**. Deliberately generous — the
  catalog is the discovery/SEO funnel; locking it down would kill growth.
- **Premium (paid):** **download the DCE**, PDF export, full contact +
  retrait/dépôt addresses, **unlimited alerts & saved searches**, the **AI
  bid-prep assistant**, and the **email digest**.

The strongest "reasons to pay" are the **DCE download** and the **AI
assistant** — those map directly to "I'm actually going to bid on this."

## 6. Constraints that shape strategy (important, non-obvious)

- **Payments in Morocco are the real bottleneck, not the software.** The
  dominant card gateway (**CMI**) has slow merchant onboarding. So the plan is
  to **launch billing manually**: invoice / bank transfer + an admin who
  activates the subscription. This is normal for **B2B** here — annual invoice
  billing is expected — and it lets us start charging now. Self-serve card
  checkout comes later.
- **Invoicing compliance:** Moroccan facture with **TVA 20% + ICE**, and
  GDPR-equivalent data handling. Often a prerequisite before you can even take
  card payments.
- **Language:** the product and market are **French** (Moroccan business
  French). Any messaging, positioning, or copy should assume a francophone
  professional audience.
- **Data freshness & trust:** the value depends on the catalog being current
  and correct. Showing "last updated" and never missing a tender is part of the
  brand promise.
- **Privacy is a selling point, not just compliance:** a user's searches and
  followed tenders reveal their commercial intent. That data is private by
  default. This matters for trust in a competitive B2B setting.

## 7. Product philosophy (useful when reasoning about roadmap)

- The signed-in member area is a **command center for attention before a
  deadline** — not a settings dashboard, not a re-listing of the whole catalog.
  Its job: *"here's what deserves your attention today."*
- Alerts are the main **retention** mechanism. Search/browse is the main
  **acquisition** mechanism (SEO on public data).
- Anything that doesn't feed the core loop (search → alert → follow → bid) or
  basic account management is deprioritized.

## 8. Current stage (as of Sept 2026)

- Core platform exists: catalog, filters, alerts + email digests, member space
  (saved searches, favorites, email verification), stats/directories, and the
  bid-prep assistant.
- Being prepared for launch on the real domain with real data and an admin
  control panel.
- **Paywall is planned but not yet live** — entitlements/tiers designed;
  first monetization will be manual invoice-based activation.

## 9. Good questions to bring to ChatGPT with this context

- Which segment should be the **beachhead**, and what does pricing look like for
  it (per-seat? flat annual? by sector or region coverage)?
- How to position against **just checking the free government portal** — what's
  the crisp value story that justifies paying?
- What's the right **free → paid trigger** (the moment a user hits a wall and
  upgrades)?
- Acquisition: is it **SEO on public tender data**, direct sales to PME, sector
  associations/fédérations, or partnerships?
- Which **adjacent revenue** could exist later (team/organization accounts, bid
  document services, data/analytics for suppliers)?
