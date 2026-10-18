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
    raw = f"trim({column})"
    iso_date = (
        f"substr({raw}, 7, 4) || '-' || substr({raw}, 4, 2) || '-' || substr({raw}, 1, 2)"
    )
    iso_datetime = f"{iso_date} || substr({raw}, 11, 6)"
    date_only = (
        f"length({raw}) = 10 "
        f"AND {raw} GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]' "
        f"AND substr({raw}, 7, 4) != '0000' "
        f"AND date({iso_date}, '+0 days') = {iso_date}"
    )
    date_time = (
        f"length({raw}) = 16 "
        f"AND {raw} GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9] [0-9][0-9]:[0-9][0-9]' "
        f"AND substr({raw}, 7, 4) != '0000' "
        f"AND datetime({iso_datetime}, '+0 seconds') = {iso_datetime} || ':00'"
    )
    return (
        f"CASE WHEN {column} IS NOT NULL AND ({date_only} OR {date_time}) "
        f"THEN {iso_date} "
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
