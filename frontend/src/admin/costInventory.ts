import type { BillingCycle, CostCategory, CostCurrency } from "./types";

export type InventoryGroup = "Core services" | "Optional integrations" | "Maintenance and operations" | "Planned features";

export interface CostInventoryItem {
  id: string;
  title: string;
  provider: string;
  category: CostCategory;
  billing_cycle: BillingCycle;
  currency: CostCurrency;
  group: InventoryGroup;
  description: string;
  basis: string;
  evidence: string;
  pricingUrl?: string;
}

// Repository inventory, not a claim about live subscriptions. No secrets or
// environment values belong here. Keep this in sync with config and stage specs.
export const COST_INVENTORY: CostInventoryItem[] = [
  {
    id: "render-compute", title: "Render · application hosting", provider: "Render",
    category: "hosting", billing_cycle: "monthly", currency: "USD", group: "Core services",
    description: "Application compute: FastAPI, built React frontend, scraper, and in-process scheduler.",
    basis: "Enter the deployed instance plan. Render is named in repository deployment notes; the live tier and any workspace charges need confirmation.",
    evidence: "Dockerfile; backend/mem_profile.py; DCE extraction design",
    pricingUrl: "https://render.com/pricing",
  },
  {
    id: "render-disk", title: "Render · persistent disk", provider: "Render",
    category: "storage", billing_cycle: "monthly", currency: "USD", group: "Core services",
    description: "Persistent storage for SQLite, cached DCE ZIPs, and extraction recap files.",
    basis: "Enter provisioned disk capacity × the disk rate. Config comments target a 5 GB volume with a 4 GiB cache budget; confirm the actual allocation.",
    evidence: "Dockerfile /app/data; backend/config.py DB_PATH and DCE_CACHE_MAX_BYTES",
    pricingUrl: "https://render.com/docs/disks",
  },
  {
    id: "render-egress", title: "Render · bandwidth and build overages", provider: "Render",
    category: "hosting", billing_cycle: "usage_based", currency: "USD", group: "Core services",
    description: "Usage above hosting allowances: DCE delivery, extraction ZIP transfers, frontend media, and builds.",
    basis: "Enter only separately billed overages after included allowances. Avoid counting them again if already included in the hosting invoice amount.",
    evidence: "backend/main.py document/static responses; frontend/src/assets/demo; Dockerfile",
    pricingUrl: "https://render.com/pricing",
  },
  {
    id: "brevo-email", title: "Brevo · transactional email", provider: "Brevo",
    category: "email", billing_cycle: "monthly", currency: "EUR", group: "Core services",
    description: "SMTP delivery for verification, password resets, alert confirmations, and daily digests.",
    basis: "Enter the actual plan and sending-volume allowance. SMTP is configured locally; subscription tier and production delivery volume are unknown.",
    evidence: ".env.example SMTP settings; backend/emailer.py; backend/digest.py",
    pricingUrl: "https://www.brevo.com/pricing/",
  },
  {
    id: "domain", title: "Domain · registration and renewal", provider: "Domain registrar (confirm)",
    category: "domain", billing_cycle: "yearly", currency: "MAD", group: "Core services",
    description: "Public site domain and email sender domain renewal, if using custom domains.",
    basis: "Enter renewal prices from your registrar. Registrar, ownership, and renewal dates are not defined in this repository. Count a shared domain once.",
    evidence: ".env.example FRONTEND_URL and SMTP_FROM",
  },
  {
    id: "anthropic", title: "Anthropic · legal assistant", provider: "Anthropic",
    category: "ai_api", billing_cycle: "usage_based", currency: "USD", group: "Optional integrations",
    description: "Claude API calls for the authenticated legal-assistant chat.",
    basis: "Budget input, output, thinking, and cache token usage using the model configured in main.py. No key is set in the inspected local environment; production may differ.",
    evidence: "backend/main.py assistant_ask; ANTHROPIC_API_KEY",
    pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
  },
  {
    id: "n8n", title: "n8n · extraction orchestration", provider: "n8n",
    category: "software", billing_cycle: "monthly", currency: "EUR", group: "Optional integrations",
    description: "Orchestrate DCE processing and post structured results to the backend callback.",
    basis: "Choose a cloud subscription OR self-hosted infrastructure and any applicable licence. Include executions, execution storage, backups, and upgrades; do not add cloud and self-hosting as if both are required.",
    evidence: "backend/config.py N8N_EXTRACT_WEBHOOK_URL; DCE extraction design",
    pricingUrl: "https://n8n.io/pricing/",
  },
  {
    id: "ocr-worker", title: "OCR / GPU worker", provider: "OCR compute provider (choose)",
    category: "hosting", billing_cycle: "usage_based", currency: "USD", group: "Optional integrations",
    description: "External French/Arabic document OCR and redaction before model extraction.",
    basis: "Budget worker hours or per-page processing, temporary disk, idle time, and transfers. The design proposes self-hosted GPU OCR; no worker deployment is bundled here.",
    evidence: "docs/superpowers/specs/2026-09-11-dce-extraction-pipeline-design.md",
  },
  {
    id: "openrouter", title: "OpenRouter · document extraction", provider: "OpenRouter",
    category: "ai_api", billing_cycle: "usage_based", currency: "USD", group: "Optional integrations",
    description: "Planned model routing for extraction of structured fields from redacted DCE text.",
    basis: "Budget documents × tokens per document × selected model rates, plus applicable fees and retries. Named in the design; no direct OpenRouter integration is implemented in this app.",
    evidence: "DCE extraction design; backend/dce_extraction.py external webhook contract",
    pricingUrl: "https://openrouter.ai/pricing",
  },
  {
    id: "map-tiles", title: "Map tiles · CARTO / replacement provider", provider: "CARTO / map provider (confirm)",
    category: "software", billing_cycle: "usage_based", currency: "USD", group: "Optional integrations",
    description: "Basemap tiles used by the Morocco map and geographic directory pages.",
    basis: "Check production usage terms and tile volume; record a paid plan only if needed. The code uses public CARTO URLs with OpenStreetMap attribution and no configured paid account.",
    evidence: "frontend/src/components/MoroccoMap.tsx TILE_URLS and attribution",
    pricingUrl: "https://docs.carto.com/faqs/carto-basemaps",
  },
  {
    id: "backups", title: "Backups · off-site storage and restores", provider: "Backup provider (choose)",
    category: "storage", billing_cycle: "monthly", currency: "MAD", group: "Maintenance and operations",
    description: "Consistent SQLite backups, configuration recovery, retained document data, and restore tests.",
    basis: "No off-site backup integration was found. Budget retained GB, transfer/restore charges, and operator time. Check what the hosting plan includes first.",
    evidence: "backend/database.py; Dockerfile persistent volume",
  },
  {
    id: "monitoring", title: "Monitoring · uptime, errors, and logs", provider: "Monitoring provider (choose)",
    category: "monitoring", billing_cycle: "monthly", currency: "MAD", group: "Maintenance and operations",
    description: "External uptime alerts, error tracking, log retention, and pipeline failure notifications.",
    basis: "No dedicated monitoring service is configured. Start with host tools; record any additional monitoring plan separately from hosting.",
    evidence: "backend/scheduler.py logs; admin pipeline logs; no external monitoring SDK found",
  },
  {
    id: "maintenance", title: "Engineering · recurring maintenance", provider: "Maintenance team / contractor",
    category: "other", billing_cycle: "monthly", currency: "MAD", group: "Maintenance and operations",
    description: "Dependency/security updates, portal parser fixes, deployment, backups, incidents, email deliverability, and regression checks.",
    basis: "Enter agreed monthly hours × hourly rate or a retainer. Internal time is a real maintenance cost even when no supplier invoice exists. Exclude new feature development from routine upkeep.",
    evidence: "backend/scraper.py; backend/requirements.txt; frontend/package.json; test suites",
  },
  {
    id: "dev-tools", title: "Development · CI and team tools", provider: "Development tools (confirm)",
    category: "software", billing_cycle: "monthly", currency: "MAD", group: "Maintenance and operations",
    description: "Any paid repository hosting, build minutes, coding tools, and staging services allocated to this project.",
    basis: "Optional team overhead. No paid CI or staging service is configured here. Allocate shared subscriptions only once and only for this project's share.",
    evidence: "package.json scripts; Dockerfile; no CI deployment configuration found",
  },
  {
    id: "video-generation", title: "Video · generation and rendering", provider: "Video provider (choose)",
    category: "ai_api", billing_cycle: "usage_based", currency: "USD", group: "Planned features",
    description: "Generate the planned tender recap reels from extracted DCE information.",
    basis: "Budget per video/minute, rendering attempts, and any audio costs if introduced. Provider is undecided; no generation API is currently wired up.",
    evidence: "frontend/src/admin/stages/registry.ts video-generation planned stage",
  },
  {
    id: "video-storage", title: "Video · storage and delivery", provider: "Media storage / CDN (choose)",
    category: "storage", billing_cycle: "usage_based", currency: "USD", group: "Planned features",
    description: "Store and serve future generated tender videos.",
    basis: "Budget retained media GB and playback traffic. If media stays on Render, allocate it within Render disk/egress rather than counting it twice. Existing homepage demo clips already ship with the frontend.",
    evidence: "Planned video stage; frontend/src/assets/demo; Dockerfile static frontend",
  },
  {
    id: "awards", title: "Awards · collection and verification", provider: "Award pipeline (choose)",
    category: "scraping", billing_cycle: "usage_based", currency: "MAD", group: "Planned features",
    description: "Future award/PV PDF collection, occasional OCR, evidence retention, and data-quality review.",
    basis: "Budget incremental compute and review time only. Reuse existing hosting/OCR where possible; do not assume a commercial data subscription or proxy is required.",
    evidence: "scraping/ research probes; registry.ts awards planned stage; award-data research",
  },
  {
    id: "campaigns", title: "Campaigns · additional email volume", provider: "Brevo / campaign provider (confirm)",
    category: "email", billing_cycle: "usage_based", currency: "EUR", group: "Planned features",
    description: "Future award-result campaigns, delivery tracking, and contact-list growth.",
    basis: "Record only incremental campaign costs above the transactional email plan. This stage is planned; there is no separate campaign service configured.",
    evidence: "frontend/src/admin/stages/registry.ts campaigns planned stage",
    pricingUrl: "https://www.brevo.com/pricing/",
  },
  {
    id: "payments", title: "Payments · subscription collection fees", provider: "Bank / payment gateway (choose)",
    category: "other", billing_cycle: "usage_based", currency: "MAD", group: "Planned features",
    description: "Future premium-plan invoice/bank-transfer charges or card payment processing.",
    basis: "The paywall plan proposes manual invoicing first and a CMI-style gateway later. No payment gateway is integrated. Budget actual bank/gateway fees, commissions, refunds, and any merchant setup charge when chosen; keep one-off setup separate.",
    evidence: "docs/paywall-implementation-plan.md payment sequencing",
  },
];

export const INCLUDED_CAPABILITIES = [
  "React frontend + FastAPI API: one Docker deployment; no separate frontend host is required.",
  "SQLite: stored on the application disk; no managed database subscription is configured.",
  "Scraper + scheduler: run inside the backend; no paid scraping API, proxy, or external cron service is configured.",
  "PDF exports and document caching: generated locally; their compute and disk usage belong in hosting/storage.",
  "Cloudflare tunnel: a local development command exists; no paid production Cloudflare plan is configured.",
  "Fonts: Inter loads through a Google Fonts stylesheet; no paid font-service account is configured.",
];
