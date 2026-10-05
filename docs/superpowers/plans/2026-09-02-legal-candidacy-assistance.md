# Legal Candidacy Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Epic 1 legal and candidacy assistance surface with an account-only AI assistant and public static preparation tools.

**Architecture:** Route-level React pages are restored under `frontend/src/pages`, using the surviving domain modules in `frontend/src/lib/procedures.ts` and `frontend/src/lib/compliance.ts`. `/assistant` is gated with the existing `RequireAuth` wrapper; static guidance routes remain public and link through `/guide`.

**Tech Stack:** Vite 8, React 19, React Router 7, TypeScript 6, Tailwind 4, DaisyUI 5, lucide-react, Vitest + Testing Library for focused frontend behavior tests.

## Global Constraints

- The public catalog remains the primary launch surface; "Consultations" stays first in navigation.
- `/assistant` must be account-only.
- `/procedures`, `/procedures/:slug`, `/recours`, `/eligibility`, and `/guide` remain public static guidance.
- Do not restore stats, geographic directories, map pages, partners, blog, pricing, or calculator in this epic.
- Do not change backend files.
- Use current institutional tokens, `PageShell`, `Breadcrumbs`, `shadow-card`, rounded-xl panels, navy primary actions, and lucide icons.
- Avoid one-off raw hex colors in restored page components.
- Ensure visible focus states, keyboard-reachable controls, and no horizontal scroll at 375px.
- Surface `askAssistant()` errors inside the assistant sidebar; do not crash the page when `ANTHROPIC_API_KEY` is missing.

---

## File Structure

- `frontend/src/test/setup.ts`: Testing Library setup and browser API shims.
- `frontend/src/pages/__tests__/legal-candidacy-routes.test.tsx`: Route/auth/navigation tests for the restored surface.
- `frontend/src/pages/__tests__/eligibility-recours.test.tsx`: Interaction tests for eligibility verdict and recours deadline behavior.
- `frontend/src/components/__tests__/legal-tooltip.test.tsx`: Tooltip rendering coverage for known annotation keys.
- `frontend/src/App.tsx`: Lazy-load restored pages and add public/protected routes.
- `frontend/src/components/Navbar.tsx`: Add the "Preparer" link to `/guide`.
- `frontend/src/pages/CandidacyAssistant.tsx`: Account-only candidacy workflow page.
- `frontend/src/pages/Procedures.tsx`: Public procedure directory.
- `frontend/src/pages/ProcedureDetail.tsx`: Public procedure detail.
- `frontend/src/pages/Eligibility.tsx`: Public eligibility checker.
- `frontend/src/pages/Recours.tsx`: Public recours deadline helper.
- `frontend/src/pages/Guide.tsx`: Public preparation hub without calculator.
- `frontend/src/pages/TenderDetail.tsx`: Attach selected `LegalTooltip` annotations.
- `frontend/src/components/LegalAssistantSidebar.tsx`: Polish focus/touch/responsive classes only if needed.
- `frontend/src/components/ComplianceChecklist.tsx`: Polish focus/touch/responsive classes only if needed.
- `frontend/src/components/LegalTooltip.tsx`: Polish focus/touch/responsive classes only if needed.
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.ts`, `frontend/tsconfig.app.json`: Add the small test harness.

---

### Task 1: Add Frontend Test Harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.app.json`
- Create: `frontend/src/test/setup.ts`
- Test: `frontend/src/components/__tests__/legal-tooltip.test.tsx`

**Interfaces:**
- Consumes: existing `LegalTooltip` component and `FIELD_ANNOTATIONS`.
- Produces: `npm run test -- --run` command usable by later tasks.

- [ ] **Step 1: Install test dependencies**

Run from `frontend`:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` and `package-lock.json` include the new dev dependencies.

- [ ] **Step 2: Add test script and Vitest types**

Update `frontend/package.json` scripts to include:

```json
"test": "vitest"
```

Update `frontend/tsconfig.app.json` compiler options:

```json
"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 3: Configure Vitest in Vite**

Change `frontend/vite.config.ts` to:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
```

- [ ] **Step 4: Create setup file**

Create `frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
});
```

- [ ] **Step 5: Write failing tooltip test**

Create `frontend/src/components/__tests__/legal-tooltip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import LegalTooltip from "../LegalTooltip";

describe("LegalTooltip", () => {
  it("renders the legal reference and summary for a known field", () => {
    render(<LegalTooltip field="procedure" />);

    expect(screen.getByRole("button", { name: /aide juridique/i })).toBeInTheDocument();
    expect(screen.getByText("Art. 19-20")).toBeInTheDocument();
    expect(screen.getByText(/mode de passation/i)).toBeInTheDocument();
  });

  it("renders nothing for an unknown field", () => {
    const { container } = render(<LegalTooltip field="unknown-field" />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 6: Run test to verify harness**

Run:

```bash
npm run test -- --run src/components/__tests__/legal-tooltip.test.tsx
```

Expected: PASS after the harness is configured. If TypeScript rejects `test` in `vite.config.ts`, install `vitest` correctly and re-run `npm install`.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.app.json frontend/src/test/setup.ts frontend/src/components/__tests__/legal-tooltip.test.tsx
git commit -m "test(frontend): add legal surface test harness"
```

---

### Task 2: Restore Public Routes, Protected Assistant Route, And Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Test: `frontend/src/pages/__tests__/legal-candidacy-routes.test.tsx`

**Interfaces:**
- Consumes: React Router `Routes`, existing `RequireAuth`, and `useAuth`.
- Produces: public routes `/guide`, `/procedures`, `/procedures/:slug`, `/eligibility`, `/recours`; protected route `/assistant`; nav link `{ to: "/guide", label: "Préparer" }`.

- [ ] **Step 1: Write failing route and navigation tests**

Create `frontend/src/pages/__tests__/legal-candidacy-routes.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import App from "../../App";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getTender: vi.fn(),
  };
});

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  localStorage.clear();
  return render(<App />);
}

describe("legal candidacy routes", () => {
  it("shows the preparation nav link", async () => {
    renderAt("/tenders");

    const links = await screen.findAllByRole("link", { name: /préparer/i });
    expect(links.some((link) => link.getAttribute("href") === "/guide")).toBe(true);
  });

  it("keeps static legal guidance public", async () => {
    renderAt("/procedures");

    expect(await screen.findByRole("heading", { name: /procédures de passation/i })).toBeInTheDocument();
  });

  it("redirects signed-out users away from the assistant", async () => {
    renderAt("/assistant");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/login");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- --run src/pages/__tests__/legal-candidacy-routes.test.tsx
```

Expected: FAIL because `/guide`, `/procedures`, and `/assistant` are not wired and the nav has no "Préparer" link.

- [ ] **Step 3: Add route-level lazy imports**

In `frontend/src/App.tsx`, add:

```ts
const CandidacyAssistant = lazy(() => import("./pages/CandidacyAssistant"));
const Guide = lazy(() => import("./pages/Guide"));
const Procedures = lazy(() => import("./pages/Procedures"));
const ProcedureDetail = lazy(() => import("./pages/ProcedureDetail"));
const Eligibility = lazy(() => import("./pages/Eligibility"));
const Recours = lazy(() => import("./pages/Recours"));
```

Keep `AdminApp` lazy-loaded.

- [ ] **Step 4: Add public and protected routes**

In `PublicLayout`, add routes before the legal static pages:

```tsx
<Route
  path="/assistant"
  element={
    <RequireAuth>
      <Suspense fallback={authSpinner}>
        <CandidacyAssistant />
      </Suspense>
    </RequireAuth>
  }
/>
<Route
  path="/guide"
  element={
    <Suspense fallback={authSpinner}>
      <Guide />
    </Suspense>
  }
/>
<Route
  path="/procedures"
  element={
    <Suspense fallback={authSpinner}>
      <Procedures />
    </Suspense>
  }
/>
<Route
  path="/procedures/:slug"
  element={
    <Suspense fallback={authSpinner}>
      <ProcedureDetail />
    </Suspense>
  }
/>
<Route
  path="/eligibility"
  element={
    <Suspense fallback={authSpinner}>
      <Eligibility />
    </Suspense>
  }
/>
<Route
  path="/recours"
  element={
    <Suspense fallback={authSpinner}>
      <Recours />
    </Suspense>
  }
/>
```

- [ ] **Step 5: Add the nav link**

In `frontend/src/components/Navbar.tsx`, import `Scale`:

```ts
import { Search, Menu, LogIn, LogOut, UserRound, Bell, ShieldCheck, Settings, Scale } from "lucide-react";
```

Update `navLinks`:

```ts
const navLinks = [
  { to: "/tenders", label: "Consultations", icon: Search, public: true },
  { to: "/guide", label: "Préparer", icon: Scale, public: true },
  { to: "/alerts", label: "Alertes", icon: Bell, public: false },
].filter((link) => link.public || user);
```

- [ ] **Step 6: Run test to verify it still fails only because pages are missing**

Run:

```bash
npm run test -- --run src/pages/__tests__/legal-candidacy-routes.test.tsx
```

Expected: FAIL with module resolution errors for restored pages if they do not exist yet.

- [ ] **Step 7: Commit after Task 3 page files make route tests pass**

Do not commit this task alone if the missing page imports break the build. Commit with Task 3 after pages exist.

---

### Task 3: Restore And Reskin Public Static Legal Pages

**Files:**
- Create: `frontend/src/pages/Procedures.tsx`
- Create: `frontend/src/pages/ProcedureDetail.tsx`
- Create: `frontend/src/pages/Eligibility.tsx`
- Create: `frontend/src/pages/Recours.tsx`
- Create: `frontend/src/pages/Guide.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`
- Test: `frontend/src/pages/__tests__/eligibility-recours.test.tsx`
- Test: `frontend/src/pages/__tests__/legal-candidacy-routes.test.tsx`

**Interfaces:**
- Consumes: `PROCEDURES`, `STAGES_COMMON`, `ELIGIBILITY_QUESTIONS`, `RECOURSE_MOTIFS`, `getProcedure` from `frontend/src/lib/procedures.ts`.
- Produces: public components `Procedures`, `ProcedureDetail`, `Eligibility`, `Recours`, and `Guide`.

- [ ] **Step 1: Write failing interaction tests**

Create `frontend/src/pages/__tests__/eligibility-recours.test.tsx`:

```tsx
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Eligibility from "../Eligibility";
import Recours from "../Recours";
import ProcedureDetail from "../ProcedureDetail";
import Guide from "../Guide";

describe("Eligibility", () => {
  it("marks the user non eligible when a liquidation exclusion applies", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Eligibility />
      </MemoryRouter>,
    );

    const question = screen.getByText(/êtes-vous en liquidation judiciaire/i);
    const row = question.parentElement?.parentElement;
    expect(row).toBeInstanceOf(HTMLElement);
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Oui" }));

    expect(screen.getByText(/non éligible/i)).toBeInTheDocument();
  });
});

describe("Recours", () => {
  it("calculates administrative and CNCP deadlines from the reference date", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Recours />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/date de publication du résultat/i), "2026-09-01");

    expect(screen.getByText(/réclamation au maître d'ouvrage/i)).toBeInTheDocument();
    expect(screen.getByText(/6 septembre 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/8 septembre 2026/i)).toBeInTheDocument();
  });
});

describe("ProcedureDetail", () => {
  it("shows an unknown procedure fallback", () => {
    render(
      <MemoryRouter initialEntries={["/procedures/inconnue"]}>
        <Routes>
          <Route path="/procedures/:slug" element={<ProcedureDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/procédure introuvable/i)).toBeInTheDocument();
  });
});

describe("Guide", () => {
  it("does not restore the old calculator section", () => {
    render(
      <MemoryRouter>
        <Guide />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /guide/i })).toBeInTheDocument();
    expect(screen.queryByText(/calculateurs/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- --run src/pages/__tests__/eligibility-recours.test.tsx src/pages/__tests__/legal-candidacy-routes.test.tsx
```

Expected: FAIL because the restored page modules do not exist yet.

- [ ] **Step 3: Recover old page sources**

Use git history as the source of truth:

```bash
git show f9e0fef^:frontend/src/pages/Procedures.tsx > /tmp/Procedures.tsx
git show f9e0fef^:frontend/src/pages/ProcedureDetail.tsx > /tmp/ProcedureDetail.tsx
git show f9e0fef^:frontend/src/pages/Eligibility.tsx > /tmp/Eligibility.tsx
git show f9e0fef^:frontend/src/pages/Recours.tsx > /tmp/Recours.tsx
git show f9e0fef^:frontend/src/pages/Guide.tsx > /tmp/Guide.tsx
```

Then apply the content into the matching `frontend/src/pages/*.tsx` files using patches, not shell redirection into the repo.

- [ ] **Step 4: Reskin common page shells**

For each restored public page:

- Replace outer wrappers such as `px-4 sm:px-6 py-8` with `PageShell` where the page has a single page title.
- Keep dense operational sections as direct children, not nested inside extra wrapper cards.
- Use `rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card`.
- Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]` to custom buttons.
- Keep lucide icons already present.

For `Guide.tsx`, remove the calculator import and section:

```ts
// Do not import Calculator for Epic 1.
const SECTIONS = [
  { id: "procedures", label: "Procédures", icon: Scale },
  { id: "eligibilite", label: "Éligibilité", icon: ShieldCheck },
  { id: "assistant", label: "Assistant", icon: Sparkles },
  { id: "recours", label: "Recours", icon: Gavel },
] as const;
```

The assistant area in `Guide.tsx` should use `useAuth()`:

```tsx
const { user } = useAuth();
```

Signed-in users see a link to `/assistant`; signed-out users see links to `/login` and `/register` with `state={{ from: "/assistant" }}`.

- [ ] **Step 5: Fix Recours label accessibility**

The test uses `getByLabelText`, so ensure the date input has an `id` and matching label:

```tsx
<label htmlFor="recours-reference-date" className="label-academic block mb-1.5">
  {dateLabel}
</label>
<input id="recours-reference-date" type="date" ... />
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm run test -- --run src/pages/__tests__/eligibility-recours.test.tsx src/pages/__tests__/legal-candidacy-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx frontend/src/pages/Procedures.tsx frontend/src/pages/ProcedureDetail.tsx frontend/src/pages/Eligibility.tsx frontend/src/pages/Recours.tsx frontend/src/pages/Guide.tsx frontend/src/pages/__tests__/legal-candidacy-routes.test.tsx frontend/src/pages/__tests__/eligibility-recours.test.tsx
git commit -m "feat(legal): restore public preparation guidance"
```

---

### Task 4: Restore Account-Only Candidacy Assistant

**Files:**
- Create: `frontend/src/pages/CandidacyAssistant.tsx`
- Modify: `frontend/src/components/LegalAssistantSidebar.tsx`
- Modify: `frontend/src/components/ComplianceChecklist.tsx`
- Test: `frontend/src/pages/__tests__/candidacy-assistant.test.tsx`

**Interfaces:**
- Consumes: `getTender`, `askAssistant`, `toTenderPath`, `PROCEDURES`, `getProcedure`, `assessPriceRisk`, `checkProcedureThresholds`, `guessPrestationType`, `guessProcedureSlug`, `parseMoney`, `ComplianceChecklist`, `LegalTooltip`, `LegalAssistantSidebar`.
- Produces: default export `CandidacyAssistant({ embedded = false }: { embedded?: boolean })`.

- [ ] **Step 1: Write failing assistant tests**

Create `frontend/src/pages/__tests__/candidacy-assistant.test.tsx`:

```tsx
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidacyAssistant from "../CandidacyAssistant";
import { getTender } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getTender: vi.fn(),
    askAssistant: vi.fn().mockResolvedValue({ answer: "Réponse juridique test" }),
  };
});

describe("CandidacyAssistant", () => {
  it("prefills tender procedure, prestation type, and estimate from the tender query", async () => {
    vi.mocked(getTender).mockResolvedValue({
      id: "AO-1",
      reference: "AO-1",
      title: "Travaux de voirie",
      entity: "Commune",
      entity_code: "",
      sector_code: "",
      sector_name: "",
      category: "Travaux",
      deadline: "",
      publication_date: "",
      status: "active",
      procedure_type: "Appel d'offres ouvert simplifié",
      location: "Rabat",
      detail_url: "",
      scraped_at: "",
      details: {
        objet: "Travaux de voirie",
        acheteur: "Commune",
        annonce_type: "",
        procedure: "Appel d'offres ouvert simplifié",
        categorie: "Travaux",
        allotissement: "",
        lieu_execution: "",
        estimation: "900 000,00 DH",
        domaines: "",
        adresse_retrait: "",
        adresse_depot: "",
        lieu_ouverture: "",
        caution_provisoire: "",
        qualifications: "",
        agrements: "",
        variante: "",
        reunion: "",
        visite_lieux: "",
        contact: "",
        documents_url: "",
        dce_url: "",
        avis_url: "",
        reserved_pme: "",
        prix_plans: "",
      },
    });
    window.history.pushState({}, "", "/assistant?tender=AO-1");

    render(
      <MemoryRouter initialEntries={["/assistant?tender=AO-1"]}>
        <CandidacyAssistant />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("900000")).toBeInTheDocument();
    expect(screen.getByText(/AO-1/)).toBeInTheDocument();
  });

  it("shows an excessive price alert when the offer is more than 20 percent above estimate", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CandidacyAssistant />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/estimation du coût/i), "1000000");
    await user.type(screen.getByLabelText(/votre offre/i), "1250000");

    expect(screen.getByText(/offre excessive/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- --run src/pages/__tests__/candidacy-assistant.test.tsx
```

Expected: FAIL because `CandidacyAssistant.tsx` does not exist.

- [ ] **Step 3: Recover the old assistant source**

Use:

```bash
git show f9e0fef^:frontend/src/pages/CandidacyAssistant.tsx > /tmp/CandidacyAssistant.tsx
```

Apply the recovered content into `frontend/src/pages/CandidacyAssistant.tsx` using a patch.

- [ ] **Step 4: Reskin assistant layout and labels**

Keep the old behavior, but align classes with the current shell:

- outer non-embedded wrapper: `px-4 py-8 sm:px-6 sm:py-10`
- inner max width: `mx-auto max-w-6xl`
- page panels: `rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-card`
- inputs: `institutional-control w-full px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`
- primary buttons: `btn btn-primary`
- secondary links/buttons: `btn btn-outline`

Ensure labels have `htmlFor` and inputs/selects have matching `id` values for:

- `assistant-procedure`
- `assistant-estimation`
- `assistant-offer`
- `assistant-prestation-type`

- [ ] **Step 5: Polish sidebar and checklist focus states**

In `LegalAssistantSidebar.tsx`, add focus-visible classes to open, close, suggestion, and send buttons:

```tsx
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]
```

In `ComplianceChecklist.tsx`, add the same focus-visible classes to checklist item buttons and keep the progress width stable.

- [ ] **Step 6: Run assistant tests**

Run:

```bash
npm run test -- --run src/pages/__tests__/candidacy-assistant.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run route tests**

Run:

```bash
npm run test -- --run src/pages/__tests__/legal-candidacy-routes.test.tsx
```

Expected: PASS, including signed-out redirect for `/assistant`.

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/CandidacyAssistant.tsx frontend/src/components/LegalAssistantSidebar.tsx frontend/src/components/ComplianceChecklist.tsx frontend/src/pages/__tests__/candidacy-assistant.test.tsx
git commit -m "feat(legal): restore account candidacy assistant"
```

---

### Task 5: Attach Tender Detail Legal Tooltips

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`
- Test: `frontend/src/pages/__tests__/tender-detail-tooltips.test.tsx`

**Interfaces:**
- Consumes: `LegalTooltip` with field keys `procedure`, `montant`, `caution-provisoire`, and `qualifications`.
- Produces: legal annotation affordances on selected tender detail labels.

- [ ] **Step 1: Write failing tooltip integration test**

Create `frontend/src/pages/__tests__/tender-detail-tooltips.test.tsx`:

```tsx
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import TenderDetail from "../TenderDetail";
import { getTender } from "../../lib/api";

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "test@example.com", name: "Test", plan: "pro" } }),
}));

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    getTender: vi.fn(),
    downloadDce: vi.fn(),
    downloadPdf: vi.fn(),
  };
});

describe("TenderDetail legal tooltips", () => {
  it("renders legal help affordances for procedure, estimate, caution, and qualifications", async () => {
    vi.mocked(getTender).mockResolvedValue({
      id: "AO-1",
      reference: "AO-1",
      title: "Travaux",
      entity: "Commune",
      entity_code: "",
      sector_code: "",
      sector_name: "",
      category: "Travaux",
      deadline: "2026-10-01",
      publication_date: "",
      status: "active",
      procedure_type: "Appel d'offres ouvert",
      location: "Rabat",
      detail_url: "",
      scraped_at: "",
      details: {
        objet: "Travaux",
        acheteur: "Commune",
        annonce_type: "",
        procedure: "Appel d'offres ouvert",
        categorie: "Travaux",
        allotissement: "",
        lieu_execution: "Rabat",
        estimation: "1 000 000 DH",
        domaines: "",
        adresse_retrait: "",
        adresse_depot: "",
        lieu_ouverture: "",
        caution_provisoire: "20 000 DH",
        qualifications: "Qualification demandée",
        agrements: "",
        variante: "",
        reunion: "",
        visite_lieux: "",
        contact: "",
        documents_url: "",
        dce_url: "",
        avis_url: "",
        reserved_pme: "",
        prix_plans: "",
      },
      signals: {
        estimation: { value: "1 000 000 DH", status: "detected", source: "detail", confidence: "high" },
        caution: { value: "20 000 DH", status: "detected", source: "detail", confidence: "high" },
        plan_price: { value: null, status: "missing", source: "none", confidence: "none" },
        dce_available: { value: false, status: "missing", source: "none", confidence: "none" },
        applications_count: { value: null, status: "missing", source: "none", confidence: "none" },
        market_price: { value: null, status: "missing", source: "none", confidence: "none" },
      },
    });

    render(
      <MemoryRouter initialEntries={["/tenders/AO-1"]}>
        <Routes>
          <Route path="/tenders/:id" element={<TenderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const helpButtons = await screen.findAllByRole("button", { name: /aide juridique/i });
    expect(helpButtons.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Art. 19-20")).toBeInTheDocument();
    expect(screen.getByText("Art. 30")).toBeInTheDocument();
    expect(screen.getByText("Art. 28")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- --run src/pages/__tests__/tender-detail-tooltips.test.tsx
```

Expected: FAIL because `TenderDetail` does not render these tooltip buttons.

- [ ] **Step 3: Import LegalTooltip**

In `frontend/src/pages/TenderDetail.tsx`, add:

```ts
import LegalTooltip from "../components/LegalTooltip";
```

- [ ] **Step 4: Extend SignalCard and Field interfaces**

Update signatures:

```tsx
function SignalCard({ icon: Icon, title, value, legalField }: {
  icon: typeof Building2;
  title: string;
  value: DisplayValue | undefined;
  legalField?: string;
}) {
```

```tsx
function Field({ label, value, legalField }: { label: string; value: string; legalField?: string }) {
```

Render tooltips next to labels:

```tsx
<p className="label-academic flex items-center gap-1">
  {title}
  {legalField && <LegalTooltip field={legalField} />}
</p>
```

```tsx
<p className="label-academic mb-1 flex items-center gap-1">
  {label}
  {legalField && <LegalTooltip field={legalField} />}
</p>
```

- [ ] **Step 5: Pass legal field keys at selected call sites**

Update signal cards:

```tsx
<SignalCard icon={Banknote} title="Budget estimé" value={signals?.estimation} legalField="montant" />
<SignalCard icon={Shield} title="Caution" value={signals?.caution} legalField="caution-provisoire" />
```

For procedure, attach tooltip to the procedure badge or add a compact label near the header metadata:

```tsx
<span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold font-sans rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)]">
  {procedure}
  <LegalTooltip field="procedure" />
</span>
```

Update the qualifications field:

```tsx
{d?.qualifications && <Field label="Qualifications requises" value={d.qualifications} legalField="qualifications" />}
```

- [ ] **Step 6: Run tooltip integration test**

Run:

```bash
npm run test -- --run src/pages/__tests__/tender-detail-tooltips.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run all frontend tests**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/TenderDetail.tsx frontend/src/pages/__tests__/tender-detail-tooltips.test.tsx
git commit -m "feat(legal): annotate tender detail fields"
```

---

### Task 6: Final Visual And Production Verification

**Files:**
- Modify only if verification reveals defects in files touched by Tasks 1-5.

**Interfaces:**
- Consumes: restored routes and test harness.
- Produces: verified Epic 1 surface ready for review.

- [ ] **Step 1: Run full automated checks**

Run from `frontend`:

```bash
npm run test -- --run
npm run lint
npm run build
```

Expected: all commands PASS. If `npm run lint` reports pre-existing unrelated findings, capture the exact output and separate them from Epic 1 changes.

- [ ] **Step 2: Start the dev server**

Run from the repo root:

```bash
npm run dev:frontend
```

Expected: Vite serves the app, usually at `http://localhost:5173`.

- [ ] **Step 3: Browser smoke routes**

Open and visually inspect:

- `http://localhost:5173/guide`
- `http://localhost:5173/procedures`
- `http://localhost:5173/procedures/appel-offres-ouvert`
- `http://localhost:5173/eligibility`
- `http://localhost:5173/recours`
- `http://localhost:5173/assistant`
- one real tender detail route from the catalog

Expected:

- `/assistant` redirects signed-out users to `/login`.
- public legal pages render without horizontal scroll at 375px and desktop widths.
- guide has no calculator section.
- custom buttons show visible focus states.
- sidebar fits within mobile viewport when opened by a signed-in user.
- tender detail shows legal help affordances only on the selected fields.

- [ ] **Step 4: Verify signed-in assistant behavior**

With a valid local token or by logging in:

- open `/assistant`
- open `/assistant?tender=<known-tender-id>`
- change estimate and offer values
- toggle checklist items
- open the legal sidebar and ask a short question

Expected:

- tender values prefill when a valid tender id exists
- threshold and price-risk alerts update
- checklist state persists after reload
- if backend lacks `ANTHROPIC_API_KEY`, the sidebar shows the backend error and the page remains usable

- [ ] **Step 5: Fix verification defects with tests first**

For any defect found, add or update the smallest failing test in the relevant test file, run it to verify failure, patch the production code, then re-run the test and full build.

- [ ] **Step 6: Commit verification fixes**

If fixes were needed:

```bash
git add frontend
git commit -m "fix(legal): polish candidacy assistance restore"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 7: Final status**

Report:

- commits created
- automated commands run and results
- visual smoke routes checked
- any remaining operational caveat, especially `ANTHROPIC_API_KEY` on Render

---

## Self-Review

- Spec coverage: all approved routes, auth split, guide behavior, tooltip scope, no-backend constraint, reskin rules, and verification requirements are represented in tasks.
- Placeholder scan: this plan intentionally avoids TBD/TODO language and gives concrete file paths, commands, and expected outcomes.
- Type consistency: restored page exports are default React components; route imports use `React.lazy`; tests use React Router and Testing Library consistently.
- Scope check: the old calculator, stats, directories, blog, pricing, and marketing pages stay out of scope.
