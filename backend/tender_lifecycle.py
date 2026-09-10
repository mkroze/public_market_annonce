"""Shared tender lifecycle helpers.

Tenders store the source deadline as `DD/MM/YYYY HH:MM` or `DD/MM/YYYY`.
This module provides one normalization path for admin counts, filters,
scraper persistence, DCE cleanup, and public visibility.
"""

from datetime import datetime


def parse_deadline_date(deadline: str | None) -> str | None:
    raw = (deadline or "").strip()
    if not raw:
        return None
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def deadline_date_expr(column: str = "deadline") -> str:
    return (
        f"CASE WHEN {column} IS NOT NULL AND length({column}) >= 10 "
        f"THEN substr({column}, 7, 4) || '-' || substr({column}, 4, 2) || '-' || substr({column}, 1, 2) "
        "ELSE NULL END"
    )


def deadline_state_expr(alias: str = "t") -> str:
    col = f"{alias}.deadline_date"
    fallback = deadline_date_expr(f"{alias}.deadline")
    normalized = f"COALESCE({col}, {fallback})"
    return (
        "CASE "
        f"WHEN {normalized} IS NULL THEN 'unknown' "
        f"WHEN {normalized} < date('now') THEN 'expired' "
        "ELSE 'open' END"
    )


def public_visible_condition(alias: str = "t") -> str:
    return f"COALESCE({alias}.admin_status, 'active') != 'archived'"
