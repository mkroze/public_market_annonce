# Operating and maintenance cost audit

Audited against repository configuration, application code, and the DCE extraction design on 2026-10-18. The actionable inventory is in **Admin → Costs** (`/admin/costs`). Its source is [`frontend/src/admin/costInventory.ts`](../frontend/src/admin/costInventory.ts).

## What can be established

The repository identifies cost drivers, but does not establish a production invoice total. Render tiers, provisioned resources, account-level subscriptions, actual token usage, invoice taxes, and contractor rates are not available here. Local environment configuration is not proof of production configuration. No prices have been guessed or automatically added to the expense ledger.

The Costs tab contains 19 inventory items. Each opens a form with provider, purpose, category, suggested currency/cycle, and budgeting notes prefilled. The amount remains blank. Saving uses the existing authenticated, audited cost API; merely viewing the list does not create expense records. Suggested currency and cycle must be checked against the invoice.

## Current application footprint

| Cost | Repository evidence | What to enter |
| --- | --- | --- |
| Render application compute | Dockerfile; Render-specific notes in `backend/mem_profile.py` and extraction spec | Actual instance plan; allocated workspace fees if applicable |
| Persistent disk | `/app/data` volume; `backend/config.py` | Provisioned GB, not just used GB; comments target 5 GB but do not prove deployed capacity |
| Hosting usage overages | ZIP downloads, external extraction archive fetches, static media, Docker builds | Only separately billed bandwidth/build overages, after included allowances |
| Brevo transactional SMTP | `.env.example`; `backend/emailer.py`, `backend/digest.py`; local SMTP settings are present | Actual sending plan, volume, and add-ons |
| Domain renewal, if custom domains are used | `FRONTEND_URL` and sender-domain settings | Registrar invoice and renewal date; a shared site/email domain is counted once |

The Docker image serves React and FastAPI together. SQLite, the scraper, the scheduler, PDF creation, and the DCE cache run within this footprint. There is no separate managed database, paid scraper API, external cron subscription, or frontend hosting requirement in the current architecture. Extra replicas or a future database migration would be new infrastructure decisions.

[Render persistent disks](https://render.com/docs/disks) preserve application files across restarts. [Outbound traffic](https://render.com/docs/outbound-bandwidth) has plan allowances and potential overages. Enter the actual [Render invoice](https://render.com/pricing), separating line items only if they are not already included in a single recorded total. The same rule applies to the [Brevo plan](https://www.brevo.com/pricing/).

## Optional integrations and the extraction stack

| Cost | Implementation state | Budget driver |
| --- | --- | --- |
| Anthropic legal assistant | API handler implemented; local API key is unset; production state unknown | Calls × input/output/thinking/cache token usage at the configured model's rates |
| n8n orchestration | Backend webhook dispatch and callback implemented; no n8n deployment bundled | Cloud execution plan **or** self-host compute/storage/licensing as applicable |
| OCR/redaction worker | External service proposed in the extraction design; no worker implementation/deployment bundled | Pages/documents, GPU/CPU hours, idle time, scratch disk, transfer, quality checks |
| OpenRouter extraction | Named in the design; no direct app integration, expected in external workflow | Selected model's tokens, long-document chunking, retries, and applicable fees |
| Map tiles | Public CARTO basemap URLs and OpenStreetMap attribution in `MoroccoMap.tsx` | Confirm production usage terms and traffic; paid tiles only if required |

The legal assistant and document extraction are distinct model workloads. Do not substitute an OpenAI invoice simply because test fixtures use “OpenAI” as an example provider: the live legal-assistant code calls Anthropic. No production OpenAI integration was found.

[n8n Cloud](https://n8n.io/pricing/) bills by plan/executions; [self-hosting](https://docs.n8n.io/hosting/) moves infrastructure and operations responsibility to the team. The workflow does not make OCR compute or [external model usage](https://openrouter.ai/pricing) disappear. Check [CARTO basemap usage terms](https://docs.carto.com/faqs/carto-basemaps) for the intended commercial deployment.

## Operations and human maintenance

Four further inventory entries cover costs that may have no existing supplier contract:

- **Off-site backups and restore tests:** consistent SQLite backups, retention, transfers, credentials/configuration recovery, and operator time. No off-site backup job or provider is configured in the repository.
- **Monitoring and alerting:** external uptime/error alerts and retained logs if the host's tools are insufficient. No dedicated external monitoring SDK was found.
- **Recurring engineering:** dependency and security updates, deployment checks, portal HTML/parser changes, scraper failures, email deliverability, storage cleanup, restore tests, incident response, and regression testing. Enter monthly hours × an agreed rate or a maintenance retainer.
- **Development overhead:** only the project's allocated share of paid coding tools, repository/CI usage, or staging infrastructure. No paid CI or staging deployment is specified here. These are team choices, not mandatory application subscriptions.

The Cloudflare tunnel commands are local development conveniences. No paid production Cloudflare plan is specified. Existing React/Python libraries run within the application; they are not separate hosted-service invoices.

## Upcoming features

The admin stage registry explicitly marks video generation, award collection, and campaigns as planned. The paywall plan also proposes future payment collection. Five inventory entries capture these costs:

1. **Video generation/rendering:** provider undecided; budget output minutes/videos and regeneration attempts. No generation API is integrated yet.
2. **Video storage/delivery:** retained media and playback traffic. Use incremental Render storage/egress or a separate media provider, without counting the same resources twice. Existing homepage demo videos are already bundled static assets.
3. **Award collection/verification:** incremental PDF scraping, occasional OCR, storage, and human data review. Research probes exist; there is no operational award collection stage or required commercial data contract yet.
4. **Campaign email volume:** extra sends, contacts, and tracking only when implemented. Reuse Brevo allowances where appropriate rather than automatically adding a second full email subscription.
5. **Payment collection:** the [paywall plan](paywall-implementation-plan.md) proposes invoice/bank-transfer activation first and a card gateway later. No gateway is integrated. Budget bank/gateway fees, transaction commissions, refunds, and any separate merchant setup costs from an actual offer; no provider pricing or availability is assumed here.

## Calculating the whole monthly cost

For each currency separately:

```text
Base monthly operations
  = hosting compute + persistent disk + email plan
  + annual domain renewals / 12
  + separately billed hosting overages
  + backup/monitoring plans
  + maintenance hours × hourly rate
  + allocated development overhead

Optional assistant and extraction
  = Claude usage + n8n cloud OR self-hosting
  + OCR worker usage + extraction model usage
  + any required map-provider plan

Future incremental costs
  = video generation + extra media storage/delivery
  + award pipeline resources/review + campaign email overages
  + payment collection fees
```

Apply actual taxes, card/FX fees, and a chosen exchange rate if reporting a consolidated MAD total. One-off setup or feature development belongs in a separate implementation budget; it can be amortized explicitly if desired.

Useful usage estimates before purchasing plans:

- DCE egress ≈ average ZIP size × user downloads and external extraction fetches.
- OCR compute ≈ documents × average processing time, plus idle/failed/retried work.
- Extraction models ≈ input/output tokens per document × processed documents, including chunking and retries.
- Email sends ≈ account emails + confirmations + verified users receiving matching daily digests + future campaigns.
- Video usage ≈ successful videos plus regeneration attempts; delivery traffic depends on plays and file size.

The existing ledger's **Current month** card is period-based expense reporting. **Annualized recurring** extrapolates saved monthly/yearly rows and excludes usage-based costs; it is not a complete forward budget, and repeated historical invoices can be counted as repeated recurring rows. Use the formulas above for planning rather than treating that card as a subscription detector.

An exact maintenance total remains **unknown until the applicable prices, volumes, and maintenance rate are entered**. Free allowances or internal unpaid work should be recorded deliberately in the budget; missing prices must not be interpreted as zero.
