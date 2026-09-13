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
    category_totals: dict[str, dict[str, int | str]] = {}

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
                "amount_minor": int(category_totals.get(category_key, {}).get("amount_minor", 0)) + amount,
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
        existing = by_currency.get(str(item["currency"]))
        if not existing or int(item["amount_minor"]) > existing["amount_minor"]:
            by_currency[str(item["currency"])] = item
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
