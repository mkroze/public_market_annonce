# Tender Detail Normalization and Brand Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-refresh tender detail experience that renders clean decision fields from messy stored source data and applies a proper logo system using the existing colors.

**Architecture:** Backend code creates a normalized `display` and `signals` contract from stored base/detail fields, with source and confidence metadata. The tender detail API returns raw fields plus the normalized contract without triggering a live scrape. The frontend renders the new contract first, with a compact KPI strip and a collapsed raw-source drawer.

**Tech Stack:** Python 3/FastAPI/SQLite/aiosqlite/unittest for backend; React 19/Vite/TypeScript/Tailwind/daisyUI/lucide-react for frontend; SVG assets for logo variants.

## Global Constraints

- Do not automatically refresh or re-scrape source data when the detail page opens.
- Do not overwrite raw scraped fields with normalized values.
- Do not present inferred application counts or market prices as authoritative unless the source is explicit.
- Do not redesign the entire app navigation or color palette.
- Do not create a government-looking emblem or anything that could imply official state affiliation.
- Keep the existing palette: crimson primary, ivory background, charcoal text, gold accent.
- The detail page should still be useful when only the base `tenders` row exists.
- Raw source data must remain accessible for audit/debugging.

---

## File Structure

- Create `backend/tender_display.py`: pure normalization and regex extraction helpers. No database access.
- Create `backend/test_tender_display.py`: unit tests for cleanup, de-duplication, money parsing, candidate counts, and base-only fallback.
- Modify `backend/main.py`: stop detail API from lazily scraping; join stored `tender_details`; attach `display` and `signals`.
- Modify `backend/test_tender_routes.py`: add route/API behavior tests for no-refresh normalized detail responses.
- Modify `frontend/src/lib/types.ts`: add `DisplayValue`, `TenderDisplay`, and `TenderSignals` interfaces.
- Modify `frontend/src/pages/TenderDetail.tsx`: render decision-first header, KPI strip, grouped requirements, operational details, and raw drawer from the normalized contract.
- Create `frontend/src/assets/logo-full.svg`: full mark plus wordmark.
- Create `frontend/src/assets/logo-mark.svg`: compact mark.
- Create `frontend/src/assets/logo-wordmark.svg`: wordmark-only variant.
- Modify `frontend/public/favicon.svg`: use the compact mark.
- Modify `frontend/src/components/Navbar.tsx`: replace `MP` square with the new logo asset.

---

### Task 1: Backend Normalization Module

**Files:**
- Create: `backend/tender_display.py`
- Create: `backend/test_tender_display.py`

**Interfaces:**
- Consumes: raw dictionaries shaped like rows from `tenders` and optional `tender_details`.
- Produces:
  - `build_tender_display(tender: dict, details: dict | None = None) -> dict`
  - `display_value(value, status="detected", source="computed", confidence="medium", raw=None) -> dict`
  - `clean_text(value: object) -> str`
  - `parse_money(text: str) -> float | None`

- [ ] **Step 1: Write failing tests for text cleanup, title de-duplication, and base fallback**

Create `backend/test_tender_display.py`:

```python
import unittest

from tender_display import build_tender_display, clean_text, parse_money


class TenderDisplayTest(unittest.TestCase):
    def test_clean_text_collapses_whitespace_and_trims_punctuation(self):
        self.assertEqual(
            clean_text("  Travaux\\n\\t de voirie  -  "),
            "Travaux de voirie",
        )

    def test_title_removes_trailing_duplicate_commune_when_location_matches(self):
        tender = {
            "reference": "AOO/12",
            "title": "Travaux d'amenagement des voies - Commune de Zegzel",
            "entity": "COMMUNE DE ZEGZEL",
            "location": "BERKANE",
            "procedure_type": "AOO",
            "category": "Travaux",
            "deadline": "15/09/2026 10:00",
        }
        details = {
            "objet": "Travaux d'amenagement des voies - Commune de Zegzel",
            "acheteur": "Commune de Zegzel",
            "lieu_execution": "Commune de Zegzel",
            "estimation": "",
            "caution_provisoire": "",
            "prix_plans": "",
            "dce_url": "",
        }

        result = build_tender_display(tender, details)

        self.assertEqual(result["display"]["title"]["value"], "Travaux d'amenagement des voies")
        self.assertEqual(result["display"]["title"]["source"], "detail")
        self.assertEqual(result["display"]["buyer"]["value"], "Commune de Zegzel")
        self.assertEqual(result["display"]["location"]["value"], "Commune de Zegzel")

    def test_base_tender_only_returns_missing_signal_states(self):
        tender = {
            "reference": "REF-1",
            "title": "Fourniture de mobilier",
            "entity": "Province de Safi",
            "location": "SAFI",
            "procedure_type": "AOO",
            "category": "Fournitures",
            "deadline": "20/09/2026 09:00",
            "detail_url": "https://example.test/detail",
        }

        result = build_tender_display(tender, None)

        self.assertEqual(result["display"]["title"]["value"], "Fourniture de mobilier")
        self.assertEqual(result["display"]["buyer"]["value"], "Province de Safi")
        self.assertEqual(result["signals"]["estimation"]["status"], "missing")
        self.assertEqual(result["signals"]["caution"]["status"], "missing")
        self.assertEqual(result["signals"]["dce_available"]["value"], False)
        self.assertEqual(result["signals"]["dce_available"]["status"], "missing")

    def test_parse_money_supports_moroccan_formats(self):
        self.assertEqual(parse_money("1 234 567,89 MAD"), 1234567.89)
        self.assertEqual(parse_money("1.234.567,89 DH"), 1234567.89)
        self.assertEqual(parse_money("1234567.89"), 1234567.89)
        self.assertIsNone(parse_money("Non communique"))

    def test_zero_estimation_is_missing_but_zero_plan_price_is_detected(self):
        tender = {
            "reference": "REF-3",
            "title": "Travaux de peinture",
            "entity": "Commune de Test",
            "location": "TEST",
            "procedure_type": "AOO",
            "category": "Travaux",
            "deadline": "20/09/2026 09:00",
        }
        details = {
            "estimation": "0,00 MAD",
            "prix_plans": "0,00 MAD",
        }

        result = build_tender_display(tender, details)

        self.assertEqual(result["signals"]["estimation"]["status"], "missing")
        self.assertEqual(result["signals"]["plan_price"]["status"], "detected")
        self.assertEqual(result["signals"]["plan_price"]["value"], "0,00 MAD")

    def test_candidate_count_requires_explicit_competition_label(self):
        tender = {
            "reference": "REF-4",
            "title": "Article 12 - Fourniture de mobilier",
            "entity": "Province de Safi",
            "location": "SAFI",
            "procedure_type": "AOO",
            "category": "Fournitures",
            "deadline": "20/09/2026 09:00",
        }
        result_without_label = build_tender_display(tender, {"contact": "Article 12 du reglement"})
        result_with_label = build_tender_display(tender, {"contact": "Nombre de plis: 7"})

        self.assertEqual(result_without_label["signals"]["applications_count"]["status"], "missing")
        self.assertEqual(result_with_label["signals"]["applications_count"]["value"], 7)
        self.assertEqual(result_with_label["signals"]["applications_count"]["source"], "regex")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend
.venv/bin/python -m unittest test_tender_display -v
```

Expected: fail with `ModuleNotFoundError: No module named 'tender_display'`.

- [ ] **Step 3: Implement minimal normalization module**

Create `backend/tender_display.py`:

```python
import re
import unicodedata
from typing import Any


MISSING = {
    "value": None,
    "status": "missing",
    "source": "none",
    "confidence": "none",
}


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+(MAD|DH|DHS)\b", r" \1", text, flags=re.IGNORECASE)
    return text.strip(" -–—,;:.")


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", asciiish.lower()).strip()


def display_value(
    value: Any,
    status: str = "detected",
    source: str = "computed",
    confidence: str = "medium",
    raw: str | None = None,
) -> dict:
    payload = {
        "value": value,
        "status": status,
        "source": source,
        "confidence": confidence,
    }
    if raw is not None:
        payload["raw"] = raw
    return payload


def _first_value(*items: tuple[str, str]) -> tuple[str, str]:
    for value, source in items:
        cleaned = clean_text(value)
        if cleaned:
            return cleaned, source
    return "", "none"


def _remove_duplicate_location_suffix(title: str, location: str, buyer: str) -> str:
    cleaned = clean_text(title)
    folded_location = _fold(location)
    folded_buyer = _fold(buyer)
    if not cleaned:
        return cleaned

    patterns = [
        r"\s*[-–—,]\s*commune\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s*[-–—,]\s*province\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s*[-–—,]\s*préfecture\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s+à\s+la\s+commune\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if not match:
            continue
        suffix = match.group(0)
        folded_suffix = _fold(suffix)
        if folded_location and folded_location in folded_suffix:
            return clean_text(cleaned[: match.start()])
        if folded_buyer and folded_buyer in folded_suffix:
            return clean_text(cleaned[: match.start()])
        if folded_suffix.startswith(("commune", "province", "prefecture")):
            return clean_text(cleaned[: match.start()])
    return cleaned


def parse_money(text: str) -> float | None:
    cleaned = clean_text(text)
    match = re.search(r"(\d[\d\s.]*,\d{1,2}|\d[\d\s.]*\.\d{1,2}|\d[\d\s.]*)", cleaned)
    if not match:
        return None
    number = match.group(1).replace(" ", "")
    if "," in number:
        number = number.replace(".", "").replace(",", ".")
    else:
        pieces = number.split(".")
        if len(pieces) > 2:
            number = "".join(pieces)
    try:
        return float(number)
    except ValueError:
        return None


def _detail_text(details: dict | None) -> str:
    if not details:
        return ""
    return " | ".join(clean_text(v) for v in details.values() if clean_text(v))


def _money_signal(primary: str, source: str, raw_text: str, labels: tuple[str, ...], allow_zero: bool = False) -> dict:
    value = clean_text(primary)
    raw = value
    detected_source = source
    if not value and raw_text:
        label_pattern = "|".join(re.escape(label) for label in labels)
        match = re.search(
            rf"(?:{label_pattern})\s*[:\-]?\s*([0-9][0-9\s.,]*(?:MAD|DH|DHS)?)",
            raw_text,
            flags=re.IGNORECASE,
        )
        if match:
            value = clean_text(match.group(1))
            raw = match.group(0)
            detected_source = "regex"
    parsed = parse_money(value)
    if parsed is None or (parsed == 0 and not allow_zero):
        return dict(MISSING)
    return display_value(value, source=detected_source, confidence="high" if detected_source != "regex" else "medium", raw=raw)


def _applications_signal(raw_text: str) -> dict:
    patterns = [
        r"(?:nombre\s+de\s+plis|nombre\s+d'offres|offres\s+reçues|soumissionnaires|concurrents|candidats|dossiers\s+déposés)\s*[:\-]?\s*(\d{1,3})",
        r"(\d{1,3})\s+(?:plis|offres|soumissionnaires|concurrents|candidats|dossiers)\s+(?:reçus|déposés|admis|retenus)",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return display_value(int(match.group(1)), source="regex", confidence="medium", raw=match.group(0))
    return dict(MISSING)


def build_tender_display(tender: dict, details: dict | None = None) -> dict:
    details = details or {}
    title_raw, title_source = _first_value(
        (details.get("objet", ""), "detail"),
        (tender.get("title", ""), "base"),
        (f"Consultation {tender.get('reference', '')}", "computed"),
    )
    buyer, buyer_source = _first_value(
        (details.get("acheteur", ""), "detail"),
        (tender.get("entity", ""), "base"),
    )
    location, location_source = _first_value(
        (details.get("lieu_execution", ""), "detail"),
        (tender.get("location", ""), "base"),
    )
    title = _remove_duplicate_location_suffix(title_raw, location, buyer)
    raw_text = " | ".join(
        clean_text(value)
        for value in [
            tender.get("title", ""),
            tender.get("entity", ""),
            tender.get("location", ""),
            _detail_text(details),
        ]
        if clean_text(value)
    )

    dce_url = clean_text(details.get("dce_url", ""))

    return {
        "display": {
            "title": display_value(title, source=title_source, confidence="high", raw=title_raw),
            "buyer": display_value(buyer, source=buyer_source, confidence="high") if buyer else dict(MISSING),
            "location": display_value(location, source=location_source, confidence="high") if location else dict(MISSING),
            "procedure": display_value(clean_text(details.get("procedure") or tender.get("procedure_type")), source="detail" if details.get("procedure") else "base", confidence="high") if clean_text(details.get("procedure") or tender.get("procedure_type")) else dict(MISSING),
            "category": display_value(clean_text(details.get("categorie") or tender.get("category")), source="detail" if details.get("categorie") else "base", confidence="high") if clean_text(details.get("categorie") or tender.get("category")) else dict(MISSING),
            "deadline": display_value(clean_text(tender.get("deadline")), source="base", confidence="high") if clean_text(tender.get("deadline")) else dict(MISSING),
            "reference": display_value(clean_text(tender.get("reference")), source="base", confidence="high") if clean_text(tender.get("reference")) else dict(MISSING),
        },
        "signals": {
            "estimation": _money_signal(details.get("estimation", "") or tender.get("estimation", ""), "detail" if details.get("estimation") else "base", raw_text, ("Estimation", "Estimation TTC", "montant estimatif", "budget prévisionnel")),
            "caution": _money_signal(details.get("caution_provisoire", ""), "detail", raw_text, ("Caution provisoire", "cautionnement provisoire", "garantie provisoire")),
            "plan_price": _money_signal(details.get("prix_plans", ""), "detail", raw_text, ("Prix d'acquisition des plans",), allow_zero=True),
            "dce_available": display_value(True, source="detail", confidence="high", raw=dce_url) if dce_url else display_value(False, status="missing", source="none", confidence="none"),
            "applications_count": _applications_signal(raw_text),
            "market_price": _money_signal("", "none", raw_text, ("montant du marché", "prix du marché", "montant attribué", "offre retenue"), allow_zero=False),
        },
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd backend
.venv/bin/python -m unittest test_tender_display -v
```

Expected: all tests in `TenderDisplayTest` pass.

- [ ] **Step 5: Commit**

```bash
git add backend/tender_display.py backend/test_tender_display.py
git commit -m "feat: add tender display normalization"
```

---

### Task 2: Backend API Contract Without Detail Refresh

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/test_tender_routes.py`

**Interfaces:**
- Consumes: `build_tender_display(tender: dict, details: dict | None = None) -> dict` from Task 1.
- Produces: `GET /api/tenders/{tender_id}` response with existing raw fields plus `details`, `display`, and `signals`.

- [ ] **Step 1: Write failing tests for no-refresh detail response**

Append to `backend/test_tender_routes.py`:

```python
from unittest.mock import AsyncMock, patch


class TenderDetailApiTest(unittest.IsolatedAsyncioTestCase):
    async def test_get_tender_uses_stored_details_without_scraping(self):
        import main

        class Cursor:
            def __init__(self, row):
                self.row = row

            async def fetchone(self):
                return self.row

        class Db:
            def __init__(self):
                self.calls = []

            async def execute(self, query, params=()):
                self.calls.append((query, params))
                if "FROM tenders WHERE id" in query:
                    return Cursor({
                        "id": "T1",
                        "reference": "REF-1",
                        "title": "Travaux de voirie - Commune de Zegzel",
                        "entity": "COMMUNE DE ZEGZEL",
                        "location": "BERKANE",
                        "procedure_type": "AOO",
                        "category": "Travaux",
                        "deadline": "15/09/2026 10:00",
                        "detail_url": "https://example.test/detail",
                    })
                if "FROM tender_details WHERE tender_id" in query:
                    return Cursor({
                        "tender_id": "T1",
                        "objet": "Travaux de voirie - Commune de Zegzel",
                        "acheteur": "Commune de Zegzel",
                        "lieu_execution": "Commune de Zegzel",
                        "procedure": "Appel d'offres ouvert",
                        "categorie": "Travaux",
                        "estimation": "1 200 000,00 MAD",
                        "caution_provisoire": "20 000,00 MAD",
                        "prix_plans": "0,00 MAD",
                        "dce_url": "https://example.test/dce",
                    })
                return Cursor(None)

            async def close(self):
                pass

        db = Db()
        with patch.object(main, "get_db", AsyncMock(return_value=db)), patch.object(main, "ensure_tender_details", AsyncMock()) as ensure:
            response = await main.get_tender("T1")

        ensure.assert_not_called()
        self.assertEqual(response["details"]["objet"], "Travaux de voirie - Commune de Zegzel")
        self.assertEqual(response["display"]["title"]["value"], "Travaux de voirie")
        self.assertEqual(response["signals"]["estimation"]["status"], "detected")
        self.assertEqual(response["signals"]["dce_available"]["value"], True)

    async def test_get_tender_base_only_still_returns_display_and_signals(self):
        import main

        class Cursor:
            def __init__(self, row):
                self.row = row

            async def fetchone(self):
                return self.row

        class Db:
            async def execute(self, query, params=()):
                if "FROM tenders WHERE id" in query:
                    return Cursor({
                        "id": "T2",
                        "reference": "REF-2",
                        "title": "Fourniture de mobilier",
                        "entity": "Province de Safi",
                        "location": "SAFI",
                        "procedure_type": "AOO",
                        "category": "Fournitures",
                        "deadline": "20/09/2026 09:00",
                        "detail_url": "",
                    })
                if "FROM tender_details WHERE tender_id" in query:
                    return Cursor(None)
                return Cursor(None)

            async def close(self):
                pass

        with patch.object(main, "get_db", AsyncMock(return_value=Db())):
            response = await main.get_tender("T2")

        self.assertNotIn("details", response)
        self.assertEqual(response["display"]["title"]["value"], "Fourniture de mobilier")
        self.assertEqual(response["signals"]["estimation"]["status"], "missing")
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd backend
.venv/bin/python -m unittest test_tender_routes.TenderDetailApiTest -v
```

Expected: fail because `get_tender` still calls `ensure_tender_details` and does not attach `display`/`signals`.

- [ ] **Step 3: Modify API route**

In `backend/main.py`, add the import near the other local imports:

```python
from tender_display import build_tender_display
```

Replace the body of `get_tender` with:

```python
async def get_tender(tender_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,))
    row = await cursor.fetchone()

    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="Not found")

    result = dict(row)

    detail_cursor = await db.execute(
        "SELECT * FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    detail_row = await detail_cursor.fetchone()
    detail = dict(detail_row) if detail_row else None

    await db.close()

    if detail:
        result["details"] = detail

    normalized = build_tender_display(result, detail)
    result["display"] = normalized["display"]
    result["signals"] = normalized["signals"]
    return result
```

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd backend
.venv/bin/python -m unittest test_tender_display test_tender_routes -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/test_tender_routes.py
git commit -m "feat: return normalized tender detail contract"
```

---

### Task 3: Frontend Types and Signal Formatting

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/displayValues.ts`

**Interfaces:**
- Consumes: backend `display` and `signals` keys from Task 2.
- Produces:
  - `DisplayValue`, `TenderDisplay`, `TenderSignals` TypeScript interfaces.
  - `displayText(value: DisplayValue | undefined, missingLabel?: string) -> string`
  - `isDetected(value: DisplayValue | undefined) -> boolean`
  - `signalTone(value: DisplayValue | undefined) -> "strong" | "muted" | "warning"`

- [ ] **Step 1: Add TypeScript interfaces**

In `frontend/src/lib/types.ts`, insert above `export interface TenderDetail`:

```ts
export type DisplayValueStatus = "detected" | "missing" | "not_applicable" | "needs_verification";
export type DisplayValueSource = "base" | "detail" | "regex" | "agent_import" | "computed" | "none";
export type DisplayValueConfidence = "high" | "medium" | "low" | "none";

export interface DisplayValue {
  value: string | number | boolean | null;
  status: DisplayValueStatus;
  source: DisplayValueSource;
  confidence: DisplayValueConfidence;
  raw?: string;
}

export interface TenderDisplay {
  title: DisplayValue;
  buyer: DisplayValue;
  location: DisplayValue;
  procedure: DisplayValue;
  category: DisplayValue;
  deadline: DisplayValue;
  reference: DisplayValue;
}

export interface TenderSignals {
  estimation: DisplayValue;
  caution: DisplayValue;
  plan_price: DisplayValue;
  dce_available: DisplayValue;
  applications_count: DisplayValue;
  market_price: DisplayValue;
}
```

Extend `TenderWithDetails`:

```ts
export interface TenderWithDetails extends Tender {
  details?: TenderDetail;
  display?: TenderDisplay;
  signals?: TenderSignals;
}
```

- [ ] **Step 2: Create display formatting helpers**

Create `frontend/src/lib/displayValues.ts`:

```ts
import type { DisplayValue } from "./types";

export function displayText(value: DisplayValue | undefined, missingLabel = "Non detecte"): string {
  if (!value) return missingLabel;
  if (value.status === "missing") return missingLabel;
  if (value.status === "not_applicable") return "Non applicable";
  if (value.value === null || value.value === undefined || value.value === "") return missingLabel;
  if (typeof value.value === "boolean") return value.value ? "Disponible" : missingLabel;
  return String(value.value);
}

export function isDetected(value: DisplayValue | undefined): boolean {
  return Boolean(value && value.status === "detected" && value.value !== null && value.value !== "");
}

export function signalTone(value: DisplayValue | undefined): "strong" | "muted" | "warning" {
  if (!value || value.status === "missing" || value.status === "not_applicable") return "muted";
  if (value.status === "needs_verification" || value.confidence === "low") return "warning";
  return "strong";
}
```

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build and Vite build complete with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/displayValues.ts
git commit -m "feat: add frontend tender display types"
```

---

### Task 4: Decision-First Tender Detail UI

**Files:**
- Modify: `frontend/src/pages/TenderDetail.tsx`

**Interfaces:**
- Consumes:
  - `TenderWithDetails["display"]`
  - `TenderWithDetails["signals"]`
  - `displayText()`, `isDetected()`, `signalTone()` from Task 3.
- Produces: a detail page with clean header, six KPI cards, grouped requirements, operational details, and collapsed raw source data.

- [ ] **Step 1: Add imports**

In `frontend/src/pages/TenderDetail.tsx`, add icons if missing:

```ts
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  FileText,
  Download,
  Phone,
  Tag,
  Landmark,
  Banknote,
  Shield,
  Users,
  Eye,
  Mail,
  User,
  CheckCircle2,
  HelpCircle,
  Archive,
  Hash,
} from "lucide-react";
```

Add helper imports:

```ts
import { displayText, isDetected, signalTone } from "../lib/displayValues";
import type { DisplayValue } from "../lib/types";
```

- [ ] **Step 2: Add local fallback helpers above the component**

```ts
function rawOrMissing(value: string | undefined | null, missing = "Non detecte"): string {
  return value && value.trim() ? value : missing;
}

function sourceLabel(value: DisplayValue | undefined): string {
  if (!value || value.source === "none") return "";
  if (value.status === "needs_verification") return "A verifier";
  if (value.source === "regex") return "Detecte";
  if (value.source === "agent_import") return "Importe";
  return "";
}
```

- [ ] **Step 3: Add `SignalCard` below `InfoCard`**

```tsx
function SignalCard({ icon: Icon, title, value }: {
  icon: typeof Building2;
  title: string;
  value: DisplayValue | undefined;
}) {
  const tone = signalTone(value);
  const label = sourceLabel(value);
  const toneClass = tone === "strong"
    ? "border-[var(--color-crimson)] text-[var(--color-charcoal)]"
    : tone === "warning"
      ? "border-[var(--color-gold)] text-[var(--color-charcoal)]"
      : "border-[var(--color-border-subtle)] text-[var(--color-slate)]";

  return (
    <div className={`rounded border bg-[var(--color-ivory)] px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={tone === "muted" ? "text-[var(--color-slate)]" : "text-[var(--color-crimson)]"} />
          <p className="label-academic">{title}</p>
        </div>
        {label && <span className="text-[11px] font-sans text-[var(--color-slate)]">{label}</span>}
      </div>
      <p className={`mt-2 font-sans leading-snug ${tone === "strong" ? "text-base font-bold tabular-nums" : "text-sm font-medium"}`}>
        {displayText(value)}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Add `RawSourceDrawer` below `ContactBlock`**

```tsx
function RawSourceDrawer({ tender }: { tender: TenderWithDetails }) {
  const d = tender.details;
  const rows = [
    ["Titre source", tender.title],
    ["Acheteur source", tender.entity],
    ["Lieu source", tender.location],
    ["Reference", tender.reference],
    ["Procedure source", tender.procedure_type],
    ["Objet detail", d?.objet],
    ["Acheteur detail", d?.acheteur],
    ["Lieu execution detail", d?.lieu_execution],
    ["Estimation detail", d?.estimation],
    ["Caution detail", d?.caution_provisoire],
    ["Prix plans detail", d?.prix_plans],
    ["Allotissement", d?.allotissement],
    ["Qualifications", d?.qualifications],
    ["Agrements", d?.agrements],
    ["Contact", d?.contact],
  ].filter(([, value]) => value && String(value).trim());

  if (!rows.length) return null;

  return (
    <details className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)]">
      <summary className="cursor-pointer px-5 py-3 font-sans text-sm font-semibold text-[var(--color-charcoal)]">
        Donnees source
      </summary>
      <div className="divide-y divide-[var(--color-border-subtle)] px-5">
        {rows.map(([label, value]) => (
          <Field key={label} label={label || ""} value={String(value)} />
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 5: Replace derived constants inside `TenderDetail`**

After `const d = tender.details;`, add:

```ts
const display = tender.display;
const signals = tender.signals;
const title = displayText(display?.title, rawOrMissing(d?.objet || tender.title, `Consultation ${tender.reference}`));
const buyer = displayText(display?.buyer, rawOrMissing(d?.acheteur || tender.entity));
const location = displayText(display?.location, rawOrMissing(d?.lieu_execution || tender.location));
const procedure = displayText(display?.procedure, tender.procedure_type || d?.procedure || "Non detecte");
const category = displayText(display?.category, tender.category || d?.categorie || "Non detecte");
const deadlineSignal = display?.deadline || {
  value: tender.deadline,
  status: tender.deadline ? "detected" : "missing",
  source: "base",
  confidence: tender.deadline ? "high" : "none",
} as DisplayValue;
```

- [ ] **Step 6: Replace the header title and metadata usage**

Use these expressions in the existing header:

```tsx
{category !== "Non detecte" && (
  <span className={`inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded ${CATEGORY_COLORS[category] || "bg-base-300"}`}>
    {category}
  </span>
)}
<span className="inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)]">
  {procedure}
</span>
```

Use this `h1`:

```tsx
<h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)] leading-tight">
  {title}
</h1>
```

Use these metadata lines:

```tsx
<span className="flex items-center gap-1.5">
  <Tag size={14} /> {displayText(display?.reference, tender.reference)}
</span>
{buyer !== "Non detecte" && (
  <span className="flex items-center gap-1.5">
    <Building2 size={14} /> {buyer}
  </span>
)}
{location !== "Non detecte" && (
  <span className="flex items-center gap-1.5">
    <MapPin size={14} /> {location}
  </span>
)}
```

- [ ] **Step 7: Replace decision summary cards with the KPI strip**

Place this immediately after the header:

```tsx
<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  <SignalCard icon={Calendar} title="Echeance" value={deadlineSignal} />
  <SignalCard icon={Banknote} title="Budget estime" value={signals?.estimation} />
  <SignalCard icon={Shield} title="Caution" value={signals?.caution} />
  <SignalCard icon={Download} title="DCE" value={signals?.dce_available} />
  <SignalCard icon={Users} title="Applications" value={signals?.applications_count} />
  <SignalCard icon={Landmark} title="Prix marche" value={signals?.market_price} />
</section>
```

Keep the existing beginner checklist below the KPI strip, but change its intro copy to:

```tsx
<p className="mt-1 font-sans text-sm text-[var(--color-slate)]">
  Les donnees detectees peuvent etre incompletes. Verifiez les points critiques dans le DCE avant de preparer une offre.
</p>
```

- [ ] **Step 8: Replace info cards with grouped sections**

Replace the current `InfoCard` grid with:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InfoCard icon={Building2} title="Acheteur public" value={buyer} />
  <InfoCard icon={Landmark} title="Domaine d'activite" value={rawOrMissing(d?.domaines || tender.sector_name)} />
  {isDetected(signals?.plan_price) && <InfoCard icon={Banknote} title="Prix d'acquisition des plans" value={displayText(signals?.plan_price)} highlight />}
  {d?.variante && <InfoCard icon={FileText} title="Variante" value={d.variante} />}
</div>
```

- [ ] **Step 9: Add raw source drawer at the bottom**

Before the closing `</div>` of the main page container, add:

```tsx
<RawSourceDrawer tender={tender} />
```

- [ ] **Step 10: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build and Vite build complete with no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/TenderDetail.tsx
git commit -m "feat: render normalized tender decision page"
```

---

### Task 5: Logo Assets and Navbar Branding

**Files:**
- Create: `frontend/src/assets/logo-full.svg`
- Create: `frontend/src/assets/logo-mark.svg`
- Create: `frontend/src/assets/logo-wordmark.svg`
- Modify: `frontend/public/favicon.svg`
- Modify: `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Consumes: existing CSS variables and approved palette.
- Produces: reusable logo assets and navbar brand rendering.

- [ ] **Step 1: Create `logo-mark.svg`**

Create `frontend/src/assets/logo-mark.svg`:

```xml
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Marches Publics Maroc mark</title>
  <desc id="desc">Abstract tender document mark in crimson, ivory, charcoal, and gold.</desc>
  <rect x="8" y="6" width="42" height="52" rx="4" fill="#FAFAEB" stroke="#81001D" stroke-width="4"/>
  <path d="M40 6L50 16H42C40.8954 16 40 15.1046 40 14V6Z" fill="#C2A95F"/>
  <path d="M20 24H42" stroke="#1B1C14" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 34H42" stroke="#81001D" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 44H32" stroke="#705C1A" stroke-width="4" stroke-linecap="round"/>
  <rect x="44" y="40" width="12" height="12" rx="2" fill="#81001D"/>
  <path d="M47 46H53" stroke="#FAFAEB" stroke-width="2" stroke-linecap="round"/>
  <path d="M50 43V49" stroke="#FAFAEB" stroke-width="2" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Create `logo-full.svg`**

Create `frontend/src/assets/logo-full.svg`:

```xml
<svg width="300" height="64" viewBox="0 0 300 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Marches Publics Maroc</title>
  <desc id="desc">Logo for Marches Publics Maroc.</desc>
  <rect x="8" y="6" width="42" height="52" rx="4" fill="#FAFAEB" stroke="#81001D" stroke-width="4"/>
  <path d="M40 6L50 16H42C40.8954 16 40 15.1046 40 14V6Z" fill="#C2A95F"/>
  <path d="M20 24H42" stroke="#1B1C14" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 34H42" stroke="#81001D" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 44H32" stroke="#705C1A" stroke-width="4" stroke-linecap="round"/>
  <rect x="44" y="40" width="12" height="12" rx="2" fill="#81001D"/>
  <path d="M47 46H53" stroke="#FAFAEB" stroke-width="2" stroke-linecap="round"/>
  <path d="M50 43V49" stroke="#FAFAEB" stroke-width="2" stroke-linecap="round"/>
  <text x="72" y="29" fill="#1B1C14" font-family="Merriweather, Georgia, serif" font-size="20" font-weight="700">Marches Publics</text>
  <text x="72" y="48" fill="#594141" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="600">Maroc</text>
</svg>
```

- [ ] **Step 3: Create `logo-wordmark.svg`**

Create `frontend/src/assets/logo-wordmark.svg`:

```xml
<svg width="230" height="52" viewBox="0 0 230 52" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Marches Publics Maroc wordmark</title>
  <desc id="desc">Wordmark for Marches Publics Maroc.</desc>
  <text x="0" y="24" fill="#1B1C14" font-family="Merriweather, Georgia, serif" font-size="22" font-weight="700">Marches Publics</text>
  <text x="0" y="45" fill="#594141" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="600">Maroc</text>
</svg>
```

- [ ] **Step 4: Replace favicon**

Replace `frontend/public/favicon.svg` with a simplified favicon:

```xml
<svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="6" width="40" height="52" rx="5" fill="#FAFAEB" stroke="#81001D" stroke-width="5"/>
  <path d="M40 6L50 16H42C40.8954 16 40 15.1046 40 14V6Z" fill="#C2A95F"/>
  <path d="M20 25H41" stroke="#1B1C14" stroke-width="5" stroke-linecap="round"/>
  <path d="M20 36H41" stroke="#81001D" stroke-width="5" stroke-linecap="round"/>
  <rect x="42" y="42" width="12" height="12" rx="2" fill="#81001D"/>
</svg>
```

- [ ] **Step 5: Update Navbar import and logo rendering**

In `frontend/src/components/Navbar.tsx`, add:

```ts
import logoFull from "../assets/logo-full.svg";
```

Replace the current brand block inside the `<Link to="/tenders"...>` with:

```tsx
<img
  src={logoFull}
  alt="Marches Publics Maroc"
  className="h-10 w-auto max-w-[190px] shrink-0"
/>
```

- [ ] **Step 6: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build and Vite build complete with no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/assets/logo-full.svg frontend/src/assets/logo-mark.svg frontend/src/assets/logo-wordmark.svg frontend/public/favicon.svg frontend/src/components/Navbar.tsx
git commit -m "feat: add brand logo assets"
```

---

### Task 6: Final Verification

**Files:**
- Read: `docs/superpowers/specs/2026-08-08-tender-detail-normalization-brand-design.md`
- Read: changed files from Tasks 1-5

**Interfaces:**
- Consumes: all committed task outputs.
- Produces: verified implementation ready for review.

- [ ] **Step 1: Run backend unit tests**

Run:

```bash
cd backend
.venv/bin/python -m unittest test_tender_display test_tender_routes test_v1_api_surface -v
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build and Vite build complete with no errors.

- [ ] **Step 3: Inspect staged/uncommitted work**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated changes remain, or the tree is clean if those changes were handled separately. No task implementation files should be left unstaged.

- [ ] **Step 4: Manual smoke check**

Run:

```bash
npm run dev
```

Open the app and inspect one tender detail route. Confirm:

- The header title is clean and not a raw data dump.
- The KPI strip appears before detailed source sections.
- Missing budget/caution/applications/market price values render as `Non detecte`.
- `Donnees source` is collapsed by default and expands to show raw values.
- The navbar uses the new logo.

Stop the dev server with `Ctrl+C`.

- [ ] **Step 5: Commit any smoke-check fixes**

If smoke-check fixes were required, commit only those files:

```bash
git add backend/tender_display.py backend/main.py backend/test_tender_display.py backend/test_tender_routes.py frontend/src/lib/types.ts frontend/src/lib/displayValues.ts frontend/src/pages/TenderDetail.tsx frontend/src/assets/logo-full.svg frontend/src/assets/logo-mark.svg frontend/src/assets/logo-wordmark.svg frontend/public/favicon.svg frontend/src/components/Navbar.tsx
git commit -m "fix: polish tender detail normalization"
```

If no fixes were required, do not create an empty commit.
