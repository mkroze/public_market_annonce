# Moroccan Public-Procurement AWARD Data — Source Availability Research

> Research date: **2026-09-10**. Question: can MP Maroc obtain **award data (winner + amount)** for Moroccan public tenders, joinable to our existing tender records? Resolves P0 #2 / assumption A4 in [`mp-maroc-opportunity-intelligence-spec.md`](./mp-maroc-opportunity-intelligence-spec.md).

## TL;DR
- **Yes — award data (winner + amount) is obtainable and legally public.** The portal (marchespublics.gov.ma) publishes award outcomes per tender via **"Extrait de PV"** (tender-committee minutes) and **"Résultats définitifs"**; publication is **mandatory** under Décret n°2-22-431 (in force 1 Sept 2023).
- **No official API / RSS / bulk export / open-data feed for awards.** It's per-tender HTML + a PDF PV extract, so retrieval = scrape closed consultations + **parse PV PDFs** (occasional OCR). This is joinable to the same consultation objects we already scrape.
- **Open data is a dead end for awards.** data.gov.ma has no award dataset; the Observatoire Marocain de la Commande Publique (OMCP, omcp.tgr.gov.ma) publishes only aggregated PDF statistics; no OCDS adoption found for Morocco.
- **Third-party providers just resell the same portal data** (the friend's tip). Confirmed Moroccan aggregators with award results: **Datao, Novicore, Aljady, Sodipress**. Novicore openly states it crawls marchespublics.gov.ma.
- **Build-vs-buy:** cheapest instant coverage = subscribe to **Datao (~490–790 MAD/mo, offers a Claude MCP)** or **Novicore (free–500 MAD/mo, explicit winner+amount)**. Building it ourselves is feasible (public + mandatory data) but adds PV-PDF parsing on top of our notice scraper.

## Q1 — Official portal (marchespublics.gov.ma / PMMP)
Award data **is** published under "Annonces → Autres annonces", searchable as **"Tous les extraits de PV"** and **"Tous les résultats définitifs"** (also: rapports d'achèvement, rapports de présentation, décisions de résiliation).

The standardized **"Extrait de PV"** model document contains: list of competitors, excluded competitors after examination, arithmetic verification, and the **justification of the attributaire selection** — i.e., winning company + retained amount + bidder count/identity. **"Résultats définitifs"** is the companion framework.

- No API / RSS / export found. Winner & amount typically sit **inside the PDF PV**, not always in structured HTML (field-level placement **unconfirmed** — verify on real samples).
- Completeness depends on each buyer uploading the PV; expect gaps (record-level completeness **unconfirmed**).
- Sources: [marchespublics.gov.ma/pmmp](https://www.marchespublics.gov.ma/pmmp/); [PV-model list PDF (BO N°7222)](https://www.marchespublics.gov.ma/pmmp/download/pdf/1692-23-fr_demat_procedures_pieces_et_documents.pdf); example PVs: [Bank Al-Maghrib](https://www.bkam.ma/content/download/818082/8960351/Extrait%20de%20PV.pdf), [MEM](https://www.mem.gov.ma/Lists/Lst_Appel_Doffres-RH/Attachments/32/Extrait%20de%20pv%20r%C3%A9sultat%20AO%201-2021-DSI.pdf).

## Q2 — Open data
- **data.gov.ma:** no procurement-award dataset (only an IMANOR normative guide PDF). [Search](https://www.data.gov.ma/data/fr/dataset?q=march%C3%A9s+publics).
- **OMCP (omcp.tgr.gov.ma):** created by decree n°2.22.78 (2024), runs an internal BDMP, but publishes only **aggregated statistical reports** (PDF flipbooks) — no per-tender winner/amount, no CSV/JSON/API. [maroc.ma](https://www.maroc.ma/fr/actualites/lobservatoire-marocain-de-la-commande-publique-lance-son-site-internet), [omcp.tgr.gov.ma](https://omcp.tgr.gov.ma/).
- **OCDS / Open Contracting:** no confirmed Morocco implementation (**unconfirmed/absent**).

## Q3 — Third-party / commercial providers

| Provider | URL | Has winner? | Has amount? | Coverage | Access/Pricing | Source of data | Notes |
|---|---|---|---|---|---|---|---|
| **Datao** | datao.ma | Yes | Yes | ~50,000 tenders/yr; "300+ official sources" | Solo **490 MAD/mo**, Pro **790 MAD/mo**; +50 MAD/user | Portal + others (aggregator) | Offers a **Claude MCP** for programmatic search/track — best fit for our stack. |
| **Novicore** | bc.farahtech.ma | **Yes** (soumissionnaire retenu) | **Yes** (montant attribué) | Monitors marchespublics.gov.ma 24/7 | Freemium; 50 / 300 / 500 MAD/mo | **Directly crawls the portal** (self-stated) | Most explicit award-field confirmation; cheapest. |
| **Aljady** | aljady.ma | Yes (competitor analysis, win rates) | Yes (avg amounts) | "Intégralité des AO publiés au Maroc" | Subscription (price not public) | Portal aggregator | Strong analytics layer. |
| **Sodipress** | sodipress.com | Yes ("Résultats d'adjudications") | Partial (amount as filter; per-record unconfirmed) | Morocco + 24 African countries; 44 yrs | Paid (price not disclosed; free trial) | Aggregator | Oldest, broadest geography. |
| **TendersInfo** | tendersinfo.com/morocco-contracts.php | Claims awards (unconfirmed, paywalled) | Unconfirmed | Global | Paid / trial | Sources unconfirmed | Verify before buying. |
| **GlobalTenders** | globaltenders.com/government-tenders-morocco | Lists "Morocco Contract Awards" | Claims bid amounts (MA unconfirmed) | ~5,110 live MA notices | Freemium/paid | Not disclosed | Award depth unconfirmed. |
| **e-marchespublics.com** | e-marchespublics.com/attribution | Yes but **FRANCE ONLY** | Partial | France only | Free account | French portal | **Not relevant** — ruled out. |

Not verified for MA awards (international notice aggregators): TendersOnTime, MoroccoTenders.com, TendersArabia, BidDetail.

## Legality
- Publication of **notices, award results and essential data is legally MANDATORY** under **Décret n°2-22-431** (8 Mar 2023) — flows from the 2011 Constitution's right to information + Law 31.13. [L'Economiste](https://www.leconomiste.com/flash-infos/marches-publics-les-points-importants-du-decret-ndeg2-22-431/), [full decree PDF](https://www.equipement.gov.ma/Ingenierie/Reglementation/Documents/Decret_marches_publics_n_2_22_431_du_09_03_2023_Fr.pdf).
- Company name + amount are corporate/public → low risk. **Redistribution licence / portal CGU + robots policy = unconfirmed** — confirm before large-scale scraping. Named individuals would engage Law 09-08 (CNDP).

## OCR pipeline — cross-border data (Law 09-08 / CNDP) — decided: BUILD, self-host
Build route needs OCR on PV/DCE PDFs. Key finding (2026-09-10):
- **Law 09-08 only restricts transfer of *personal data* (natural persons)**, not corporate data. Company name + ICE + amount = corporate → low risk. But PV/DCE PDFs routinely contain **personal data** (gérant/représentant, signatories, committee members, contacts) → then Art. 43/44 apply.
- **Cross-border transfer of personal data to a non-adequate country needs CNDP prior authorization** (or CNDP-approved SCCs, or express consent). Adequacy list ≈ EU + Switzerland/UK/Canada. **DeepSeek's hosted API is in China (not adequate).** Penalty for violation: up to **300,000 MAD + imprisonment** (Art. 53).
- **Resolution: self-host DeepSeek-OCR.** It's **MIT-licensed, ~6.7 GB, runs on a single ≥16 GB-VRAM GPU** (vLLM/Ollama) — [HF model card](https://huggingface.co/deepseek-ai/DeepSeek-OCR). Running it on our own MO/EU server = **no cross-border transfer → 09-08 issue avoided**, and cheaper than per-page API at volume.
- Fallback ranking if a managed endpoint is ever needed: (1) self-hosted DeepSeek-OCR; (2) EU-hosted OCR API (adequacy); (3) China-hosted API only with pre-send personal-data redaction or a CNDP authorization.
- Caveat: "public source" does **not** exempt personal-data processing under 09-08. Not legal advice — confirm the CNDP route with counsel if self-hosting is ever abandoned.

## Recommendation
**Primary route: scrape the portal's own "Extrait de PV" + "Résultats définitifs" (same pipeline we use for notices) + add PDF text extraction.** It's authoritative, joinable to our tender refs, and avoids per-seat SaaS fees. **Fast-start / benchmark:** trial **Novicore** or **Datao** for a month to confirm field completeness and reverse-benchmark our own coverage (almost certainly what the client's friend uses).

### Verify next
1. Pull 5–10 real Extrait-de-PV / Résultats-définitifs records → confirm exact placement of *attributaire*, *ICE*, *montant TTC*, *nombre de soumissionnaires* (HTML vs PDF) → sets parsing effort.
2. Check portal terms-of-use / robots.txt for scraping + redistribution.
3. Trial Novicore/Datao; compare award coverage vs. our own sample → decide build-vs-buy.
4. Email marchespublics@tgr.gov.ma re: whether OMCP's BDMP will ever expose an API/open dataset.
