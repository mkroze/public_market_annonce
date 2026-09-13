# Website Costs Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only website cost ledger for internal operating expenses, with RBAC, audit logs, summaries, filters, and manual create/edit/status actions.

**Architecture:** Add the `website_costs` SQLite table in the existing idempotent database initialization path. Keep cost validation, summaries, filters, and mutations in a focused backend module, then expose them through `/api/admin/costs` routes. Add a dedicated React admin page that reuses the current admin API client, RBAC mirror, panels, metrics, pagination, toasts, and status badges.

**Tech Stack:** FastAPI, Pydantic v2, aiosqlite, SQLite, React 19, TypeScript, React Router, lucide-react, Tailwind/DaisyUI classes, Vitest, Testing Library, unittest/TestClient.

## Global Constraints

- Internal website expenses only; no customer invoices, customer payments, subscriptions, entitlements, or payment processor integration.
- Do not store API keys, SMTP passwords, provider tokens, signed payloads, authorization headers, or secrets in `website_costs`.
- Store money as integer minor units in the API and database; the UI may display decimal currency.
- Supported v1 currencies are exactly `MAD`, `USD`, and `EUR`; do not perform exchange-rate conversion.
- Summary totals must group by currency.
- Use dedicated permissions `costs.view` and `costs.manage`.
- `owner` and `admin` can view/manage costs; `auditor` can view costs; `operator` and `support` cannot view costs.
- Archive records with `archived_at`; do not permanently delete expense history.
- Every mutation writes an admin audit event.
- Follow existing admin UI patterns: sidebar route, `PageHeader`, `Panel`, `MetricCard`, `GatedButton`, `ApiError`, `DeniedState`, `FailedState`, `EmptyState`, URL-driven filters, and concise table layouts.

---

## File Structure

- Modify `backend/database.py`: create `website_costs` and indexes during `init_db`.
- Create `backend/website_costs.py`: constants, Pydantic request models, date validation, money validation, row serialization, list filtering, summary calculations, and mutation helpers.
- Modify `backend/admin.py`: add RBAC permissions/role matrix entries and `/api/admin/costs` routes that call `website_costs.py`.
- Create `backend/test_website_costs.py`: backend schema, RBAC, list, summary, validation, mutation, and audit coverage.
- Modify `frontend/src/admin/types.ts`: add cost enums, payloads, rows, summary types.
- Modify `frontend/src/admin/api.ts`: add cost API client functions.
- Modify `frontend/src/admin/permissions.ts`: mirror `costs.view` and `costs.manage`, role matrix, and nav item.
- Modify `frontend/src/admin/AdminLayout.tsx`: add `Receipt` icon mapping.
- Modify `frontend/src/admin/AdminApp.tsx`: route `/admin/costs`.
- Modify `frontend/src/admin/components/StatusBadge.tsx`: add `CostStatusBadge`.
- Create `frontend/src/admin/pages/Costs.tsx`: full admin cost ledger UI.
- Create `frontend/src/admin/__tests__/costs-permissions.test.ts`: frontend RBAC/nav mirror coverage.
- Create `frontend/src/admin/pages/__tests__/Costs.test.tsx`: page smoke coverage with mocked API and auth.

---

### Task 1: Database Schema And RBAC Foundation

**Files:**
- Modify: `backend/database.py:223-299`
- Modify: `backend/admin.py:33-78`
- Create: `backend/test_website_costs.py`

**Interfaces:**
- Consumes: existing `database.init_db()`, `admin.ROLE_PERMISSIONS`, `admin.has_permission()`, `admin.require_admin()`.
- Produces: SQLite table `website_costs`; backend permissions `costs.view` and `costs.manage`.

- [ ] **Step 1: Write failing schema and RBAC tests**

Create `backend/test_website_costs.py` with this initial content:

```python
"""Website cost admin tests: schema, RBAC, API behavior, and audit logging."""

import asyncio
import os
import tempfile
import unittest

_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("ADMIN_EMAILS", "")

import config  # noqa: E402
config.DB_PATH = os.path.join(_tmp_dir, "test_website_costs.db")

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
database.DB_PATH = config.DB_PATH

import admin  # noqa: E402
from auth import create_token, hash_password  # noqa: E402
import main  # noqa: E402


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _reset_db():
    if os.path.exists(config.DB_PATH):
        os.remove(config.DB_PATH)
    await database.init_db()


async def _make_user(email, role="user", status="active", password="pw"):
    db = await database.get_db()
    cur = await db.execute(
        "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)",
        (email, hash_password(password), email.split("@")[0], role, status),
    )
    await db.commit()
    uid = cur.lastrowid
    await db.close()
    return uid


def _auth(uid, email):
    return {"Authorization": f"Bearer {create_token(uid, email)}"}


async def _audit_count(action):
    db = await database.get_db()
    row = await (await db.execute(
        "SELECT COUNT(*) FROM admin_audit_logs WHERE action = ?",
        (action,),
    )).fetchone()
    await db.close()
    return row[0]


class WebsiteCostsSchemaAndAccessTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)

    def test_init_db_creates_website_costs_table_and_indexes(self):
        async def inspect():
            db = await database.get_db()
            cols = await (await db.execute("PRAGMA table_info(website_costs)")).fetchall()
            indexes = await (await db.execute("PRAGMA index_list(website_costs)")).fetchall()
            await db.close()
            return {row["name"] for row in cols}, {row["name"] for row in indexes}

        columns, indexes = run(inspect())
        self.assertIn("provider", columns)
        self.assertIn("amount_minor", columns)
        self.assertIn("currency", columns)
        self.assertIn("archived_at", columns)
        self.assertIn("idx_website_costs_status", indexes)
        self.assertIn("idx_website_costs_due_date", indexes)
        self.assertIn("idx_website_costs_category", indexes)

    def test_backend_role_permissions_for_costs(self):
        self.assertTrue(admin.has_permission("owner", "costs.view"))
        self.assertTrue(admin.has_permission("owner", "costs.manage"))
        self.assertTrue(admin.has_permission("admin", "costs.view"))
        self.assertTrue(admin.has_permission("admin", "costs.manage"))
        self.assertTrue(admin.has_permission("auditor", "costs.view"))
        self.assertFalse(admin.has_permission("auditor", "costs.manage"))
        self.assertFalse(admin.has_permission("operator", "costs.view"))
        self.assertFalse(admin.has_permission("support", "costs.view"))

    def test_costs_summary_requires_authentication(self):
        r = self.client.get("/api/admin/costs/summary")
        self.assertEqual(r.status_code, 401)

    def test_operator_cannot_view_costs_and_denial_is_audited(self):
        uid = run(_make_user("operator@x.com", role="operator"))
        r = self.client.get("/api/admin/costs/summary", headers=_auth(uid, "operator@x.com"))
        self.assertEqual(r.status_code, 403)
        self.assertGreaterEqual(run(_audit_count("admin.access_denied")), 1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && python -m unittest test_website_costs.WebsiteCostsSchemaAndAccessTest -v
```

Expected: failures for missing `website_costs` table/indexes and missing `costs.view` / `costs.manage` permissions.

- [ ] **Step 3: Add the database table and indexes**

In `backend/database.py`, inside the `executescript` block after `dce_extraction_log`, add:

```python
        -- Internal website operating expense ledger. Stores provider costs,
        -- never provider secrets.
        CREATE TABLE IF NOT EXISTS website_costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            amount_minor INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'MAD',
            billing_cycle TEXT NOT NULL,
            service_period_start TEXT,
            service_period_end TEXT,
            due_date TEXT,
            paid_date TEXT,
            status TEXT NOT NULL DEFAULT 'planned',
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            created_by TEXT,
            updated_by TEXT,
            archived_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_website_costs_status ON website_costs(status);
        CREATE INDEX IF NOT EXISTS idx_website_costs_due_date ON website_costs(due_date);
        CREATE INDEX IF NOT EXISTS idx_website_costs_category ON website_costs(category);
        CREATE INDEX IF NOT EXISTS idx_website_costs_currency ON website_costs(currency);
        CREATE INDEX IF NOT EXISTS idx_website_costs_archived ON website_costs(archived_at);
```

- [ ] **Step 4: Add backend permissions**

In `backend/admin.py`, update `ALL_PERMISSIONS`:

```python
ALL_PERMISSIONS = [
    "overview.view",
    "tenders.view", "tenders.moderate", "tenders.export",
    "imports.view", "imports.run", "imports.retry",
    "audit.view", "audit.export",
    "users.view", "users.suspend", "users.manage_role",
    "roles.view",
    "settings.view", "settings.manage",
    "costs.view", "costs.manage",
]
```

Update `ROLE_PERMISSIONS`:

```python
    "admin": {
        "overview.view",
        "tenders.view", "tenders.moderate", "tenders.export",
        "imports.view", "imports.run", "imports.retry",
        "audit.view", "audit.export",
        "users.view", "roles.view",
        "costs.view", "costs.manage",
    },
```

```python
    "auditor": {
        "overview.view",
        "tenders.view",
        "imports.view",
        "audit.view", "audit.export",
        "users.view", "roles.view",
        "costs.view",
    },
```

Update descriptions:

```python
    "owner": "Full control: roles, users, imports, tenders, audit, settings, costs, and high-risk operations.",
    "admin": "Manage tenders, imports, exports, and website operating costs. Cannot change roles.",
    "auditor": "Read-only access to admin data, costs, and audit logs, with audit export.",
```

- [ ] **Step 5: Run tests to verify only endpoint existence remains**

Run:

```bash
cd backend && python -m unittest test_website_costs.WebsiteCostsSchemaAndAccessTest -v
```

Expected: schema and role-permission assertions pass; endpoint tests fail with 404 until Task 2 adds read endpoints.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/database.py backend/admin.py backend/test_website_costs.py
git commit -m "feat(admin): add website cost schema and permissions"
```

---

### Task 2: Backend Cost Read Models, Filters, And Summary Endpoint

**Files:**
- Modify: `backend/test_website_costs.py`
- Create: `backend/website_costs.py`
- Modify: `backend/admin.py:940-957`

**Interfaces:**
- Consumes: `website_costs` table and `costs.view`.
- Produces:
  - `website_costs.CostListFilters`
  - `website_costs.CostPayload`
  - `website_costs.summarize_costs(db, today=None) -> dict`
  - `website_costs.list_costs(db, filters) -> dict`
  - `GET /api/admin/costs/summary`
  - `GET /api/admin/costs`

- [ ] **Step 1: Add failing read endpoint tests**

Append to `backend/test_website_costs.py`:

```python
class WebsiteCostsReadApiTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.owner_headers = _auth(self.owner_id, "owner@x.com")
        self.auditor_id = run(_make_user("auditor@x.com", role="auditor"))
        self.auditor_headers = _auth(self.auditor_id, "auditor@x.com")

    def seed_costs(self):
        async def seed():
            db = await database.get_db()
            await db.executemany(
                """INSERT INTO website_costs
                   (provider, category, description, amount_minor, currency, billing_cycle,
                    service_period_start, service_period_end, due_date, paid_date, status,
                    reference, notes, created_by, updated_by, archived_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    ("OpenAI", "ai_api", "Assistant usage", 4320, "USD", "usage_based",
                     "2026-09-01", "2026-09-30", "2026-10-05", None, "due",
                     "OPENAI-2026-09", "September usage", "owner@x.com", "owner@x.com", None),
                    ("Brevo", "email", "SMTP monthly", 19000, "MAD", "monthly",
                     "2026-09-01", "2026-09-30", "2026-09-25", "2026-09-10", "paid",
                     "BREVO-09", "", "owner@x.com", "owner@x.com", None),
                    ("Old Tool", "software", "Archived old SaaS", 1000, "EUR", "monthly",
                     "2026-09-01", "2026-09-30", "2026-09-15", None, "cancelled",
                     "OLD-1", "", "owner@x.com", "owner@x.com", "2026-09-12 10:00:00"),
                ],
            )
            await db.commit()
            await db.close()

        run(seed())

    def test_auditor_can_read_costs_summary(self):
        self.seed_costs()
        r = self.client.get("/api/admin/costs/summary", headers=self.auditor_headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("current_month", body)
        self.assertIn("annualized_recurring", body)
        self.assertNotIn("EUR", body["current_month"])

    def test_list_costs_filters_archived_by_default_and_searches(self):
        self.seed_costs()
        r = self.client.get("/api/admin/costs?q=openai", headers=self.owner_headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["data"][0]["provider"], "OpenAI")
        self.assertEqual(body["data"][0]["amount_minor"], 4320)

    def test_list_costs_filters_by_category_status_and_currency(self):
        self.seed_costs()
        r = self.client.get(
            "/api/admin/costs?category=email&status=paid&currency=MAD",
            headers=self.owner_headers,
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["data"][0]["provider"], "Brevo")
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && python -m unittest test_website_costs.WebsiteCostsReadApiTest -v
```

Expected: 404 failures for `/api/admin/costs/summary` and `/api/admin/costs`.

- [ ] **Step 3: Create backend helper module**

Create `backend/website_costs.py`:

```python
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, field_validator


CostCategory = Literal[
    "hosting", "domain", "email", "ai_api", "storage",
    "monitoring", "scraping", "software", "other",
]
BillingCycle = Literal["monthly", "yearly", "one_off", "usage_based"]
CostStatus = Literal["planned", "due", "paid", "overdue", "cancelled"]
Currency = Literal["MAD", "USD", "EUR"]

UNPAID_STATUSES = {"planned", "due", "overdue"}
SUMMARY_EMPTY = {
    "current_month": {},
    "upcoming_unpaid": {},
    "overdue": {},
    "annualized_recurring": {},
    "largest_current_month_category": {},
}


class CostPayload(BaseModel):
    provider: str
    category: CostCategory
    description: str = ""
    amount_minor: int
    currency: Currency = "MAD"
    billing_cycle: BillingCycle
    service_period_start: str | None = None
    service_period_end: str | None = None
    due_date: str | None = None
    paid_date: str | None = None
    status: CostStatus = "planned"
    reference: str = ""
    notes: str = ""

    @field_validator("provider")
    @classmethod
    def provider_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("provider is required")
        return cleaned

    @field_validator("description", "reference", "notes", mode="before")
    @classmethod
    def clean_optional_text(cls, value):
        return "" if value is None else str(value).strip()

    @field_validator("amount_minor")
    @classmethod
    def amount_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("amount_minor must be greater than 0")
        return value

    @field_validator("service_period_start", "service_period_end", "due_date", "paid_date")
    @classmethod
    def valid_iso_date(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date must use YYYY-MM-DD") from exc
        return value


class MarkPaidPayload(BaseModel):
    paid_date: str | None = None

    @field_validator("paid_date")
    @classmethod
    def valid_paid_date(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("paid_date must use YYYY-MM-DD") from exc
        return value


class CostListFilters(BaseModel):
    q: str = ""
    provider: str = ""
    category: str = ""
    status: str = ""
    currency: str = ""
    date_from: str = ""
    date_to: str = ""
    page: int = 1
    per_page: int = 25


def _row_to_cost(row) -> dict:
    return dict(row)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _add_amount(target: dict[str, int], currency: str, amount_minor: int):
    target[currency] = target.get(currency, 0) + amount_minor


def _record_month_basis(record: dict) -> tuple[date | None, date | None]:
    start = _parse_date(record.get("service_period_start"))
    end = _parse_date(record.get("service_period_end"))
    if start or end:
        return start or end, end or start
    basis = _parse_date(record.get("due_date")) or _parse_date(record.get("created_at"))
    return basis, basis


def _overlaps_month(record: dict, month_start: date, month_end: date) -> bool:
    start, end = _record_month_basis(record)
    if not start or not end:
        return False
    return start <= month_end and end >= month_start


async def summarize_costs(db, today: date | None = None) -> dict:
    today = today or date.today()
    month_start = today.replace(day=1)
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)
    month_end = date.fromordinal(next_month.toordinal() - 1)
    upcoming_end = date.fromordinal(today.toordinal() + 45)

    rows = await (await db.execute(
        "SELECT * FROM website_costs WHERE archived_at IS NULL"
    )).fetchall()

    summary = {key: value.copy() for key, value in SUMMARY_EMPTY.items()}
    category_totals: dict[str, dict[str, int]] = {}

    for row in rows:
        cost = dict(row)
        currency = cost["currency"]
        amount = cost["amount_minor"]
        status = cost["status"]
        due_date = _parse_date(cost.get("due_date"))

        if _overlaps_month(cost, month_start, month_end):
            _add_amount(summary["current_month"], currency, amount)
            category_key = f"{currency}:{cost['category']}"
            category_totals[category_key] = {
                "currency": currency,
                "category": cost["category"],
                "amount_minor": category_totals.get(category_key, {}).get("amount_minor", 0) + amount,
            }

        if status in UNPAID_STATUSES and due_date and today <= due_date <= upcoming_end:
            _add_amount(summary["upcoming_unpaid"], currency, amount)

        if status == "overdue" or (status in UNPAID_STATUSES and due_date and due_date < today):
            _add_amount(summary["overdue"], currency, amount)

        if status != "cancelled" and cost["billing_cycle"] == "monthly":
            _add_amount(summary["annualized_recurring"], currency, amount * 12)
        elif status != "cancelled" and cost["billing_cycle"] == "yearly":
            _add_amount(summary["annualized_recurring"], currency, amount)

    by_currency: dict[str, dict] = {}
    for item in category_totals.values():
        existing = by_currency.get(item["currency"])
        if not existing or item["amount_minor"] > existing["amount_minor"]:
            by_currency[item["currency"]] = item
    summary["largest_current_month_category"] = by_currency
    return summary


def _filters_where(filters: CostListFilters) -> tuple[str, list]:
    conditions = ["archived_at IS NULL"]
    params: list = []
    if filters.q:
        conditions.append("(provider LIKE ? OR description LIKE ? OR reference LIKE ?)")
        params.extend([f"%{filters.q}%"] * 3)
    if filters.provider:
        conditions.append("provider LIKE ?")
        params.append(f"%{filters.provider}%")
    if filters.category:
        conditions.append("category = ?")
        params.append(filters.category)
    if filters.status:
        conditions.append("status = ?")
        params.append(filters.status)
    if filters.currency:
        conditions.append("currency = ?")
        params.append(filters.currency)
    if filters.date_from:
        conditions.append("COALESCE(due_date, service_period_start, created_at) >= ?")
        params.append(filters.date_from)
    if filters.date_to:
        conditions.append("COALESCE(due_date, service_period_end, created_at) <= ?")
        params.append(filters.date_to)
    return "WHERE " + " AND ".join(conditions), params


async def list_costs(db, filters: CostListFilters) -> dict:
    page = max(filters.page, 1)
    per_page = min(max(filters.per_page, 1), 100)
    where, params = _filters_where(filters)
    total = (await (await db.execute(
        f"SELECT COUNT(*) FROM website_costs {where}", params
    )).fetchone())[0]
    rows = await (await db.execute(
        f"""SELECT * FROM website_costs {where}
            ORDER BY COALESCE(due_date, service_period_end, created_at) DESC, id DESC
            LIMIT ? OFFSET ?""",
        params + [per_page, (page - 1) * per_page],
    )).fetchall()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "data": [_row_to_cost(row) for row in rows],
    }
```

- [ ] **Step 4: Add read routes**

In `backend/admin.py`, import the new helpers near the other imports:

```python
from website_costs import CostListFilters, list_costs, summarize_costs
```

Add this route block before the Users section:

```python
# ── Website costs ────────────────────────────────────────────────────────────

@router.get("/costs/summary")
async def admin_costs_summary(user=Depends(require_admin("costs.view"))):
    db = await get_db()
    try:
        return await summarize_costs(db)
    finally:
        await db.close()


@router.get("/costs")
async def admin_costs(
    q: str = Query(""),
    provider: str = Query(""),
    category: str = Query(""),
    status: str = Query(""),
    currency: str = Query(""),
    date_from: str = Query(""),
    date_to: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    user=Depends(require_admin("costs.view")),
):
    filters = CostListFilters(
        q=q.strip(),
        provider=provider.strip(),
        category=category.strip(),
        status=status.strip(),
        currency=currency.strip(),
        date_from=date_from.strip(),
        date_to=date_to.strip(),
        page=page,
        per_page=per_page,
    )
    db = await get_db()
    try:
        return await list_costs(db, filters)
    finally:
        await db.close()
```

- [ ] **Step 5: Run backend read tests**

Run:

```bash
cd backend && python -m unittest test_website_costs.WebsiteCostsSchemaAndAccessTest test_website_costs.WebsiteCostsReadApiTest -v
```

Expected: all schema, access, list, and summary tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/admin.py backend/website_costs.py backend/test_website_costs.py
git commit -m "feat(admin): add website cost read endpoints"
```

---

### Task 3: Backend Cost Mutations And Audit Logging

**Files:**
- Modify: `backend/test_website_costs.py`
- Modify: `backend/website_costs.py`
- Modify: `backend/admin.py`

**Interfaces:**
- Consumes: `CostPayload`, `MarkPaidPayload`, `costs.manage`, and existing `log_audit`.
- Produces:
  - `create_cost(db, payload, actor_email) -> dict`
  - `update_cost(db, cost_id, payload, actor_email) -> tuple[dict, dict]`
  - `mark_cost_paid(db, cost_id, paid_date, actor_email) -> tuple[dict, dict]`
  - `archive_cost(db, cost_id, actor_email) -> tuple[dict, dict]`
  - `POST /api/admin/costs`
  - `PATCH /api/admin/costs/{cost_id}`
  - `POST /api/admin/costs/{cost_id}/mark-paid`
  - `POST /api/admin/costs/{cost_id}/archive`

- [ ] **Step 1: Add failing mutation tests**

Append to `backend/test_website_costs.py`:

```python
class WebsiteCostsMutationApiTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.owner_headers = _auth(self.owner_id, "owner@x.com")
        self.auditor_id = run(_make_user("auditor@x.com", role="auditor"))
        self.auditor_headers = _auth(self.auditor_id, "auditor@x.com")

    def valid_payload(self):
        return {
            "provider": "OpenAI",
            "category": "ai_api",
            "description": "Assistant usage",
            "amount_minor": 4320,
            "currency": "USD",
            "billing_cycle": "usage_based",
            "service_period_start": "2026-09-01",
            "service_period_end": "2026-09-30",
            "due_date": "2026-10-05",
            "paid_date": None,
            "status": "due",
            "reference": "OPENAI-2026-09",
            "notes": "No key material here",
        }

    def test_create_cost_audits_action(self):
        r = self.client.post("/api/admin/costs", headers=self.owner_headers, json=self.valid_payload())
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["provider"], "OpenAI")
        self.assertEqual(body["created_by"], "owner@x.com")
        self.assertGreaterEqual(run(_audit_count("cost.create")), 1)

    def test_auditor_cannot_create_cost(self):
        r = self.client.post("/api/admin/costs", headers=self.auditor_headers, json=self.valid_payload())
        self.assertEqual(r.status_code, 403)

    def test_create_rejects_invalid_amount_and_date(self):
        payload = self.valid_payload()
        payload["amount_minor"] = 0
        payload["due_date"] = "09/30/2026"
        r = self.client.post("/api/admin/costs", headers=self.owner_headers, json=payload)
        self.assertEqual(r.status_code, 422)

    def test_update_mark_paid_and_archive_cost(self):
        created = self.client.post(
            "/api/admin/costs",
            headers=self.owner_headers,
            json=self.valid_payload(),
        ).json()
        payload = self.valid_payload()
        payload["provider"] = "Anthropic"
        payload["amount_minor"] = 9900

        updated = self.client.patch(
            f"/api/admin/costs/{created['id']}",
            headers=self.owner_headers,
            json=payload,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["provider"], "Anthropic")

        paid = self.client.post(
            f"/api/admin/costs/{created['id']}/mark-paid",
            headers=self.owner_headers,
            json={"paid_date": "2026-10-01"},
        )
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.json()["status"], "paid")
        self.assertEqual(paid.json()["paid_date"], "2026-10-01")

        archived = self.client.post(
            f"/api/admin/costs/{created['id']}/archive",
            headers=self.owner_headers,
        )
        self.assertEqual(archived.status_code, 200)
        self.assertIsNotNone(archived.json()["archived_at"])

        listed = self.client.get("/api/admin/costs", headers=self.owner_headers)
        self.assertEqual(listed.json()["total"], 0)
        self.assertGreaterEqual(run(_audit_count("cost.update")), 1)
        self.assertGreaterEqual(run(_audit_count("cost.mark_paid")), 1)
        self.assertGreaterEqual(run(_audit_count("cost.archive")), 1)

    def test_mutating_missing_cost_returns_404(self):
        r = self.client.post("/api/admin/costs/999/mark-paid", headers=self.owner_headers, json={})
        self.assertEqual(r.status_code, 404)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && python -m unittest test_website_costs.WebsiteCostsMutationApiTest -v
```

Expected: 404 or import failures for mutation endpoints/functions.

- [ ] **Step 3: Add mutation helpers**

Append to `backend/website_costs.py`:

```python
WRITE_FIELDS = [
    "provider", "category", "description", "amount_minor", "currency",
    "billing_cycle", "service_period_start", "service_period_end", "due_date",
    "paid_date", "status", "reference", "notes",
]


async def get_cost(db, cost_id: int) -> dict | None:
    row = await (await db.execute(
        "SELECT * FROM website_costs WHERE id = ?",
        (cost_id,),
    )).fetchone()
    return dict(row) if row else None


async def create_cost(db, payload: CostPayload, actor_email: str | None) -> dict:
    values = payload.model_dump()
    columns = WRITE_FIELDS + ["created_by", "updated_by"]
    params = [values[field] for field in WRITE_FIELDS] + [actor_email, actor_email]
    placeholders = ", ".join("?" for _ in columns)
    cur = await db.execute(
        f"INSERT INTO website_costs ({', '.join(columns)}) VALUES ({placeholders})",
        params,
    )
    row = await get_cost(db, cur.lastrowid)
    if row is None:
        raise RuntimeError("Created cost could not be loaded")
    return row


async def update_cost(db, cost_id: int, payload: CostPayload, actor_email: str | None) -> tuple[dict, dict]:
    before = await get_cost(db, cost_id)
    if before is None or before.get("archived_at"):
        return {}, {}
    values = payload.model_dump()
    assignments = ", ".join(f"{field} = ?" for field in WRITE_FIELDS)
    params = [values[field] for field in WRITE_FIELDS] + [actor_email, cost_id]
    await db.execute(
        f"""UPDATE website_costs
            SET {assignments}, updated_at = datetime('now'), updated_by = ?
            WHERE id = ?""",
        params,
    )
    after = await get_cost(db, cost_id)
    return before, after or {}


async def mark_cost_paid(db, cost_id: int, paid_date: str | None, actor_email: str | None) -> tuple[dict, dict]:
    before = await get_cost(db, cost_id)
    if before is None or before.get("archived_at"):
        return {}, {}
    await db.execute(
        """UPDATE website_costs
           SET status = 'paid',
               paid_date = COALESCE(?, date('now')),
               updated_at = datetime('now'),
               updated_by = ?
           WHERE id = ?""",
        (paid_date, actor_email, cost_id),
    )
    after = await get_cost(db, cost_id)
    return before, after or {}


async def archive_cost(db, cost_id: int, actor_email: str | None) -> tuple[dict, dict]:
    before = await get_cost(db, cost_id)
    if before is None or before.get("archived_at"):
        return {}, {}
    await db.execute(
        """UPDATE website_costs
           SET archived_at = datetime('now'),
               updated_at = datetime('now'),
               updated_by = ?
           WHERE id = ?""",
        (actor_email, cost_id),
    )
    after = await get_cost(db, cost_id)
    return before, after or {}
```

- [ ] **Step 4: Add mutation routes and audit logs**

Update the `backend/admin.py` website-cost import:

```python
from website_costs import (
    CostListFilters, CostPayload, MarkPaidPayload,
    archive_cost, create_cost, list_costs, mark_cost_paid,
    summarize_costs, update_cost,
)
```

Add these routes after `admin_costs`:

```python
@router.post("/costs")
async def admin_create_cost(
    req: CostPayload,
    request: Request,
    user=Depends(require_admin("costs.manage")),
):
    db = await get_db()
    try:
        row = await create_cost(db, req, user.get("email"))
        await log_audit(
            db, actor=user, action="cost.create", target_type="website_cost",
            target_id=row["id"], request=request, after=row,
        )
        return row
    finally:
        await db.close()


@router.patch("/costs/{cost_id}")
async def admin_update_cost(
    cost_id: int,
    req: CostPayload,
    request: Request,
    user=Depends(require_admin("costs.manage")),
):
    db = await get_db()
    try:
        before, after = await update_cost(db, cost_id, req, user.get("email"))
        if not after:
            raise HTTPException(status_code=404, detail="Cost record not found")
        await log_audit(
            db, actor=user, action="cost.update", target_type="website_cost",
            target_id=cost_id, request=request, before=before, after=after,
        )
        return after
    finally:
        await db.close()


@router.post("/costs/{cost_id}/mark-paid")
async def admin_mark_cost_paid(
    cost_id: int,
    req: MarkPaidPayload,
    request: Request,
    user=Depends(require_admin("costs.manage")),
):
    db = await get_db()
    try:
        before, after = await mark_cost_paid(db, cost_id, req.paid_date, user.get("email"))
        if not after:
            raise HTTPException(status_code=404, detail="Cost record not found")
        await log_audit(
            db, actor=user, action="cost.mark_paid", target_type="website_cost",
            target_id=cost_id, request=request,
            before={"status": before.get("status"), "paid_date": before.get("paid_date")},
            after={"status": after.get("status"), "paid_date": after.get("paid_date")},
        )
        return after
    finally:
        await db.close()


@router.post("/costs/{cost_id}/archive")
async def admin_archive_cost(
    cost_id: int,
    request: Request,
    user=Depends(require_admin("costs.manage")),
):
    db = await get_db()
    try:
        before, after = await archive_cost(db, cost_id, user.get("email"))
        if not after:
            raise HTTPException(status_code=404, detail="Cost record not found")
        await log_audit(
            db, actor=user, action="cost.archive", target_type="website_cost",
            target_id=cost_id, request=request,
            before={"archived_at": before.get("archived_at")},
            after={"archived_at": after.get("archived_at")},
        )
        return after
    finally:
        await db.close()
```

- [ ] **Step 5: Run full backend cost tests**

Run:

```bash
cd backend && python -m unittest test_website_costs -v
```

Expected: all website cost backend tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/admin.py backend/website_costs.py backend/test_website_costs.py
git commit -m "feat(admin): add website cost mutation endpoints"
```

---

### Task 4: Frontend Types, API, RBAC, Navigation, And Route

**Files:**
- Modify: `frontend/src/admin/types.ts:1-180`
- Modify: `frontend/src/admin/api.ts:5-139`
- Modify: `frontend/src/admin/permissions.ts:5-93`
- Modify: `frontend/src/admin/AdminLayout.tsx:3-12`
- Modify: `frontend/src/admin/AdminApp.tsx:1-38`
- Create: `frontend/src/admin/__tests__/costs-permissions.test.ts`

**Interfaces:**
- Consumes: backend endpoints from Tasks 2 and 3.
- Produces:
  - `WebsiteCost`, `WebsiteCostPayload`, `WebsiteCostSummary`
  - `getCostSummary()`
  - `getCosts(params)`
  - `createCost(body)`
  - `updateCost(id, body)`
  - `markCostPaid(id, paidDate?)`
  - `archiveCost(id)`
  - `/admin/costs` route
  - `Costs` nav item gated by `costs.view`

- [ ] **Step 1: Write failing frontend RBAC/nav tests**

Create `frontend/src/admin/__tests__/costs-permissions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, can } from "../permissions";

describe("cost admin permissions", () => {
  it("grants costs view/manage to owner and admin only where specified", () => {
    expect(can("owner", "costs.view")).toBe(true);
    expect(can("owner", "costs.manage")).toBe(true);
    expect(can("admin", "costs.view")).toBe(true);
    expect(can("admin", "costs.manage")).toBe(true);
    expect(can("auditor", "costs.view")).toBe(true);
    expect(can("auditor", "costs.manage")).toBe(false);
    expect(can("operator", "costs.view")).toBe(false);
    expect(can("support", "costs.view")).toBe(false);
  });

  it("exposes a costs nav item guarded by costs.view", () => {
    expect(NAV_ITEMS).toContainEqual({
      label: "Costs",
      path: "/admin/costs",
      icon: "Receipt",
      permission: "costs.view",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/admin/__tests__/costs-permissions.test.ts --run
```

Expected: TypeScript failures because `costs.view` and `costs.manage` are not in the frontend permission union.

- [ ] **Step 3: Add cost types**

In `frontend/src/admin/types.ts`, add these exports after `DceExtractionStatus`:

```typescript
export type CostCategory =
  | "hosting" | "domain" | "email" | "ai_api" | "storage"
  | "monitoring" | "scraping" | "software" | "other";

export type BillingCycle = "monthly" | "yearly" | "one_off" | "usage_based";
export type CostStatus = "planned" | "due" | "paid" | "overdue" | "cancelled";
export type CostCurrency = "MAD" | "USD" | "EUR";

export interface WebsiteCost {
  id: number;
  provider: string;
  category: CostCategory;
  description: string;
  amount_minor: number;
  currency: CostCurrency;
  billing_cycle: BillingCycle;
  service_period_start: string | null;
  service_period_end: string | null;
  due_date: string | null;
  paid_date: string | null;
  status: CostStatus;
  reference: string;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export type WebsiteCostPayload = Omit<
  WebsiteCost,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "archived_at"
>;

export interface WebsiteCostSummary {
  current_month: Record<CostCurrency, number>;
  upcoming_unpaid: Record<CostCurrency, number>;
  overdue: Record<CostCurrency, number>;
  annualized_recurring: Record<CostCurrency, number>;
  largest_current_month_category: Partial<Record<CostCurrency, {
    currency: CostCurrency;
    category: CostCategory;
    amount_minor: number;
  }>>;
}
```

- [ ] **Step 4: Add cost API functions**

In `frontend/src/admin/api.ts`, update the import list:

```typescript
  EmailSettings, EmailSettingsPatch,
  WebsiteCost, WebsiteCostPayload, WebsiteCostSummary,
```

Add before the audit-log section:

```typescript
// ── Website costs ──
export const getCostSummary = () => request<WebsiteCostSummary>("/costs/summary");

export const getCosts = (params: Record<string, string>) =>
  request<Paginated<WebsiteCost>>("/costs", { params });

export const createCost = (body: WebsiteCostPayload) =>
  request<WebsiteCost>("/costs", { method: "POST", body });

export const updateCost = (id: number, body: WebsiteCostPayload) =>
  request<WebsiteCost>(`/costs/${id}`, { method: "PATCH", body });

export const markCostPaid = (id: number, paidDate?: string) =>
  request<WebsiteCost>(`/costs/${id}/mark-paid`, {
    method: "POST",
    body: paidDate ? { paid_date: paidDate } : {},
  });

export const archiveCost = (id: number) =>
  request<WebsiteCost>(`/costs/${id}/archive`, { method: "POST" });
```

- [ ] **Step 5: Mirror frontend permissions and navigation**

In `frontend/src/admin/permissions.ts`, extend `Permission`:

```typescript
  | "settings.view" | "settings.manage"
  | "costs.view" | "costs.manage";
```

Extend `ALL`:

```typescript
  "settings.view", "settings.manage",
  "costs.view", "costs.manage",
```

Extend `admin`:

```typescript
    "users.view", "roles.view",
    "costs.view", "costs.manage",
```

Extend `auditor`:

```typescript
    "users.view", "roles.view",
    "costs.view",
```

Update `ASSIGNABLE_LABEL.admin` and `ASSIGNABLE_LABEL.auditor`:

```typescript
  auditor: "read-only + audit/cost export",
  admin: "tenders, imports, exports, costs",
```

Add this nav item before Settings:

```typescript
  { label: "Costs", path: "/admin/costs", icon: "Receipt", permission: "costs.view" },
```

- [ ] **Step 6: Add icon mapping and route**

In `frontend/src/admin/AdminLayout.tsx`, import `Receipt`:

```typescript
  Settings, Plug, Receipt, LogOut, Menu, X, ExternalLink,
```

Add it to `ICONS`:

```typescript
  LayoutDashboard, DownloadCloud, Table2, ScrollText, Users, ShieldCheck, Settings, Plug, Receipt,
```

In `frontend/src/admin/AdminApp.tsx`, import `Costs`:

```typescript
import Costs from "./pages/Costs";
```

Add the route before Settings:

```tsx
        <Route path="costs" element={<Costs />} />
```

Create a temporary `frontend/src/admin/pages/Costs.tsx` so the route compiles until Task 5 replaces it:

```tsx
import { PageHeader } from "../components/ui";
import { EmptyState } from "../components/StateBlock";

export default function Costs() {
  return (
    <div>
      <PageHeader
        title="Costs"
        description="Internal website operating expenses and upcoming provider costs."
      />
      <EmptyState title="Costs page loading soon" hint="The ledger UI is implemented in the next task." />
    </div>
  );
}
```

- [ ] **Step 7: Run frontend permission tests**

Run:

```bash
cd frontend && npm test -- src/admin/__tests__/costs-permissions.test.ts --run
```

Expected: tests pass.

- [ ] **Step 8: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 9: Commit**

Run:

```bash
git add frontend/src/admin/types.ts frontend/src/admin/api.ts frontend/src/admin/permissions.ts frontend/src/admin/AdminLayout.tsx frontend/src/admin/AdminApp.tsx frontend/src/admin/pages/Costs.tsx frontend/src/admin/__tests__/costs-permissions.test.ts
git commit -m "feat(admin): wire website costs frontend route"
```

---

### Task 5: Frontend Costs Ledger Page

**Files:**
- Modify: `frontend/src/admin/components/StatusBadge.tsx`
- Replace: `frontend/src/admin/pages/Costs.tsx`
- Create: `frontend/src/admin/pages/__tests__/Costs.test.tsx`

**Interfaces:**
- Consumes: frontend API functions and types from Task 4.
- Produces: usable `/admin/costs` page with summaries, filters, table, add/edit form, mark-paid action, archive action, and read-only gating.

- [ ] **Step 1: Write failing page smoke tests**

Create `frontend/src/admin/pages/__tests__/Costs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Costs from "../Costs";

const mocks = vi.hoisted(() => ({
  getCostSummary: vi.fn(),
  getCosts: vi.fn(),
  createCost: vi.fn(),
  updateCost: vi.fn(),
  markCostPaid: vi.fn(),
  archiveCost: vi.fn(),
  role: "admin",
}));

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@x.com", role: mocks.role },
  }),
}));

vi.mock("../../api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  getCostSummary: mocks.getCostSummary,
  getCosts: mocks.getCosts,
  createCost: mocks.createCost,
  updateCost: mocks.updateCost,
  markCostPaid: mocks.markCostPaid,
  archiveCost: mocks.archiveCost,
}));

function seedApi() {
  mocks.getCostSummary.mockResolvedValue({
    current_month: { USD: 4320, MAD: 19000 },
    upcoming_unpaid: { USD: 4320 },
    overdue: {},
    annualized_recurring: { MAD: 228000 },
    largest_current_month_category: {
      USD: { currency: "USD", category: "ai_api", amount_minor: 4320 },
    },
  });
  mocks.getCosts.mockResolvedValue({
    total: 1,
    page: 1,
    per_page: 25,
    pages: 1,
    data: [{
      id: 1,
      provider: "OpenAI",
      category: "ai_api",
      description: "Assistant usage",
      amount_minor: 4320,
      currency: "USD",
      billing_cycle: "usage_based",
      service_period_start: "2026-09-01",
      service_period_end: "2026-09-30",
      due_date: "2026-10-05",
      paid_date: null,
      status: "due",
      reference: "OPENAI-2026-09",
      notes: "",
      created_at: "2026-09-13 10:00:00",
      updated_at: "2026-09-13 10:00:00",
      created_by: "admin@x.com",
      updated_by: "admin@x.com",
      archived_at: null,
    }],
  });
}

function renderCosts() {
  return render(
    <MemoryRouter>
      <Costs />
    </MemoryRouter>,
  );
}

describe("Costs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = "admin";
    seedApi();
  });

  it("renders summaries and cost rows", async () => {
    renderCosts();
    expect(await screen.findByRole("heading", { name: "Costs" })).toBeInTheDocument();
    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Assistant usage")).toBeInTheDocument();
    expect(screen.getByText("43,20 USD")).toBeInTheDocument();
  });

  it("opens the add cost form for managers", async () => {
    const user = userEvent.setup();
    renderCosts();
    await screen.findByText("OpenAI");
    await user.click(screen.getByRole("button", { name: /add cost/i }));
    expect(screen.getByRole("dialog", { name: /add cost/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
  });

  it("keeps mutation controls disabled for auditors", async () => {
    mocks.role = "auditor";
    renderCosts();
    await screen.findByText("OpenAI");
    expect(screen.getByRole("button", { name: /add cost/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/admin/pages/__tests__/Costs.test.tsx --run
```

Expected: failures because `Costs.tsx` is still the temporary placeholder and `CostStatusBadge` does not exist.

- [ ] **Step 3: Add cost status badge**

In `frontend/src/admin/components/StatusBadge.tsx`, add `CalendarClock` to the lucide import:

```typescript
  Eye, ShieldX, Minus, CalendarClock,
```

Append:

```tsx
export function CostStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Paid</Badge>;
    case "overdue":
      return <Badge tone="danger" icon={<AlertTriangle className={ICON} aria-hidden />}>Overdue</Badge>;
    case "due":
      return <Badge tone="warning" icon={<CalendarClock className={ICON} aria-hidden />}>Due</Badge>;
    case "cancelled":
      return <Badge tone="neutral" icon={<XCircle className={ICON} aria-hidden />}>Cancelled</Badge>;
    default:
      return <Badge tone="info" icon={<Clock className={ICON} aria-hidden />}>Planned</Badge>;
  }
}
```

- [ ] **Step 4: Replace Costs page with full ledger UI**

Replace `frontend/src/admin/pages/Costs.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, CheckCircle2, Loader2, Pencil, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import Pagination from "../../components/Pagination";
import ToastContainer from "../../components/Toast";
import {
  ApiError, archiveCost, createCost, getCostSummary,
  getCosts, markCostPaid, updateCost,
} from "../api";
import { can } from "../permissions";
import type {
  BillingCycle, CostCategory, CostCurrency, CostStatus,
  WebsiteCost, WebsiteCostPayload, WebsiteCostSummary,
} from "../types";
import { EmptyState, FailedState, FilteredEmptyState, LoadingState, DeniedState } from "../components/StateBlock";
import { GatedButton, MetricCard, PageHeader, Panel, fmtDateOnly } from "../components/ui";
import { CostStatusBadge } from "../components/StatusBadge";
import { useToasts } from "../components/useToasts";

const FILTER_KEYS = ["q", "category", "status", "currency", "date_from", "date_to"];
const CATEGORIES: CostCategory[] = ["hosting", "domain", "email", "ai_api", "storage", "monitoring", "scraping", "software", "other"];
const CURRENCIES: CostCurrency[] = ["MAD", "USD", "EUR"];
const CYCLES: BillingCycle[] = ["monthly", "yearly", "one_off", "usage_based"];
const STATUSES: CostStatus[] = ["planned", "due", "paid", "overdue", "cancelled"];

const CONTROL = "w-full border border-[var(--color-border-subtle)] bg-base-100 rounded px-3 py-2 text-sm font-sans text-[var(--color-charcoal)] focus:border-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-crimson)] transition-colors disabled:opacity-60";

const EMPTY_DRAFT: WebsiteCostPayload = {
  provider: "",
  category: "ai_api",
  description: "",
  amount_minor: 0,
  currency: "MAD",
  billing_cycle: "monthly",
  service_period_start: null,
  service_period_end: null,
  due_date: null,
  paid_date: null,
  status: "planned",
  reference: "",
  notes: "",
};

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatGrouped(values: Record<string, number> | undefined): string {
  const entries = Object.entries(values || {}).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return "0.00";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

function draftFrom(cost: WebsiteCost): WebsiteCostPayload {
  return {
    provider: cost.provider,
    category: cost.category,
    description: cost.description,
    amount_minor: cost.amount_minor,
    currency: cost.currency,
    billing_cycle: cost.billing_cycle,
    service_period_start: cost.service_period_start,
    service_period_end: cost.service_period_end,
    due_date: cost.due_date,
    paid_date: cost.paid_date,
    status: cost.status,
    reference: cost.reference,
    notes: cost.notes,
  };
}

function amountInputValue(amountMinor: number): string {
  return amountMinor ? String(amountMinor / 100) : "";
}

function parseAmountMinor(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  return Math.round(Number(normalized) * 100);
}

export default function Costs() {
  const { user } = useAuth();
  const canManage = can(user?.role, "costs.manage");
  const { toasts, push, dismiss } = useToasts();
  const [params, setParams] = useSearchParams();
  const [summary, setSummary] = useState<WebsiteCostSummary | null>(null);
  const [rows, setRows] = useState<WebsiteCost[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<WebsiteCost | null>(null);
  const [draft, setDraft] = useState<WebsiteCostPayload | null>(null);
  const [saving, setSaving] = useState(false);

  const page = Number(params.get("page") || "1");
  const hasFilters = FILTER_KEYS.some((key) => params.get(key));

  const load = useCallback(() => {
    setLoading(true);
    const query: Record<string, string> = { page: String(page), per_page: "25" };
    FILTER_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) query[key] = value;
    });
    Promise.all([getCostSummary(), getCosts(query)])
      .then(([summaryRes, listRes]) => {
        setSummary(summaryRes);
        setRows(listRes.data);
        setTotal(listRes.total);
        setPages(listRes.pages);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [page, params]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  function clearFilters() {
    setParams(new URLSearchParams());
  }

  function openCreate() {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(cost: WebsiteCost) {
    setEditing(cost);
    setDraft(draftFrom(cost));
  }

  function patchDraft(patch: Partial<WebsiteCostPayload>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function submitDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !canManage || draft.amount_minor <= 0) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCost(editing.id, draft);
        push("Cost updated", "success");
      } else {
        await createCost(draft);
        push("Cost created", "success");
      }
      setDraft(null);
      setEditing(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to save cost", "error");
    } finally {
      setSaving(false);
    }
  }

  async function doMarkPaid(cost: WebsiteCost) {
    if (!canManage) return;
    try {
      await markCostPaid(cost.id);
      push("Cost marked as paid", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to mark paid", "error");
    }
  }

  async function doArchive(cost: WebsiteCost) {
    if (!canManage) return;
    try {
      await archiveCost(cost.id);
      push("Cost archived", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to archive cost", "error");
    }
  }

  const largest = useMemo(() => {
    if (!summary) return "—";
    return Object.values(summary.largest_current_month_category)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => `${label(item.category)} · ${formatMoney(item.amount_minor, item.currency)}`)
      .join(" · ") || "—";
  }, [summary]);

  if (loading) return <LoadingState label="Loading costs" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Costs"
        description="Internal website operating expenses, provider renewals, and API usage costs."
        actions={
          <GatedButton allowed={canManage} reason="Requires costs.manage permission" onClick={openCreate}>
            <Plus className="w-4 h-4" aria-hidden /> Add cost
          </GatedButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Current month" value={<span className="text-base">{formatGrouped(summary?.current_month)}</span>} sub={largest} />
        <MetricCard label="Upcoming unpaid" value={<span className="text-base">{formatGrouped(summary?.upcoming_unpaid)}</span>} sub="Due in the next 45 days" />
        <MetricCard label="Overdue" value={<span className="text-base">{formatGrouped(summary?.overdue)}</span>} tone={Object.keys(summary?.overdue || {}).length ? "danger" : "neutral"} />
        <MetricCard label="Annualized recurring" value={<span className="text-base">{formatGrouped(summary?.annualized_recurring)}</span>} sub="Monthly and yearly costs" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          aria-label="Search provider, description, reference"
          placeholder="Search provider, description, reference"
          className={`${CONTROL} w-72`}
          defaultValue={params.get("q") || ""}
          onKeyDown={(event) => {
            if (event.key === "Enter") setFilter("q", (event.target as HTMLInputElement).value);
          }}
        />
        <select aria-label="Category" className={`${CONTROL} w-40`} value={params.get("category") || ""} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">Any category</option>
          {CATEGORIES.map((category) => <option key={category} value={category}>{label(category)}</option>)}
        </select>
        <select aria-label="Status" className={`${CONTROL} w-36`} value={params.get("status") || ""} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
        </select>
        <select aria-label="Currency" className={`${CONTROL} w-32`} value={params.get("currency") || ""} onChange={(e) => setFilter("currency", e.target.value)}>
          <option value="">Any currency</option>
          {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          From <input type="date" aria-label="Date from" className={`${CONTROL} w-40`} value={params.get("date_from") || ""} onChange={(e) => setFilter("date_from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          To <input type="date" aria-label="Date to" className={`${CONTROL} w-40`} value={params.get("date_to") || ""} onChange={(e) => setFilter("date_to", e.target.value)} />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
            Clear filters
          </button>
        )}
      </div>

      <Panel>
        {rows.length === 0 ? (
          hasFilters
            ? <FilteredEmptyState onReset={clearFilters} />
            : <EmptyState title="No costs recorded" hint="Add provider costs as they appear so the website burn rate stays visible." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-4 py-2 font-medium">Provider</th>
                  <th scope="col" className="px-4 py-2 font-medium">Category</th>
                  <th scope="col" className="px-4 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Cycle</th>
                  <th scope="col" className="px-4 py-2 font-medium">Due / period</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-2 font-medium">Updated</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((cost) => (
                  <tr key={cost.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--color-charcoal)]">{cost.provider}</div>
                      <div className="text-xs text-[var(--color-slate)]">{cost.description || "—"}</div>
                    </td>
                    <td className="px-4 py-2 capitalize">{label(cost.category)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(cost.amount_minor, cost.currency)}</td>
                    <td className="px-4 py-2 capitalize">{label(cost.billing_cycle)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      <div>{fmtDateOnly(cost.due_date)}</div>
                      <div className="text-xs text-[var(--color-slate)]">
                        {fmtDateOnly(cost.service_period_start)} → {fmtDateOnly(cost.service_period_end)}
                      </div>
                    </td>
                    <td className="px-4 py-2"><CostStatusBadge status={cost.status} /></td>
                    <td className="px-4 py-2 text-[var(--color-slate)]">{cost.reference || "—"}</td>
                    <td className="px-4 py-2">
                      <div className="tabular-nums">{fmtDateOnly(cost.updated_at)}</div>
                      <div className="text-xs text-[var(--color-slate)]">{cost.updated_by || "—"}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(cost)}
                          disabled={!canManage}
                          title={!canManage ? "Requires costs.manage permission" : "Edit cost"}
                          aria-label={`Edit ${cost.provider}`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => doMarkPaid(cost)}
                          disabled={!canManage || cost.status === "paid"}
                          title={!canManage ? "Requires costs.manage permission" : cost.status === "paid" ? "Already paid" : "Mark paid"}
                          aria-label={`Mark ${cost.provider} paid`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => doArchive(cost)}
                          disabled={!canManage}
                          title={!canManage ? "Requires costs.manage permission" : "Archive cost"}
                          aria-label={`Archive ${cost.provider}`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <Archive className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4">
              <Pagination
                page={page}
                pages={pages}
                total={total}
                onPageChange={(nextPage) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(nextPage));
                  setParams(next);
                }}
              />
            </div>
          </div>
        )}
      </Panel>

      {draft && (
        <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label={editing ? "Edit cost" : "Add cost"}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDraft(null)} />
          <form onSubmit={submitDraft} className="relative h-full w-full max-w-xl overflow-y-auto bg-base-100 border-l border-[var(--color-border-subtle)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-[var(--color-charcoal)]">{editing ? "Edit cost" : "Add cost"}</h2>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="p-1 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Provider</span>
                <input className={CONTROL} value={draft.provider} onChange={(e) => patchDraft({ provider: e.target.value })} required />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Description</span>
                <input className={CONTROL} value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Amount</span>
                <input className={CONTROL} inputMode="decimal" value={amountInputValue(draft.amount_minor)} onChange={(e) => patchDraft({ amount_minor: parseAmountMinor(e.target.value) })} required />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Currency</span>
                <select className={CONTROL} value={draft.currency} onChange={(e) => patchDraft({ currency: e.target.value as CostCurrency })}>
                  {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Category</span>
                <select className={CONTROL} value={draft.category} onChange={(e) => patchDraft({ category: e.target.value as CostCategory })}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{label(category)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Cycle</span>
                <select className={CONTROL} value={draft.billing_cycle} onChange={(e) => patchDraft({ billing_cycle: e.target.value as BillingCycle })}>
                  {CYCLES.map((cycle) => <option key={cycle} value={cycle}>{label(cycle)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Status</span>
                <select className={CONTROL} value={draft.status} onChange={(e) => patchDraft({ status: e.target.value as CostStatus })}>
                  {STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Due date</span>
                <input type="date" className={CONTROL} value={draft.due_date || ""} onChange={(e) => patchDraft({ due_date: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Service start</span>
                <input type="date" className={CONTROL} value={draft.service_period_start || ""} onChange={(e) => patchDraft({ service_period_start: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Service end</span>
                <input type="date" className={CONTROL} value={draft.service_period_end || ""} onChange={(e) => patchDraft({ service_period_end: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Paid date</span>
                <input type="date" className={CONTROL} value={draft.paid_date || ""} onChange={(e) => patchDraft({ paid_date: e.target.value || null })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Reference</span>
                <input className={CONTROL} value={draft.reference} onChange={(e) => patchDraft({ reference: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Notes</span>
                <textarea className={`${CONTROL} min-h-24`} value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !draft.provider.trim() || draft.amount_minor <= 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans font-medium rounded text-white bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-dark)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
```

- [ ] **Step 5: Run page tests**

Run:

```bash
cd frontend && npm test -- src/admin/pages/__tests__/Costs.test.tsx --run
```

Expected: tests pass.

- [ ] **Step 6: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/admin/components/StatusBadge.tsx frontend/src/admin/pages/Costs.tsx frontend/src/admin/pages/__tests__/Costs.test.tsx
git commit -m "feat(admin): build website costs ledger page"
```

---

### Task 6: End-To-End Verification And Admin Roles Matrix Check

**Files:**
- Modify only if verification reveals defects in files touched by Tasks 1-5.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified feature with backend and frontend passing checks.

- [ ] **Step 1: Run backend cost tests**

Run:

```bash
cd backend && python -m unittest test_website_costs -v
```

Expected: all tests pass.

- [ ] **Step 2: Run existing admin tests**

Run:

```bash
cd backend && python -m unittest test_admin -v
```

Expected: all existing admin tests pass with the expanded permission matrix.

- [ ] **Step 3: Run frontend costs tests**

Run:

```bash
cd frontend && npm test -- src/admin/__tests__/costs-permissions.test.ts src/admin/pages/__tests__/Costs.test.tsx --run
```

Expected: all targeted frontend tests pass.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 5: Run whole-project Docker build smoke check**

Run:

```bash
npm run docker:build
```

Expected: image build completes.

- [ ] **Step 6: Manual local smoke path**

Run:

```bash
npm run dev
```

Expected: backend starts on port 8000 and frontend starts on port 5173.

In the browser:

- Log in as an `owner` or `admin`.
- Open `/admin/costs`.
- Add `OpenAI`, category `ai_api`, amount `43.20`, currency `USD`, cycle `usage_based`, status `due`, service period `2026-09-01` to `2026-09-30`.
- Confirm the row appears as `43,20 USD`.
- Mark it paid and confirm the status badge changes to `Paid`.
- Archive it and confirm it disappears from the default list.
- Log in or force a user role of `auditor` and confirm rows are readable but add/edit/mark-paid/archive controls are disabled.

- [ ] **Step 7: Commit verification fixes**

If Step 1-6 required fixes, commit them:

```bash
git add backend frontend
git commit -m "fix(admin): stabilize website costs verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan covers internal-only costs, dedicated RBAC, no secret storage, integer minor-unit money, currencies, grouped summaries, filters, create/edit/mark-paid/archive, soft archive, audit logging, and frontend admin integration.
- Scope check: customer billing, entitlements, payment processors, API-key storage, and provider API imports stay out of v1.
- Type consistency: backend `amount_minor`, `billing_cycle`, `archived_at`, and cost enum names match frontend `WebsiteCost` and `WebsiteCostPayload`.
- Risk notes: the frontend page uses manual entry and does not add automatic currency conversion. Summary cards show grouped amounts by currency.
