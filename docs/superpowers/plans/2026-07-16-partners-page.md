# Partners Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public French-language `/partenaires` page displaying the 17 probed official data portals and the 10 strategic partner institutions, without implying that every listed portal is already integrated or that listed institutions endorse the product.

**Architecture:** Static typed data file (`src/lib/partners.ts`) curated from `scraping/source_inventory.jsonl` and `chat/partner_mapping.md`, rendered by a new `Partners.tsx` page, wired into the router and the navbar "more links" dropdown. No backend changes.

**Tech Stack:** React 19, TypeScript, react-router-dom 7, Tailwind 4 with the app's custom `academic` theme CSS variables, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-16-partners-page-design.md`

## Global Constraints

- All user-facing copy is French; match existing tone (see `src/pages/Procedures.tsx`).
- Style with the theme CSS variables (`--color-crimson`, `--color-charcoal`, `--color-slate`, `--color-ivory`, `--color-ivory-dim`, `--color-ivory-deep`, `--color-border-subtle`, `--color-border`, `--color-gold`) — do NOT use stock daisyUI component classes; follow the card/badge markup patterns of `Procedures.tsx`.
- The frontend has NO unit-test framework (only oxlint + tsc + vite build). Do not add one. Each task's verification cycle is: `npx tsc -b --noEmit` (typecheck), `npx oxlint src` (lint), and for the final task `npm run build`.
- Internal probe judgments (scrape feasibility, WAF blockers, CAPTCHA, robots notes, backlog status, partnership tactics) must NOT appear in the page or data file.
- Public copy must distinguish between integrated data sources and referenced official portals. PMMP is the only currently integrated source in this page model.
- If `scraping/source_inventory.jsonl` is not available in a clean checkout, commit/regenerate it or copy the verified public facts into the implementation notes before implementing the static data file.
- All commands below run from `frontend/`: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Data file `src/lib/partners.ts`

**Files:**
- Create: `frontend/src/lib/partners.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DataSource`, `StrategicPartner` interfaces; `DATA_SOURCES: DataSource[]` (17 entries), `STRATEGIC_PARTNERS: StrategicPartner[]` (10 entries), `TIER_LABELS: Record<1 | 2 | 3, string>`, `STATUS_LABELS: Record<DataSource["status"], string>`. Task 2 imports all four values by these exact names.

- [x] **Step 1: Write the file**

Create `frontend/src/lib/partners.ts` with exactly this content:

```ts
// Données de référence sur l'écosystème du produit.
// Sources : chat/partner_mapping.md (partenaires stratégiques) et
// scraping/source_inventory.jsonl (inventaire des portails publics officiels,
// reconnaissance du 15 juillet 2026). Ce fichier est la projection publique
// de ces sources : les évaluations internes n'y figurent pas.

export interface DataSource {
  id: string;
  name: string;
  operator: string;
  url: string;
  tier: 1 | 2 | 3;
  domains: string[];
  description: string;
  status: "integre" | "reference" | "acces_institutionnel";
}

export interface StrategicPartner {
  name: string;
  role: string;
  tags: string[];
  url: string;
}

export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "Sources principales",
  2: "Portails administratifs",
  3: "Finances & régulation",
};

export const STATUS_LABELS: Record<DataSource["status"], string> = {
  integre: "Intégré",
  reference: "Référencé",
  acces_institutionnel: "Accès institutionnel",
};

export const DATA_SOURCES: DataSource[] = [
  {
    id: "pmmp",
    name: "Portail Marocain des Marchés Publics",
    operator: "Trésorerie Générale du Royaume (TGR)",
    url: "https://www.marchespublics.gov.ma/",
    tier: 1,
    domains: ["Marchés publics"],
    description:
      "Plateforme officielle d'échange entre acheteurs publics et entreprises : consultations en cours, avis d'attribution, extraits de PV, rapports d'achèvement, programmes prévisionnels et entreprises exclues.",
    status: "integre",
  },
  {
    id: "data_gov_ma",
    name: "Portail National des Données Ouvertes",
    operator: "Agence de Développement du Digital (ADD)",
    url: "https://www.data.gov.ma/",
    tier: 1,
    domains: ["Données ouvertes", "Statistiques"],
    description:
      "Catalogue national de données ouvertes : plus de 660 jeux de données publiés par 48 institutions publiques, accessibles via une API documentée.",
    status: "reference",
  },
  {
    id: "sgg_bo",
    name: "Bulletin Officiel (SGG)",
    operator: "Secrétariat Général du Gouvernement",
    url: "https://www.sgg.gov.ma/BulletinOfficiel.aspx",
    tier: 1,
    domains: ["Juridique"],
    description:
      "Le Bulletin Officiel du Royaume : lois, décrets, règlements, conventions et annonces légales, avec recherche et téléchargement des bulletins.",
    status: "reference",
  },
  {
    id: "adala_justice",
    name: "Adala — Portail juridique",
    operator: "Ministère de la Justice",
    url: "https://adala.justice.gov.ma/",
    tier: 1,
    domains: ["Juridique"],
    description:
      "Portail juridique du Ministère de la Justice : textes de loi, dahirs, arrêtés, circulaires et références de jurisprudence.",
    status: "reference",
  },
  {
    id: "directinfo_ompic",
    name: "Directinfo",
    operator: "OMPIC",
    url: "https://www.directinfo.ma/",
    tier: 1,
    domains: ["Entreprises"],
    description:
      "Registre central du commerce : informations légales et financières sur les entreprises marocaines et baromètre de création d'entreprises.",
    status: "acces_institutionnel",
  },
  {
    id: "hcp",
    name: "Haut-Commissariat au Plan",
    operator: "Haut-Commissariat au Plan",
    url: "https://www.hcp.ma/",
    tier: 1,
    domains: ["Statistiques"],
    description:
      "Statistiques nationales de référence : recensements (RGPH), comptes nationaux, bases de données, indicateurs ODD et publications.",
    status: "reference",
  },
  {
    id: "ancfcc",
    name: "ANCFCC",
    operator: "Agence Nationale de la Conservation Foncière, du Cadastre et de la Cartographie",
    url: "https://www.ancfcc.gov.ma/",
    tier: 2,
    domains: ["Foncier", "Procédures"],
    description:
      "Catalogue des services fonciers et cadastraux : certificats de propriété, plans cadastraux, vérification de documents et référentiel des prix.",
    status: "reference",
  },
  {
    id: "chikaya",
    name: "Chikaya",
    operator: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    url: "https://www.chikaya.ma/",
    tier: 2,
    domains: ["Réclamations"],
    description:
      "Portail national des réclamations : statistiques publiques de traitement et taxonomie des administrations et services concernés.",
    status: "reference",
  },
  {
    id: "rokhas",
    name: "Rokhas",
    operator: "Plateforme nationale des autorisations",
    url: "https://rokhas.ma/",
    tier: 2,
    domains: ["Autorisations", "Urbanisme"],
    description:
      "Plateforme des permis et autorisations : urbanisme et autorisations d'activités économiques.",
    status: "acces_institutionnel",
  },
  {
    id: "portnet",
    name: "PortNet",
    operator: "PortNet S.A.",
    url: "https://www.portnet.ma/",
    tier: 2,
    domains: ["Commerce extérieur"],
    description:
      "Guichet unique national des formalités du commerce extérieur : procédures d'import/export, licences et services de la communauté portuaire.",
    status: "reference",
  },
  {
    id: "emploi_public",
    name: "Emploi-public.ma",
    operator: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    url: "https://www.emploi-public.ma/",
    tier: 2,
    domains: ["Emploi public"],
    description:
      "Annonces de recrutement du secteur public : concours, résultats, convocations et guides du candidat.",
    status: "reference",
  },
  {
    id: "lof_budget",
    name: "LOF — Direction du Budget",
    operator: "Ministère de l'Économie et des Finances",
    url: "https://lof.finances.gov.ma/fr",
    tier: 3,
    domains: ["Budget"],
    description:
      "Lois de finances par année, budgets ministériels, budgets citoyens, lois de règlement et statistiques des finances publiques.",
    status: "reference",
  },
  {
    id: "cour_des_comptes",
    name: "Cour des Comptes",
    operator: "Cour des Comptes",
    url: "https://www.courdescomptes.ma/",
    tier: 3,
    domains: ["Audit"],
    description:
      "Rapports annuels, rapports sur l'exécution des lois de finances et rapports thématiques de la juridiction supérieure de contrôle des finances publiques.",
    status: "reference",
  },
  {
    id: "conseil_concurrence",
    name: "Conseil de la Concurrence",
    operator: "Conseil de la Concurrence",
    url: "https://conseil-concurrence.ma/",
    tier: 3,
    domains: ["Concurrence"],
    description:
      "Avis consultatifs, décisions de contrôle des concentrations, études sectorielles et rapports annuels du régulateur de la concurrence.",
    status: "reference",
  },
  {
    id: "dgi_tax",
    name: "Direction Générale des Impôts",
    operator: "Direction Générale des Impôts",
    url: "https://www.tax.gov.ma/",
    tier: 3,
    domains: ["Fiscalité"],
    description:
      "Guides fiscaux, procédures pour les contribuables, formulaires et actualités fiscales.",
    status: "acces_institutionnel",
  },
  {
    id: "adii_douane",
    name: "Administration des Douanes (ADII)",
    operator: "Administration des Douanes et Impôts Indirects",
    url: "https://www.douane.gov.ma/",
    tier: 3,
    domains: ["Douane", "Commerce extérieur"],
    description:
      "Réglementation douanière, tarifs et nomenclature, circulaires et procédures d'import/export.",
    status: "acces_institutionnel",
  },
  {
    id: "office_changes",
    name: "Office des Changes",
    operator: "Office des Changes",
    url: "https://www.oc.gov.ma/",
    tier: 3,
    domains: ["Changes", "Commerce extérieur"],
    description:
      "Réglementation des changes, instructions et circulaires, séries statistiques et base de données des échanges extérieurs.",
    status: "reference",
  },
];

export const STRATEGIC_PARTNERS: StrategicPartner[] = [
  {
    name: "Trésorerie Générale du Royaume (TGR)",
    role: "Opératrice de l'écosystème du portail des marchés publics et acteur central de l'exécution de la dépense publique.",
    tags: ["Légitimité officielle", "Accès plateforme"],
    url: "https://www.tgr.gov.ma/",
  },
  {
    name: "Portail Marocain des Marchés Publics (PMMP)",
    role: "Plateforme d'échange commune entre acheteurs publics et fournisseurs : le cœur de la donnée marchés publics.",
    tags: ["Données marchés", "Alignement produit"],
    url: "https://www.marchespublics.gov.ma/pmmp/",
  },
  {
    name: "Ministère de l'Économie et des Finances",
    role: "Politique de la commande publique, finances publiques, délais de paiement et transparence budgétaire.",
    tags: ["Finances publiques", "Sponsor institutionnel"],
    url: "https://www.finances.gov.ma/",
  },
  {
    name: "Ministère de la Transition Numérique et de la Réforme de l'Administration",
    role: "Administration numérique, simplification administrative et dématérialisation de la commande publique.",
    tags: ["E-gouvernement", "Simplification"],
    url: "https://www.mmsp.gov.ma/",
  },
  {
    name: "Agence de Développement du Digital (ADD)",
    role: "Institution publique en charge de la transformation digitale, de l'interopérabilité et de la stratégie numérique nationale.",
    tags: ["Transformation digitale", "Interopérabilité"],
    url: "https://www.add.gov.ma/",
  },
  {
    name: "Ministère de l'Intérieur / DGCT / INDH",
    role: "Communes, provinces et régions : la commande publique territoriale et les projets de développement local.",
    tags: ["Territorial", "Développement local"],
    url: "https://www.indh.ma/",
  },
  {
    name: "Commission Nationale de la Commande Publique (CNCP)",
    role: "Interprétation du droit des marchés publics, réclamations et voies de recours.",
    tags: ["Confiance juridique", "Recours"],
    url: "https://www.marchespublics.gov.ma/pmmp/textereg.html?lang=fr&rubrique6=",
  },
  {
    name: "Maroc PME",
    role: "Accompagnement des TPE et PME : préparation à la commande publique et programmes de croissance.",
    tags: ["PME", "Formation"],
    url: "https://marocpme.gov.ma/",
  },
  {
    name: "CGEM",
    role: "Principale organisation patronale du Maroc : distribution vers le secteur privé et retours des entreprises.",
    tags: ["Distribution B2B", "Réseau"],
    url: "https://www.cgem.ma/",
  },
  {
    name: "FNBTP",
    role: "Fédération Nationale du Bâtiment et des Travaux Publics : le premier secteur de la commande publique.",
    tags: ["BTP", "Fournisseurs"],
    url: "https://www.fnbtp.ma/",
  },
];
```

- [x] **Step 2: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src`
Expected: both exit 0, no errors. (An "unused export" style warning is acceptable at this stage since the page consuming it comes in Task 2.)

- [x] **Step 3: Commit**

```bash
git add src/lib/partners.ts
git commit -m "feat: add partners and data-sources reference data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Page component `src/pages/Partners.tsx`

**Files:**
- Create: `frontend/src/pages/Partners.tsx`

**Interfaces:**
- Consumes: `DATA_SOURCES`, `STRATEGIC_PARTNERS`, `TIER_LABELS`, `STATUS_LABELS`, and type `DataSource` from `../lib/partners` (Task 1).
- Produces: default export `Partners` React component (no props). Task 3 imports it as `import Partners from "./pages/Partners";`.

- [x] **Step 1: Write the page**

Create `frontend/src/pages/Partners.tsx` with exactly this content:

```tsx
import { Handshake, ExternalLink, Database, Landmark } from "lucide-react";
import {
  DATA_SOURCES,
  STRATEGIC_PARTNERS,
  TIER_LABELS,
  STATUS_LABELS,
  type DataSource,
} from "../lib/partners";

const STATUS_STYLES: Record<DataSource["status"], string> = {
  integre: "bg-[var(--color-crimson)] text-white",
  reference: "bg-[var(--color-ivory-deep)] text-[var(--color-charcoal)]",
  acces_institutionnel:
    "border border-[var(--color-gold)] text-[var(--color-charcoal)] bg-[var(--color-ivory)]",
};

const TIERS: (1 | 2 | 3)[] = [1, 2, 3];

export default function Partners() {
  return (
    <div className="px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Handshake className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Partenaires & Sources de données
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Cette plateforme intègre les données du portail officiel des marchés publics et cartographie
          d'autres sources institutionnelles utiles à la transparence administrative.
        </p>
      </div>

      {/* Sources de données officielles */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[var(--color-crimson)]" />
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
            Sources de données officielles
          </h2>
        </div>

        {TIERS.map((tier) => (
          <div key={tier}>
            <p className="label-academic font-sans text-xs uppercase tracking-wider text-[var(--color-slate)] mb-3">
              {TIER_LABELS[tier]}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DATA_SOURCES.filter((s) => s.tier === tier).map((s) => (
                <div
                  key={s.id}
                  className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-[var(--color-charcoal)]">
                        {s.name}
                      </h3>
                      <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">
                        {s.operator}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded font-sans text-xs font-medium shrink-0 ${STATUS_STYLES[s.status]}`}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="font-sans text-sm text-[var(--color-slate)] leading-relaxed">
                    {s.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                    {s.domains.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]"
                      >
                        {d}
                      </span>
                    ))}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sans text-xs text-[var(--color-crimson)] hover:underline ml-auto"
                    >
                      Portail officiel <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Partenaires stratégiques */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Landmark size={18} className="text-[var(--color-crimson)]" />
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
            Partenaires stratégiques
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STRATEGIC_PARTNERS.map((p) => (
            <div
              key={p.name}
              className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-5 flex flex-col gap-3"
            >
              <h3 className="font-display text-base font-bold text-[var(--color-charcoal)]">
                {p.name}
              </h3>
              <p className="font-sans text-sm text-[var(--color-slate)] leading-relaxed">{p.role}</p>
              <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-ivory-deep)] font-sans text-xs text-[var(--color-charcoal)]"
                  >
                    {t}
                  </span>
                ))}
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-sans text-xs text-[var(--color-crimson)] hover:underline ml-auto"
                >
                  Site officiel <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-4">
        Les données intégrées proviennent de portails publics officiels. Les autres sources sont
        référencées pour clarifier l'écosystème institutionnel et renvoient vers les sites originaux.
        La mention d'une institution ne vaut pas endossement de cette plateforme par celle-ci.
      </p>
    </div>
  );
}
```

- [x] **Step 2: Typecheck and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src`
Expected: both exit 0, no errors.

- [x] **Step 3: Commit**

```bash
git add src/pages/Partners.tsx
git commit -m "feat: add partners page component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Route and navbar wiring

**Files:**
- Modify: `frontend/src/App.tsx` (import block lines 5–26, routes block around line 70)
- Modify: `frontend/src/components/Navbar.tsx` (lucide import lines 2–6, `moreLinks` lines 35–41)

**Interfaces:**
- Consumes: `Partners` default export from `./pages/Partners` (Task 2).
- Produces: route `/partenaires`; navbar entry `{ to: "/partenaires", label: "Partenaires", icon: Handshake }`.

- [x] **Step 1: Add route in App.tsx**

In `frontend/src/App.tsx`, add to the import block (after `import Favorites from "./pages/Favorites";`):

```tsx
import Partners from "./pages/Partners";
```

And add inside `<Routes>` (after the `/favorites` route):

```tsx
              <Route path="/partenaires" element={<Partners />} />
```

- [x] **Step 2: Add navbar link**

In `frontend/src/components/Navbar.tsx`, add `Handshake` to the lucide-react import:

```tsx
import {
  LayoutDashboard, Search, BarChart3, MapPin, Map, Layers,
  CreditCard, BookOpen, Calculator, Scale, Bell, Heart, LogIn, LogOut, User, Menu,
  Sun, Moon, Sparkles, Handshake,
} from "lucide-react";
```

And add to `moreLinks` (after the Calculateur entry):

```tsx
    { to: "/partenaires", label: "Partenaires", icon: Handshake },
```

- [x] **Step 3: Typecheck, lint and build**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npx tsc -b --noEmit && npx oxlint src && npm run build`
Expected: all exit 0; vite build completes without errors.

- [x] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Navbar.tsx
git commit -m "feat: wire /partenaires route and navbar link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Visual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: the running app with Tasks 1–3 merged.
- Produces: confirmation that the page renders correctly; no code.

- [x] **Step 1: Start the frontend dev server**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npm run dev` (background). The backend is not needed for this page.

- [x] **Step 2: Check the page**

Open `http://localhost:5173/partenaires` (browser tool or screenshot). Verify:
- Header "Partenaires & Sources de données" renders.
- Three tier groups ("Sources principales" with 6 cards, "Portails administratifs" with 5 cards, "Finances & régulation" with 6 cards) = 17 source cards total.
- PMMP card shows the "Intégré" badge; Directinfo, Rokhas, DGI and Douane cards show "Accès institutionnel"; the other 12 show "Référencé".
- No public copy says or implies that all 17 portals are already integrated.
- No public copy mentions scrape feasibility, WAF, CAPTCHA, robots, blockers, internal backlog status or partnership tactics.
- No public copy says or implies that referenced institutions endorse the product or that a partnership already exists.
- "Partenaires stratégiques" section shows 10 cards.
- The navbar "more" dropdown contains "Partenaires" and navigating via it works.
- Spot-check two external links (e.g. PMMP, HCP) point to the correct official URLs.

- [x] **Step 3: Stop the dev server**

Kill the background dev-server process.
```

---

## Self-Review Notes

- Spec coverage: data file (Task 1), page with tier grouping/status badges/attribution note (Task 2), route + navbar (Task 3), verification incl. mobile-visible nav path (Task 4). Out-of-scope items untouched. ✓
- No placeholders; all code complete. ✓
- Names consistent across tasks: `DATA_SOURCES`, `STRATEGIC_PARTNERS`, `TIER_LABELS`, `STATUS_LABELS`, `Partners`, `/partenaires`, `Handshake`. ✓
- Status counts: 1 integre + 4 acces_institutionnel + 12 reference = 17. ✓
