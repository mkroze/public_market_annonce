# Header Public Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `À propos`, `FAQ`, and `Contact` into the public header navigation without moving legal footer links.

**Architecture:** Keep the change contained in `components/Navbar.tsx`. Reuse the existing `navLinks` rendering for both desktop and mobile, adding three route entries with lucide icons.

**Tech Stack:** React 19, TypeScript, React Router, lucide-react, Tailwind CSS 4, Vite.

## Global Constraints

- Update `components/Navbar.tsx`.
- Add `À propos`, `FAQ`, and `Contact` to the header navigation.
- Keep legal links in the footer only.
- Keep the footer unchanged.
- Preserve the existing theme toggle, logo handling, responsive dropdown, and active-link behavior.

---

### Task 1: Header Public Links

**Files:**
- Modify: `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Consumes: `Link` and `useLocation` from `react-router-dom`; icon components from `lucide-react`.
- Produces: `Navbar` default export with desktop and mobile navigation links for `/tenders`, `/about`, `/faq`, and `/contact`.

- [ ] **Step 1: Verify the missing links fail the acceptance check**

Run:

```bash
rg -n 'to: "/(about|faq|contact)"' frontend/src/components/Navbar.tsx
```

Expected: no matches before implementation.

- [ ] **Step 2: Update Navbar imports and links**

In `frontend/src/components/Navbar.tsx`, change the lucide import to include `Building2`, `CircleHelp`, and `Mail`, then update `navLinks`:

```tsx
import { Search, Menu, Sun, Moon, Building2, CircleHelp, Mail } from "lucide-react";

const navLinks = [
  { to: "/tenders", label: "Toutes les consultations", icon: Search },
  { to: "/about", label: "À propos", icon: Building2 },
  { to: "/faq", label: "FAQ", icon: CircleHelp },
  { to: "/contact", label: "Contact", icon: Mail },
];
```

- [ ] **Step 3: Verify the links are present**

Run:

```bash
rg -n 'to: "/(about|faq|contact)"' frontend/src/components/Navbar.tsx
```

Expected: three matches for `/about`, `/faq`, and `/contact`.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully.
