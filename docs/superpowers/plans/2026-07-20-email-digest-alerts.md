# Email Digest Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the daily scrape finds new tenders, users get one SMTP email digest listing the new tenders matching their saved alerts, managed on a revamped Alerts page with multi-select pickers.

**Architecture:** Two new backend modules — `emailer.py` (SMTP) and `digest.py` (matching + digest orchestration) — plus a `digest_log` dedup table, a fixed new-id-detecting scraper, an in-app asyncio daily scheduler, three API additions (`last_sent` on GET /api/alerts, POST /api/alerts/preview, POST /api/alerts/test-email), and a rebuilt `Alerts.tsx`. Spec: `docs/superpowers/specs/2026-07-20-email-digest-alerts-design.md`.

**Tech Stack:** FastAPI + aiosqlite + stdlib `smtplib`/`email` (backend), React 19 + Tailwind CSS variables (frontend), `unittest` for backend tests.

## Global Constraints

- **No new dependencies**, backend or frontend. Email uses stdlib `smtplib`.
- Backend tests are `unittest` style like `backend/test_location_normalization.py`; run with `cd backend && ./venv/bin/python -m unittest <module> -v`.
- Env vars (exact names): `SMTP_HOST` (unset ⇒ email disabled), `SMTP_PORT` default `587`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` default = `SMTP_USER`, `FRONTEND_URL` default `http://localhost:5173`, `DIGEST_HOUR` default `7`.
- UI copy is French **without accented characters** (matches existing pages: "affichees", "trouvee"). Email bodies follow the same convention.
- Frontend verification for every frontend task: `cd frontend && npm run build && npm run lint` — zero new errors (pre-existing warnings in `auth.tsx`/`Toast.tsx` are acceptable).
- Matching semantics (from spec): AND across criteria that are set; empty criterion = ignored; keywords are OR within the list; missing/unparseable estimation matches leniently even when budget bounds are set.

---

### Task 1: `digest_log` table + scraper new-id detection fix

**Files:**
- Modify: `backend/database.py` (init_db SQL block, after the `idx_alerts_user` index)
- Modify: `backend/scraper.py:383-411` (`scrape_all_sectors` insert loop and return)

**Interfaces:**
- Produces: table `digest_log(id, user_id, alert_id, tender_id, sent_at, UNIQUE(user_id, tender_id))`; `scrape_all_sectors() -> {"total_found": int, "total_new": int, "new_ids": list[str]}`. Tasks 4 and 5 rely on `new_ids` and `digest_log`.

- [ ] **Step 1: Add the digest_log table**

In `backend/database.py`, inside the `init_db` SQL string, directly after the line `CREATE INDEX IF NOT EXISTS idx_alerts_user ON alert_preferences(user_id);`, add:

```sql
        -- Digest email log (dedup: a user never receives the same tender twice)
        CREATE TABLE IF NOT EXISTS digest_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            alert_id INTEGER NOT NULL REFERENCES alert_preferences(id),
            tender_id TEXT NOT NULL REFERENCES tenders(id),
            sent_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, tender_id)
        );
        CREATE INDEX IF NOT EXISTS idx_digest_user ON digest_log(user_id);
```

- [ ] **Step 2: Fix new-tender detection and collect ids**

In `backend/scraper.py` `scrape_all_sectors()`: the current `if db.total_changes:` check is wrong — `total_changes` is a cumulative connection counter, so it is truthy forever after the first insert. Replace the counters and insert loop:

```python
    total_found = 0
    total_new = 0
    new_ids: list[str] = []

    for sector_code in SECTORS:
        tenders = await scrape_sector(sector_code)
        total_found += len(tenders)

        for t in tenders:
            try:
                before = db.total_changes
                await db.execute(
                    """INSERT OR IGNORE INTO tenders
                       (id, reference, title, entity, entity_code, sector_code,
                        sector_name, category, deadline, publication_date,
                        status, procedure_type, location, detail_url)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        t["id"], t["reference"], t["title"], t["entity"],
                        t["entity_code"], t["sector_code"], t["sector_name"],
                        t["category"], t["deadline"], t["publication_date"],
                        t["status"], t["procedure_type"], t["location"],
                        t["detail_url"],
                    ),
                )
                if db.total_changes > before:
                    total_new += 1
                    new_ids.append(t["id"])
            except Exception as e:
                print(f"[scraper] DB insert error: {e}")

        await db.commit()
```

And change the final return to:

```python
    return {"total_found": total_found, "total_new": total_new, "new_ids": new_ids}
```

- [ ] **Step 3: Verify schema creation**

Run:
```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -c "
import asyncio, database
database.DB_PATH = '/tmp/digest_schema_check.db'
asyncio.run(database.init_db())
import sqlite3
con = sqlite3.connect('/tmp/digest_schema_check.db')
print(con.execute(\"SELECT sql FROM sqlite_master WHERE name='digest_log'\").fetchone()[0])
"
```
Expected: prints the `CREATE TABLE digest_log ...` DDL including `UNIQUE(user_id, tender_id)`.

- [ ] **Step 4: Run existing tests (regression)**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_location_normalization -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add backend/database.py backend/scraper.py && git commit -m "feat: add digest_log table, fix scraper new-tender detection"
```

---

### Task 2: SMTP emailer module

**Files:**
- Create: `backend/emailer.py`
- Test: `backend/test_emailer.py`

**Interfaces:**
- Produces: `email_enabled() -> bool`; `build_message(to, subject, html, text) -> MIMEMultipart`; `send_email(to: str, subject: str, html: str, text: str) -> None` (raises on failure). Tasks 4 and 5 import `email_enabled` and `send_email` from `emailer`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test_emailer.py`:

```python
import os
import unittest
from unittest.mock import patch

from emailer import build_message, email_enabled


class EmailerTest(unittest.TestCase):
    def test_email_disabled_when_smtp_host_unset(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(email_enabled())

    def test_email_enabled_when_smtp_host_set(self):
        with patch.dict(os.environ, {"SMTP_HOST": "smtp.gmail.com"}):
            self.assertTrue(email_enabled())

    def test_build_message_is_multipart_alternative(self):
        with patch.dict(os.environ, {"SMTP_USER": "bot@example.com"}, clear=True):
            msg = build_message("user@example.com", "Sujet", "<p>Salut</p>", "Salut")
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        parts = msg.get_payload()
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0].get_content_type(), "text/plain")
        self.assertEqual(parts[1].get_content_type(), "text/html")
        self.assertEqual(msg["To"], "user@example.com")
        self.assertEqual(msg["From"], "bot@example.com")
        self.assertEqual(msg["Subject"], "Sujet")

    def test_from_prefers_smtp_from_over_user(self):
        env = {"SMTP_USER": "bot@example.com", "SMTP_FROM": "alerts@example.com"}
        with patch.dict(os.environ, env, clear=True):
            msg = build_message("user@example.com", "S", "<p>x</p>", "x")
        self.assertEqual(msg["From"], "alerts@example.com")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_emailer -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'emailer'`.

- [ ] **Step 3: Implement emailer.py**

Create `backend/emailer.py`:

```python
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def email_enabled() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def build_message(to: str, subject: str, html: str, text: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER", "")
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def send_email(to: str, subject: str, html: str, text: str) -> None:
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP non configure (SMTP_HOST manquant)")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    msg = build_message(to, subject, html, text)
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_emailer -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add backend/emailer.py backend/test_emailer.py && git commit -m "feat: add SMTP emailer module"
```

---

### Task 3: Matching engine and digest rendering (pure functions)

**Files:**
- Create: `backend/digest.py` (pure parts only; `run_digest` comes in Task 4)
- Test: `backend/test_digest.py`

**Interfaces:**
- Consumes: nothing project-specific (stdlib only).
- Produces (Tasks 4 and 5 rely on these exact names):
  - `split_csv(value: str) -> list[str]`
  - `match_alert(alert: dict, tender: dict) -> bool` — alert keys `sectors`, `regions`, `keywords` (comma-separated strings); tender keys `sector_code`, `region` (pre-normalized region name), `title`, `entity`, `location`.
  - `parse_estimation(text: str | None) -> float | None`
  - `has_budget_bounds(alert: dict) -> bool`
  - `budget_ok(alert: dict, estimation_text: str | None) -> bool`
  - `render_digest(sections: list[tuple[str, list[dict]]]) -> tuple[str, str, str]` — returns `(subject, html, text)`; each tender dict uses keys `id`, `title`, `entity`, `location`, `deadline`, `estimation`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test_digest.py`:

```python
import unittest

from digest import (
    budget_ok,
    has_budget_bounds,
    match_alert,
    parse_estimation,
    render_digest,
    split_csv,
)


def make_alert(**over):
    alert = {"sectors": "", "regions": "", "keywords": "", "min_budget": "", "max_budget": ""}
    alert.update(over)
    return alert


def make_tender(**over):
    tender = {
        "id": "T1",
        "sector_code": "A",
        "region": "Casablanca-Settat",
        "title": "Construction d'une ecole",
        "entity": "Commune de Casablanca",
        "location": "CASABLANCA",
        "deadline": "01/09/2026 10:00",
        "estimation": "",
    }
    tender.update(over)
    return tender


class SplitCsvTest(unittest.TestCase):
    def test_splits_and_strips(self):
        self.assertEqual(split_csv(" A, B ,,C "), ["A", "B", "C"])

    def test_empty_and_none_like(self):
        self.assertEqual(split_csv(""), [])


class MatchAlertTest(unittest.TestCase):
    def test_empty_alert_matches_everything(self):
        self.assertTrue(match_alert(make_alert(), make_tender()))

    def test_sector_match_and_mismatch(self):
        self.assertTrue(match_alert(make_alert(sectors="A,D"), make_tender(sector_code="A")))
        self.assertFalse(match_alert(make_alert(sectors="D"), make_tender(sector_code="A")))

    def test_region_match_and_mismatch(self):
        self.assertTrue(match_alert(make_alert(regions="Casablanca-Settat,Oriental"), make_tender()))
        self.assertFalse(match_alert(make_alert(regions="Oriental"), make_tender()))

    def test_keywords_or_within_accent_and_case_insensitive(self):
        # "ecole" must match "École" in the title regardless of accents/case
        tender = make_tender(title="Construction d'une École primaire")
        self.assertTrue(match_alert(make_alert(keywords="hopital, ecole"), tender))
        self.assertFalse(match_alert(make_alert(keywords="hopital, pont"), tender))

    def test_keywords_search_entity_and_location(self):
        self.assertTrue(match_alert(make_alert(keywords="commune"), make_tender()))
        self.assertTrue(match_alert(make_alert(keywords="casablanca"), make_tender(title="x", entity="y")))

    def test_criteria_are_anded(self):
        alert = make_alert(sectors="A", regions="Oriental")
        self.assertFalse(match_alert(alert, make_tender()))  # sector ok, region not


class EstimationTest(unittest.TestCase):
    def test_french_format(self):
        self.assertEqual(parse_estimation("1 234 567,89 MAD"), 1234567.89)

    def test_dot_thousands_comma_decimal(self):
        self.assertEqual(parse_estimation("1.500.000,00 DH"), 1500000.0)

    def test_plain_number(self):
        self.assertEqual(parse_estimation("500000"), 500000.0)

    def test_garbage_and_empty(self):
        self.assertIsNone(parse_estimation("N/A"))
        self.assertIsNone(parse_estimation(""))
        self.assertIsNone(parse_estimation(None))


class BudgetTest(unittest.TestCase):
    def test_no_bounds_always_ok(self):
        self.assertFalse(has_budget_bounds(make_alert()))
        self.assertTrue(budget_ok(make_alert(), None))

    def test_lenient_when_estimation_unknown(self):
        alert = make_alert(min_budget="1000")
        self.assertTrue(has_budget_bounds(alert))
        self.assertTrue(budget_ok(alert, None))
        self.assertTrue(budget_ok(alert, "N/A"))

    def test_bounds_enforced_when_estimation_parses(self):
        alert = make_alert(min_budget="1000", max_budget="2000")
        self.assertFalse(budget_ok(alert, "500,00 MAD"))
        self.assertTrue(budget_ok(alert, "1 500,00 MAD"))
        self.assertFalse(budget_ok(alert, "2 500,00 MAD"))


class RenderDigestTest(unittest.TestCase):
    def test_render_contains_titles_links_and_count(self):
        sections = [("Mon alerte BTP", [make_tender()])]
        subject, html, text = render_digest(sections)
        self.assertIn("1", subject)
        self.assertIn("Construction d'une ecole", html)
        self.assertIn("/tenders/T1", html)
        self.assertIn("Mon alerte BTP", html)
        self.assertIn("Construction d'une ecole", text)

    def test_missing_estimation_shows_non_communiquee(self):
        _, html, _ = render_digest([("A", [make_tender(estimation="")])])
        self.assertIn("Estimation non communiquee", html)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'digest'`.

- [ ] **Step 3: Implement the pure functions**

Create `backend/digest.py`:

```python
import os
import re
import unicodedata


def split_csv(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split(",") if part.strip()]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def match_alert(alert: dict, tender: dict) -> bool:
    """AND across set criteria; empty criteria ignored. Keywords are OR within."""
    sectors = split_csv(alert.get("sectors", ""))
    if sectors and tender.get("sector_code") not in sectors:
        return False

    regions = split_csv(alert.get("regions", ""))
    if regions and tender.get("region") not in regions:
        return False

    keywords = split_csv(alert.get("keywords", ""))
    if keywords:
        haystack = _norm(
            " ".join(
                str(tender.get(key) or "") for key in ("title", "entity", "location")
            )
        )
        if not any(_norm(keyword) in haystack for keyword in keywords):
            return False

    return True


def parse_estimation(text) -> float | None:
    if not text:
        return None
    cleaned = re.sub(r"[^\d,.]", "", str(text))
    if not re.search(r"\d", cleaned):
        return None
    if "," in cleaned:
        # French format: dots/spaces are thousands separators, comma is decimal
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def has_budget_bounds(alert: dict) -> bool:
    return bool((alert.get("min_budget") or "").strip() or (alert.get("max_budget") or "").strip())


def budget_ok(alert: dict, estimation_text) -> bool:
    """Lenient: unknown estimation matches even when bounds are set."""
    if not has_budget_bounds(alert):
        return True
    value = parse_estimation(estimation_text)
    if value is None:
        return True
    for bound_key, predicate in (("min_budget", lambda b: value >= b), ("max_budget", lambda b: value <= b)):
        raw = (alert.get(bound_key) or "").strip()
        if not raw:
            continue
        try:
            bound = float(raw)
        except ValueError:
            continue
        if not predicate(bound):
            return False
    return True


def render_digest(sections: list[tuple[str, list[dict]]]) -> tuple[str, str, str]:
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    total = sum(len(tenders) for _, tenders in sections)
    plural = "s" if total > 1 else ""
    subject = f"{total} nouvelle{plural} consultation{plural} pour vos alertes"

    html_parts = [
        '<div style="font-family:Georgia,serif;background:#faf7f0;padding:24px;color:#2b2b2b;">',
        '<h1 style="font-size:20px;border-bottom:2px solid #a51c30;padding-bottom:8px;">Marches Publics Maroc</h1>',
        f'<p style="font-size:14px;">{total} nouvelle{plural} consultation{plural} correspondent a vos alertes.</p>',
    ]
    text_parts = [f"{total} nouvelle{plural} consultation{plural} correspondent a vos alertes.", ""]

    for alert_name, tenders in sections:
        html_parts.append(f'<h2 style="font-size:16px;color:#a51c30;margin-top:20px;">{alert_name}</h2>')
        text_parts.append(f"== {alert_name} ==")
        for tender in tenders:
            estimation = (tender.get("estimation") or "").strip() or "Estimation non communiquee"
            link = f"{frontend}/tenders/{tender['id']}"
            html_parts.append(
                '<div style="border:1px solid #e3ddcf;border-radius:4px;background:#fffdf7;'
                'padding:12px;margin:8px 0;">'
                f'<a href="{link}" style="font-weight:bold;color:#a51c30;text-decoration:none;">'
                f'{tender.get("title", "")}</a>'
                f'<div style="font-size:13px;color:#5b5b52;margin-top:4px;">'
                f'{tender.get("entity", "")} — {tender.get("location", "")}<br>'
                f'Date limite : {tender.get("deadline", "")} · {estimation}</div></div>'
            )
            text_parts.append(
                f"- {tender.get('title', '')} | {tender.get('entity', '')} | "
                f"{tender.get('location', '')} | Limite: {tender.get('deadline', '')} | "
                f"{estimation} | {link}"
            )
        text_parts.append("")

    html_parts.append(
        f'<p style="font-size:12px;color:#5b5b52;margin-top:24px;">'
        f'Gerez vos alertes : <a href="{frontend}/alerts" style="color:#a51c30;">{frontend}/alerts</a></p></div>'
    )
    text_parts.append(f"Gerez vos alertes : {frontend}/alerts")

    return subject, "".join(html_parts), "\n".join(text_parts)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest -v`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add backend/digest.py backend/test_digest.py && git commit -m "feat: add alert matching engine and digest rendering"
```

---

### Task 4: `ensure_tender_details` + `run_digest` orchestration

**Files:**
- Modify: `backend/scraper.py` (add `ensure_tender_details` near `scrape_tender_detail`)
- Modify: `backend/digest.py` (append `run_digest`)
- Test: `backend/test_digest.py` (append `RunDigestTest`)

**Interfaces:**
- Consumes: `digest_log` table (Task 1), `email_enabled`/`send_email` from `emailer` (Task 2), pure functions (Task 3), `scrape_tender_detail` (existing).
- Produces: `ensure_tender_details(db, tender_id: str, detail_url: str) -> dict | None` in `scraper.py` (Task 5 refactors `get_tender` to use it); `run_digest(new_ids: list[str]) -> {"emails_sent": int, "tenders_matched": int}` in `digest.py` (Task 5 calls it after scrapes).

- [ ] **Step 1: Write the failing tests**

Append to `backend/test_digest.py` (new imports at top of file: `import os`, `import tempfile`, `from unittest.mock import patch`):

```python
class RunDigestTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        await db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES ('u1@test.com', 'x', 'U1')"
        )
        await db.execute(
            """INSERT INTO alert_preferences (user_id, name, sectors, regions, keywords, enabled)
               VALUES (1, 'BTP Casa', 'A', '', '', 1)"""
        )
        await db.execute(
            """INSERT INTO tenders (id, reference, title, entity, entity_code, sector_code,
               sector_name, category, deadline, publication_date, status, procedure_type,
               location, detail_url)
               VALUES ('T1', 'R1', 'Construction ecole', 'Commune X', 'C1', 'A',
               'BTP', 'Travaux', '01/09/2026 10:00', '01/07/2026', 'en_cours', 'AOO',
               'CASABLANCA', '')"""
        )
        await db.commit()
        await db.close()

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    async def test_sends_one_email_and_logs_then_dedups(self):
        import digest

        sent = []
        with patch.object(digest, "email_enabled", return_value=True), patch.object(
            digest, "send_email", side_effect=lambda to, s, h, t: sent.append((to, s))
        ):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 1)
        self.assertEqual(result["tenders_matched"], 1)
        self.assertEqual(sent[0][0], "u1@test.com")

        # second run: digest_log dedups, nothing sent
        with patch.object(digest, "email_enabled", return_value=True), patch.object(
            digest, "send_email", side_effect=lambda to, s, h, t: sent.append((to, s))
        ):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        self.assertEqual(len(sent), 1)

    async def test_email_disabled_skips_send_and_does_not_log(self):
        import database
        import digest

        with patch.object(digest, "email_enabled", return_value=False):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        self.assertEqual(result["tenders_matched"], 1)

        db = await database.get_db()
        cursor = await db.execute("SELECT COUNT(*) AS n FROM digest_log")
        row = await cursor.fetchone()
        await db.close()
        self.assertEqual(row["n"], 0)

    async def test_disabled_alert_and_non_matching_tender_ignored(self):
        import database
        import digest

        db = await database.get_db()
        await db.execute("UPDATE alert_preferences SET enabled = 0")
        await db.commit()
        await db.close()

        with patch.object(digest, "email_enabled", return_value=True), patch.object(
            digest, "send_email"
        ) as mock_send:
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        mock_send.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest.RunDigestTest -v`
Expected: FAIL with `AttributeError: module 'digest' has no attribute 'run_digest'`.

- [ ] **Step 3: Add `ensure_tender_details` to scraper.py**

In `backend/scraper.py`, after the `scrape_tender_detail` function, add:

```python
DETAIL_COLS = [
    "objet", "acheteur", "annonce_type", "procedure",
    "categorie", "allotissement", "lieu_execution", "estimation",
    "domaines", "adresse_retrait", "adresse_depot", "lieu_ouverture",
    "caution_provisoire", "qualifications", "agrements", "variante",
    "reunion", "visite_lieux", "contact", "documents_url", "dce_url",
    "avis_url", "reserved_pme", "prix_plans",
]


async def ensure_tender_details(db, tender_id: str, detail_url: str) -> dict | None:
    """Return stored tender details, lazily scraping and caching them if absent."""
    cursor = await db.execute(
        "SELECT * FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    row = await cursor.fetchone()
    if row:
        return dict(row)
    if not detail_url:
        return None
    scraped = await scrape_tender_detail(detail_url)
    if not scraped:
        return None
    cols = ["tender_id"] + DETAIL_COLS
    placeholders = ", ".join(["?"] * len(cols))
    values = [tender_id] + [scraped.get(c, "") for c in DETAIL_COLS]
    await db.execute(
        f"INSERT OR REPLACE INTO tender_details ({', '.join(cols)}) VALUES ({placeholders})",
        values,
    )
    await db.commit()
    return scraped
```

- [ ] **Step 4: Add `run_digest` to digest.py**

Append to `backend/digest.py` (add `import asyncio` at the top, plus the two imports shown):

```python
from database import get_db
from emailer import email_enabled, send_email


async def run_digest(new_ids: list[str]) -> dict:
    """Match new tenders against enabled alerts and email one digest per user."""
    from main import normalize_location  # imported lazily to avoid a circular import
    from scraper import ensure_tender_details

    if not new_ids:
        return {"emails_sent": 0, "tenders_matched": 0}

    db = await get_db()
    placeholders = ",".join("?" * len(new_ids))
    cursor = await db.execute(
        f"""SELECT t.*, td.estimation FROM tenders t
            LEFT JOIN tender_details td ON td.tender_id = t.id
            WHERE t.id IN ({placeholders})""",
        new_ids,
    )
    tenders = [dict(r) for r in await cursor.fetchall()]
    for tender in tenders:
        tender["region"] = normalize_location(tender.get("location") or "")["region"]

    cursor = await db.execute(
        """SELECT a.*, u.email AS user_email FROM alert_preferences a
           JOIN users u ON u.id = a.user_id WHERE a.enabled = 1"""
    )
    alerts = [dict(r) for r in await cursor.fetchall()]

    estimation_cache: dict[str, str] = {
        t["id"]: t.get("estimation") or "" for t in tenders
    }

    async def estimation_for(tender: dict) -> str:
        if not estimation_cache.get(tender["id"]) and tender.get("detail_url"):
            try:
                detail = await ensure_tender_details(db, tender["id"], tender["detail_url"])
            except Exception as e:
                print(f"[digest] detail fetch failed for {tender['id']}: {e}")
                detail = None
            estimation_cache[tender["id"]] = (detail or {}).get("estimation") or ""
        return estimation_cache.get(tender["id"], "")

    per_user: dict[int, dict] = {}
    for alert in alerts:
        for tender in tenders:
            if not match_alert(alert, tender):
                continue
            if has_budget_bounds(alert) and not budget_ok(alert, await estimation_for(tender)):
                continue
            user = per_user.setdefault(
                alert["user_id"],
                {"email": alert["user_email"], "seen": set(), "sections": {}, "rows": []},
            )
            if tender["id"] in user["seen"]:
                continue
            user["seen"].add(tender["id"])
            user["sections"].setdefault(alert["name"], []).append(tender)
            user["rows"].append((alert["id"], tender["id"]))

    emails_sent = 0
    tenders_matched = 0
    for user_id, data in per_user.items():
        cursor = await db.execute(
            "SELECT tender_id FROM digest_log WHERE user_id = ?", (user_id,)
        )
        already_sent = {r["tender_id"] for r in await cursor.fetchall()}
        sections = []
        for name, section_tenders in data["sections"].items():
            kept = [t for t in section_tenders if t["id"] not in already_sent]
            if kept:
                sections.append((name, kept))
        if not sections:
            continue
        section_count = sum(len(ts) for _, ts in sections)
        tenders_matched += section_count

        if not email_enabled():
            print(
                f"[digest] email disabled (SMTP_HOST unset); "
                f"{section_count} tenders for {data['email']} not sent"
            )
            continue

        subject, html, text = render_digest(sections)
        try:
            await asyncio.to_thread(send_email, data["email"], subject, html, text)
        except Exception as e:
            print(f"[digest] send failed for {data['email']}: {e}")
            continue
        for alert_id, tender_id in data["rows"]:
            if tender_id not in already_sent:
                await db.execute(
                    "INSERT OR IGNORE INTO digest_log (user_id, alert_id, tender_id) VALUES (?, ?, ?)",
                    (user_id, alert_id, tender_id),
                )
        await db.commit()
        emails_sent += 1

    await db.close()
    return {"emails_sent": emails_sent, "tenders_matched": tenders_matched}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest -v`
Expected: PASS (all tests, including the three `RunDigestTest` cases).

- [ ] **Step 6: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add backend/digest.py backend/scraper.py backend/test_digest.py && git commit -m "feat: add run_digest orchestration and lazy detail helper"
```

---

### Task 5: Backend wiring — scheduler, scrape hook, API endpoints

**Files:**
- Modify: `backend/main.py` (imports, lifespan, `get_tender`, `/api/scrape`, `/api/alerts`, new endpoints)

**Interfaces:**
- Consumes: `run_digest` (Task 4), `ensure_tender_details` (Task 4), `email_enabled`/`send_email` (Task 2), `match_alert`/`budget_ok` (Task 3), existing `require_user`, `AlertRequest`, `normalize_location`.
- Produces: `GET /api/alerts` rows now include `last_sent`; `POST /api/alerts/preview` -> `{count, sample}`; `POST /api/alerts/test-email` -> `{status: "sent"}` | 503/502; `POST /api/scrape` response gains `emails_sent`/`tenders_matched`. Task 6 consumes all three.

- [ ] **Step 1: Add imports and the scheduler**

In `backend/main.py`, extend the import block (near the existing `from scraper import ...` line):

```python
import asyncio
import os
from datetime import datetime, timedelta

from scraper import scrape_all_sectors, scrape_homepage_counts, scrape_tender_detail, download_dce, ensure_tender_details
from digest import run_digest, match_alert, budget_ok
from emailer import email_enabled, send_email
```

(Keep the existing names in the `scraper` import and add `ensure_tender_details`; drop nothing. If `import os` / `import asyncio` already exist, don't duplicate them.)

Above the `lifespan` function, add:

```python
scrape_lock = asyncio.Lock()


async def run_scrape_and_digest() -> dict:
    async with scrape_lock:
        result = await scrape_all_sectors()
        new_ids = result.pop("new_ids", [])
        digest_result = await run_digest(new_ids)
        return {**result, **digest_result}


async def daily_scheduler():
    hour = int(os.getenv("DIGEST_HOUR", "7"))
    while True:
        now = datetime.now()
        target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        await asyncio.sleep((target - now).total_seconds())
        try:
            result = await run_scrape_and_digest()
            print(f"[scheduler] daily scrape+digest done: {result}")
        except Exception as e:
            print(f"[scheduler] daily scrape+digest failed: {e}")
```

Replace the `lifespan` body:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    scheduler_task = asyncio.create_task(daily_scheduler())
    yield
    scheduler_task.cancel()
```

- [ ] **Step 2: Hook the digest into manual scrape**

Replace the `trigger_scrape` endpoint:

```python
@app.post("/api/scrape")
async def trigger_scrape():
    result = await run_scrape_and_digest()
    return {"status": "done", **result}
```

- [ ] **Step 3: Refactor `get_tender` to use `ensure_tender_details`**

In `get_tender` (`backend/main.py:321`), replace the block from `det_cursor = await db.execute(` through `detail = scraped` (the inline lazy-fetch, currently ~30 lines) with:

```python
    detail = await ensure_tender_details(db, tender_id, result.get("detail_url") or "")
```

and change the tail of the function to:

```python
    await db.close()

    if detail:
        result["details"] = detail
    return result
```

- [ ] **Step 4: Add `last_sent` to GET /api/alerts**

In `list_alerts`, replace the SELECT with:

```python
    cursor = await db.execute(
        """SELECT a.*,
                  (SELECT MAX(d.sent_at) FROM digest_log d WHERE d.alert_id = a.id) AS last_sent
           FROM alert_preferences a
           WHERE a.user_id = ? ORDER BY a.created_at DESC""",
        (user["id"],),
    )
```

- [ ] **Step 5: Add preview and test-email endpoints**

After the `delete_alert` endpoint in `backend/main.py`, add:

```python
@app.post("/api/alerts/preview")
async def preview_alert(req: AlertRequest, authorization: str | None = Header(None)):
    await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        """SELECT t.*, td.estimation FROM tenders t
           LEFT JOIN tender_details td ON td.tender_id = t.id
           WHERE t.status = 'en_cours'"""
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    await db.close()

    criteria = req.model_dump()
    matches = []
    for tender in rows:
        tender["region"] = normalize_location(tender.get("location") or "")["region"]
        if match_alert(criteria, tender) and budget_ok(criteria, tender.get("estimation")):
            matches.append(tender)

    sample = [
        {key: tender.get(key) for key in ("id", "title", "entity", "location", "deadline")}
        for tender in matches[:5]
    ]
    return {"count": len(matches), "sample": sample}


@app.post("/api/alerts/test-email")
async def test_alert_email(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    if not email_enabled():
        raise HTTPException(status_code=503, detail="SMTP non configure (SMTP_HOST manquant)")
    subject = "Test - Alertes Marches Publics Maroc"
    text = "Ceci est un email de test de vos alertes. La configuration SMTP fonctionne."
    html = "<p>Ceci est un email de test de vos alertes. La configuration SMTP fonctionne.</p>"
    try:
        await asyncio.to_thread(send_email, user["email"], subject, html, text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Echec d'envoi: {e}")
    return {"status": "sent"}
```

**Route-order caveat:** FastAPI matches in registration order; the existing routes are `/api/alerts` and `/api/alerts/{alert_id}` where `alert_id` is typed `int`. `"preview"`/`"test-email"` don't coerce to int, so appending after `delete_alert` is safe — no reordering needed.

- [ ] **Step 6: Run the test suite and boot the server**

Run:
```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest test_emailer test_location_normalization -v
```
Expected: all PASS.

Then verify the app boots and endpoints respond (backend may already be running on :8000 — if so, restart it to load the new code):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/alerts/preview -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/alerts/test-email
```
Expected: both `401` (auth required — proves routes exist and are not swallowed by `/api/alerts/{alert_id}`).

- [ ] **Step 7: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add backend/main.py && git commit -m "feat: wire digest into scrape, add scheduler, preview and test-email endpoints"
```

---

### Task 6: Frontend — types, API helpers, Alerts page rebuild

**Files:**
- Modify: `frontend/src/lib/types.ts` (AlertPreference + new AlertPreview)
- Modify: `frontend/src/lib/api.ts` (previewAlert, testAlertEmail)
- Rewrite: `frontend/src/pages/Alerts.tsx`

**Interfaces:**
- Consumes: `POST /api/alerts/preview`, `POST /api/alerts/test-email`, `last_sent` field (Task 5); existing `getFilters()` (`FiltersResponse.sectors: {code, name}[]`), `getRegions()` (`{regions: RegionStats[]}`), alert CRUD helpers, `ToastContainer`/`createToast` from `../components/Toast`, `useAuth`.
- Produces: the finished Alerts page.

- [ ] **Step 1: Add types**

In `frontend/src/lib/types.ts`, add `last_sent` to `AlertPreference` (after `created_at`):

```ts
  last_sent?: string | null;
```

and after the `AlertPreference` interface add:

```ts
export interface AlertPreview {
  count: number;
  sample: { id: string; title: string; entity: string; location: string; deadline: string }[];
}
```

- [ ] **Step 2: Add API helpers**

In `frontend/src/lib/api.ts`, add `AlertPreview` to the type import list from `./types`, then after `deleteAlert` add:

```ts
export async function previewAlert(data: Partial<AlertPreference>): Promise<AlertPreview> {
  const res = await fetch(`${BASE}/alerts/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function testAlertEmail(): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/alerts/test-email`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `API error: ${res.status}`);
  return body;
}
```

- [ ] **Step 3: Rewrite Alerts.tsx**

Replace the full contents of `frontend/src/pages/Alerts.tsx` with:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Eye, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import {
  createAlert,
  deleteAlert,
  getAlerts,
  getFilters,
  getRegions,
  previewAlert,
  testAlertEmail,
  updateAlert,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import ToastContainer, { createToast, type ToastData } from "../components/Toast";
import type { AlertPreference, AlertPreview } from "../lib/types";

const CONTROL_CLASS =
  "w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors";

interface ChipOption {
  value: string;
  label: string;
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded border px-2.5 py-1 font-sans text-xs transition-colors ${
              active
                ? "bg-[var(--color-crimson)] text-white border-[var(--color-crimson)]"
                : "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function formToPayload(form: AlertFormState) {
  return {
    name: form.name,
    keywords: form.keywords,
    sectors: form.sectors.join(","),
    regions: form.regions.join(","),
    min_budget: form.minBudget,
    max_budget: form.maxBudget,
    frequency: "daily",
    enabled: form.enabled ? 1 : 0,
  };
}

interface AlertFormState {
  name: string;
  keywords: string;
  sectors: string[];
  regions: string[];
  minBudget: string;
  maxBudget: string;
  enabled: boolean;
}

const EMPTY_FORM: AlertFormState = {
  name: "",
  keywords: "",
  sectors: [],
  regions: [],
  minBudget: "",
  maxBudget: "",
  enabled: true,
};

function splitCsv(value: string): string[] {
  return (value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AlertFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sectorOptions, setSectorOptions] = useState<ChipOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<ChipOption[]>([]);
  const [preview, setPreview] = useState<AlertPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  function addToast(message: string, type: ToastData["type"] = "info") {
    setToasts((prev) => [...prev, createToast(message, type)]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    getFilters()
      .then((res) =>
        setSectorOptions(res.sectors.map((s) => ({ value: s.code, label: s.name }))),
      )
      .catch(() => {});
    getRegions()
      .then((res) =>
        setRegionOptions(res.regions.map((r) => ({ value: r.name, label: r.name }))),
      )
      .catch(() => {});
  }, [user]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch {
      addToast("Erreur lors du chargement des alertes", "error");
    } finally {
      setLoading(false);
    }
  }

  function updateForm(patch: Partial<AlertFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setPreview(null);
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPreview(null);
    setShowForm(true);
  }

  function startEdit(alert: AlertPreference) {
    setForm({
      name: alert.name,
      keywords: alert.keywords,
      sectors: splitCsv(alert.sectors),
      regions: splitCsv(alert.regions),
      minBudget: alert.min_budget,
      maxBudget: alert.max_budget,
      enabled: Boolean(alert.enabled),
    });
    setEditingId(alert.id);
    setPreview(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Donnez un nom a votre alerte", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId !== null) {
        await updateAlert(editingId, formToPayload(form));
        addToast("Alerte mise a jour", "success");
      } else {
        await createAlert(formToPayload(form));
        addToast("Alerte creee", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchAlerts();
    } catch {
      addToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      setPreview(await previewAlert(formToPayload(form)));
    } catch {
      addToast("Erreur lors de l'apercu", "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleToggleEnabled(alert: AlertPreference) {
    try {
      await updateAlert(alert.id, { ...alert, enabled: alert.enabled ? 0 : 1 });
      await fetchAlerts();
    } catch {
      addToast("Erreur lors de la mise a jour", "error");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      addToast("Alerte supprimee", "success");
    } catch {
      addToast("Erreur lors de la suppression", "error");
    }
  }

  async function handleTestEmail() {
    try {
      await testAlertEmail();
      addToast("Email de test envoye", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Echec de l'envoi", "error");
    }
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-[var(--color-slate)]" />
          <p className="text-lg mb-4 font-sans text-[var(--color-charcoal)]">
            Connectez-vous pour gerer vos alertes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded bg-[var(--color-crimson)] px-4 py-2 font-sans text-sm font-semibold text-white"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const chipsFor = (alert: AlertPreference): string[] => {
    const sectorLabels = splitCsv(alert.sectors).map(
      (code) => sectorOptions.find((o) => o.value === code)?.label || code,
    );
    const budget =
      alert.min_budget || alert.max_budget
        ? [`Budget: ${alert.min_budget || "0"} - ${alert.max_budget || "∞"} MAD`]
        : [];
    return [
      ...sectorLabels,
      ...splitCsv(alert.regions),
      ...splitCsv(alert.keywords).map((k) => `"${k}"`),
      ...budget,
    ];
  };

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">Alertes</h1>
          <p className="text-[var(--color-slate)] font-sans text-sm mt-1">
            Recevez par email les nouvelles consultations qui correspondent a vos criteres.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestEmail}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-sm text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
          >
            <Send size={14} /> Tester l'email
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--color-crimson)] px-3 py-2 font-sans text-sm font-semibold text-white hover:bg-[var(--color-crimson-dark)]"
          >
            <Plus size={14} /> Nouvelle alerte
          </button>
        </div>
      </div>

      {showForm && (
        <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
              {editingId !== null ? "Modifier l'alerte" : "Nouvelle alerte"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-[var(--color-slate)] hover:text-[var(--color-charcoal)]"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="label-academic text-xs">Nom de l'alerte</span>
                <input
                  type="text"
                  className={CONTROL_CLASS}
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="Ex: BTP Casablanca"
                />
              </label>
              <label className="space-y-1">
                <span className="label-academic text-xs">Mots-cles (separes par des virgules)</span>
                <input
                  type="text"
                  className={CONTROL_CLASS}
                  value={form.keywords}
                  onChange={(e) => updateForm({ keywords: e.target.value })}
                  placeholder="Ex: ecole, construction, amenagement"
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="label-academic text-xs">Secteurs</span>
              <ChipGroup
                options={sectorOptions}
                selected={form.sectors}
                onToggle={(value) => updateForm({ sectors: toggleIn(form.sectors, value) })}
              />
            </div>

            <div className="space-y-1">
              <span className="label-academic text-xs">Regions</span>
              <ChipGroup
                options={regionOptions}
                selected={form.regions}
                onToggle={(value) => updateForm({ regions: toggleIn(form.regions, value) })}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="label-academic text-xs">Budget min (MAD)</span>
                <input
                  type="number"
                  min="0"
                  className={CONTROL_CLASS}
                  value={form.minBudget}
                  onChange={(e) => updateForm({ minBudget: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="label-academic text-xs">Budget max (MAD)</span>
                <input
                  type="number"
                  min="0"
                  className={CONTROL_CLASS}
                  value={form.maxBudget}
                  onChange={(e) => updateForm({ maxBudget: e.target.value })}
                />
              </label>
              <label className="flex items-end gap-2 pb-2 font-sans text-sm text-[var(--color-charcoal)]">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => updateForm({ enabled: e.target.checked })}
                />
                Activee
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 border-t border-[var(--color-border-subtle)] pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded bg-[var(--color-crimson)] px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-[var(--color-crimson-dark)] disabled:opacity-60"
              >
                <Check size={15} /> {editingId !== null ? "Enregistrer" : "Creer l'alerte"}
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-deep)] px-4 py-2 font-sans text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-border)] disabled:opacity-60"
              >
                <Eye size={15} /> {previewLoading ? "Calcul..." : "Apercu"}
              </button>
            </div>

            {preview && (
              <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] p-4">
                <p className="font-sans text-sm font-semibold text-[var(--color-charcoal)]">
                  {preview.count.toLocaleString("fr-FR")} consultations actives correspondent a ces criteres.
                </p>
                {preview.sample.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {preview.sample.map((t) => (
                      <li key={t.id} className="font-sans text-xs text-[var(--color-slate)]">
                        <Link to={`/tenders/${encodeURIComponent(t.id)}`} className="hover:text-[var(--color-crimson)]">
                          {t.title}
                        </Link>{" "}
                        — {t.entity} · {t.location} · limite {t.deadline}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-6 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-[var(--color-slate)]" />
          <p className="font-sans text-sm text-[var(--color-slate)]">
            Aucune alerte configuree. Creez-en une pour recevoir les nouvelles consultations par email.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-[var(--color-charcoal)]">{alert.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wide ${
                      alert.enabled
                        ? "bg-[var(--color-crimson)] text-white"
                        : "bg-[var(--color-ivory-deep)] text-[var(--color-slate)]"
                    }`}
                  >
                    {alert.enabled ? "Active" : "En pause"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chipsFor(alert).length > 0 ? (
                    chipsFor(alert).map((chip) => (
                      <span
                        key={chip}
                        className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] px-2 py-0.5 font-sans text-xs text-[var(--color-charcoal)]"
                      >
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className="font-sans text-xs text-[var(--color-slate)]">
                      Toutes les consultations
                    </span>
                  )}
                </div>
                <p className="mt-1.5 font-sans text-xs text-[var(--color-slate)]">
                  {alert.last_sent
                    ? `Dernier envoi : ${alert.last_sent}`
                    : "Aucun email envoye pour le moment"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(alert)}
                  className="rounded border border-[var(--color-border-subtle)] px-2.5 py-1.5 font-sans text-xs text-[var(--color-charcoal)] hover:border-[var(--color-border)]"
                >
                  {alert.enabled ? "Mettre en pause" : "Activer"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(alert)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)] hover:text-[var(--color-crimson)] hover:border-[var(--color-border)]"
                  title="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(alert.id)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)] hover:text-[var(--color-crimson)] hover:border-[var(--color-border)]"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: `updateAlert(alert.id, { ...alert, enabled: ... })` sends extra fields (`id`, `created_at`, `last_sent`) — the backend `AlertRequest` model ignores unknown fields, so this is safe and keeps the toggle a one-liner.

- [ ] **Step 4: Build and lint**

Run: `cd /Users/mkroze/Developer/my_hub/public_market_annonce/frontend && npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce && git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/pages/Alerts.tsx && git commit -m "feat: rebuild Alerts page with multi-select filters, preview and test email"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Restart the backend with the new code**

If the backend is already running on :8000, stop and restart it so the new modules load:
```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python main.py
```
(run in background; frontend dev server on :5173 as usual with `cd frontend && npm run dev`).

- [ ] **Step 2: Verify the page and endpoints against the running app**

With a logged-in test account (register one via the UI or `POST /api/auth/register` if none exists):
1. Open `http://localhost:5173/alerts` — the new page renders: sector chips (from /api/filters), region chips (from /api/regions), budget inputs, no frequency selector.
2. Create an alert (e.g. sector chip + a keyword); click "Apercu" — a count and sample titles appear.
3. Click "Tester l'email" with SMTP unset — an error toast shows "SMTP non configure (SMTP_HOST manquant)".
4. The alert list shows criteria chips and "Aucun email envoye pour le moment"; pause toggles the badge, edit refills the form, delete removes the card.
5. `curl -s -X POST http://localhost:8000/api/scrape | head -c 300` — response includes `emails_sent` and `tenders_matched`; backend log shows either digest matching output or "email disabled" lines.

Expected: all five checks pass. (A Playwright script driving :5173 is an acceptable substitute for manual clicking, as used for the map feature.)

- [ ] **Step 3: Optional real-email smoke test**

If SMTP credentials are available, restart the backend with:
```bash
SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=<you>@gmail.com SMTP_PASSWORD=<app-password> ./venv/bin/python main.py
```
then click "Tester l'email" and confirm receipt. Without credentials, skip — unit tests already cover the send path with mocks.

- [ ] **Step 4: Final full test run and commit any fixes**

```bash
cd /Users/mkroze/Developer/my_hub/public_market_annonce/backend && ./venv/bin/python -m unittest test_digest test_emailer test_location_normalization -v && cd ../frontend && npm run build && npm run lint
```
Expected: all green. Commit any fixes made during verification with `fix:` messages.
