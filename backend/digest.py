import asyncio
import os
import re
import unicodedata
from datetime import datetime

from database import get_db
from emailer import email_is_configured, send_email
from settings import resolve_email_config

# Wall-clock time (Morocco) the daily digest is expected to go out. Displayed in
# emails; the scheduler in main.py owns the actual firing.
DIGEST_TIME_LABEL = "07:00 (heure du Maroc)"


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


def parse_deadline(text) -> datetime | None:
    """Tender deadlines are stored as text `DD/MM/YYYY HH:MM` (or date-only).

    Returns a naive datetime, or None when the value is missing/unparseable so
    callers can push those to the end of a chronological sort.
    """
    if not text:
        return None
    raw = str(text).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def sort_by_deadline(tenders: list[dict]) -> list[dict]:
    """Ascending by nearest deadline; missing/invalid deadlines sort last."""

    def key(tender: dict):
        parsed = parse_deadline(tender.get("deadline"))
        return (parsed is None, parsed or datetime.max)

    return sorted(tenders, key=key)


async def open_matches_for_alert(
    db,
    alert: dict,
    *,
    limit: int | None = None,
    exclude_ids: set[str] | None = None,
) -> list[dict]:
    """Currently-open tenders matching an alert, sorted by nearest deadline.

    Region-normalized and budget-filtered like the matching used everywhere
    else. Shared by the digest's urgent-open shortlist and the alert preview
    endpoint so the two never drift apart. The caller owns the db connection.
    """
    from main import normalize_location  # lazy import: avoid a circular import

    exclude = exclude_ids or set()
    cursor = await db.execute(
        """SELECT t.*, td.estimation FROM tenders t
           LEFT JOIN tender_details td ON td.tender_id = t.id
           WHERE t.status = 'en_cours'"""
    )
    matches = []
    for row in await cursor.fetchall():
        tender = dict(row)
        if tender["id"] in exclude:
            continue
        tender["region"] = normalize_location(tender.get("location") or "")["region"]
        if match_alert(alert, tender) and budget_ok(alert, tender.get("estimation")):
            matches.append(tender)

    matches = sort_by_deadline(matches)
    return matches[:limit] if limit is not None else matches


def _tender_card_html(tender: dict, frontend: str) -> str:
    estimation = (tender.get("estimation") or "").strip() or "Estimation non communiquee"
    link = f"{frontend}/tenders/{tender['id']}"
    return (
        '<div style="border:1px solid #e3ddcf;border-radius:4px;background:#fffdf7;'
        'padding:12px;margin:8px 0;">'
        f'<a href="{link}" style="font-weight:bold;color:#a51c30;text-decoration:none;">'
        f'{tender.get("title", "")}</a>'
        f'<div style="font-size:13px;color:#5b5b52;margin-top:4px;">'
        f'{tender.get("entity", "")} — {tender.get("location", "")}<br>'
        f'Date limite : {tender.get("deadline", "")} · {estimation}</div></div>'
    )


def _tender_line_text(tender: dict, frontend: str) -> str:
    estimation = (tender.get("estimation") or "").strip() or "Estimation non communiquee"
    link = f"{frontend}/tenders/{tender['id']}"
    return (
        f"- {tender.get('title', '')} | {tender.get('entity', '')} | "
        f"{tender.get('location', '')} | Limite: {tender.get('deadline', '')} | "
        f"{estimation} | {link}"
    )


def render_digest(new_matches: list[dict], urgent: list[dict]) -> tuple[str, str, str]:
    """Daily digest built around two named blocks so a future HTML template can
    replace the visual layer without touching matching:

    - `Nouveaux appels d'offres`: newly imported matches (drives the subject count).
    - `A traiter bientot`: up to 5 still-open matches by nearest deadline (reminder).
    """
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    new_count = len(new_matches)
    if new_count > 1:
        subject = f"{new_count} nouveaux appels d'offres pour votre alerte"
    else:
        subject = "1 nouvel appel d'offres pour votre alerte"

    html_parts = [
        '<div style="font-family:Georgia,serif;background:#faf7f0;padding:24px;color:#2b2b2b;">',
        '<h1 style="font-size:20px;border-bottom:2px solid #a51c30;padding-bottom:8px;">Marches Publics Maroc</h1>',
        f'<p style="font-size:14px;">{new_count} nouvelle{"s" if new_count > 1 else ""} '
        f'consultation{"s" if new_count > 1 else ""} correspondent a votre alerte.</p>',
    ]
    text_parts = [
        f"{new_count} nouvelle(s) consultation(s) correspondent a votre alerte.",
        "",
    ]

    # Block 1 — new matches, visually emphasized.
    html_parts.append(
        '<h2 style="font-size:16px;color:#a51c30;margin-top:20px;">Nouveaux appels d\'offres</h2>'
    )
    text_parts.append("== Nouveaux appels d'offres ==")
    for tender in new_matches:
        html_parts.append(_tender_card_html(tender, frontend))
        text_parts.append(_tender_line_text(tender, frontend))
    text_parts.append("")

    # Block 2 — urgent open shortlist (only when there is something to remind about).
    if urgent:
        html_parts.append(
            '<h2 style="font-size:15px;color:#5b5b52;margin-top:24px;'
            'border-top:1px solid #e3ddcf;padding-top:12px;">A traiter bientot</h2>'
        )
        text_parts.append("== A traiter bientot ==")
        for tender in urgent:
            html_parts.append(_tender_card_html(tender, frontend))
            text_parts.append(_tender_line_text(tender, frontend))
        text_parts.append("")

    html_parts.append(
        f'<p style="font-size:12px;color:#5b5b52;margin-top:24px;">'
        f'Voir toutes vos opportunites : <a href="{frontend}/alerts" style="color:#a51c30;">{frontend}/alerts</a></p></div>'
    )
    text_parts.append(f"Voir toutes vos opportunites : {frontend}/alerts")

    return subject, "".join(html_parts), "\n".join(text_parts)


def render_confirmation(alert: dict) -> tuple[str, str, str]:
    """Confirmation email sent when an enabled alert is created/edited/reactivated.

    Named content blocks (status, criteria, next digest time, manage link) so the
    HTML skin can be swapped later without changing behavior.
    """
    from config import SECTORS

    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    name = (alert.get("name") or "Mon alerte").strip() or "Mon alerte"

    sectors = split_csv(alert.get("sectors", ""))
    regions = split_csv(alert.get("regions", ""))
    keywords = split_csv(alert.get("keywords", ""))
    min_b = (alert.get("min_budget") or "").strip()
    max_b = (alert.get("max_budget") or "").strip()
    if min_b or max_b:
        budget = f"{min_b or '0'} - {max_b or 'illimite'} MAD"
    else:
        budget = "Sans limite"

    criteria = [
        ("Domaines", ", ".join(SECTORS.get(code, code) for code in sectors) if sectors else "Tous les domaines"),
        ("Regions", ", ".join(regions) if regions else "Toutes les regions"),
        ("Mots-cles", ", ".join(keywords) if keywords else "Aucun"),
        ("Budget", budget),
    ]

    subject = f"Votre alerte est active : {name}"

    html_rows = "".join(
        f'<tr><td style="padding:4px 12px 4px 0;color:#5b5b52;font-size:13px;">{label}</td>'
        f'<td style="padding:4px 0;font-size:13px;">{value}</td></tr>'
        for label, value in criteria
    )
    html = (
        '<div style="font-family:Georgia,serif;background:#faf7f0;padding:24px;color:#2b2b2b;">'
        '<h1 style="font-size:20px;border-bottom:2px solid #a51c30;padding-bottom:8px;">Marches Publics Maroc</h1>'
        f'<p style="font-size:14px;">Votre alerte <strong>{name}</strong> est active.</p>'
        f'<table style="margin:12px 0;border-collapse:collapse;">{html_rows}</table>'
        f'<p style="font-size:13px;">Prochaine synthese quotidienne a {DIGEST_TIME_LABEL}, '
        "uniquement s'il y a de nouveaux appels d'offres correspondants.</p>"
        f'<p style="font-size:12px;color:#5b5b52;margin-top:24px;">'
        f'Gerer votre alerte : <a href="{frontend}/alerts" style="color:#a51c30;">{frontend}/alerts</a></p></div>'
    )

    text_lines = [
        f"Votre alerte '{name}' est active.",
        "",
        *[f"{label} : {value}" for label, value in criteria],
        "",
        f"Prochaine synthese quotidienne a {DIGEST_TIME_LABEL}, "
        "uniquement s'il y a de nouveaux appels d'offres correspondants.",
        "",
        f"Gerer votre alerte : {frontend}/alerts",
    ]

    return subject, html, "\n".join(text_lines)


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

    # Only send to verified addresses: the digest is automated bulk mail, so
    # unverified recipients would hurt deliverability (bounces/spam complaints).
    # User-initiated confirmation/test emails are unaffected by this gate.
    cursor = await db.execute(
        """SELECT a.*, u.email AS user_email FROM alert_preferences a
           JOIN users u ON u.id = a.user_id
           WHERE a.enabled = 1 AND u.email_verified_at IS NOT NULL"""
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

    # Collect this cycle's new matches per user. `alert` is kept so the urgent
    # shortlist can be computed against the same criteria (one alert per user in
    # the beta; if several exist, the first matching one drives the shortlist).
    per_user: dict[int, dict] = {}
    for alert in alerts:
        for tender in tenders:
            if not match_alert(alert, tender):
                continue
            if has_budget_bounds(alert) and not budget_ok(alert, await estimation_for(tender)):
                continue
            user = per_user.setdefault(
                alert["user_id"],
                {"email": alert["user_email"], "alert": alert, "seen": set(), "new": [], "rows": []},
            )
            if tender["id"] in user["seen"]:
                continue
            user["seen"].add(tender["id"])
            user["new"].append(tender)
            user["rows"].append((alert["id"], tender["id"]))

    email_config = await resolve_email_config()
    configured = email_is_configured(email_config)

    emails_sent = 0
    tenders_matched = 0
    for user_id, data in per_user.items():
        cursor = await db.execute(
            "SELECT tender_id FROM digest_log WHERE user_id = ?", (user_id,)
        )
        already_sent = {r["tender_id"] for r in await cursor.fetchall()}

        # Only genuinely new (never-sent) tenders drive the digest and dedup.
        new_matches = [t for t in data["new"] if t["id"] not in already_sent]
        if not new_matches:
            continue
        tenders_matched += len(new_matches)

        # Urgent-open reminder: still-open matches by nearest deadline. This is a
        # reminder, so it is NOT deduped against digest_log and never logged —
        # only the new-matches block above writes dedup rows.
        exclude = {t["id"] for t in new_matches}
        urgent = await open_matches_for_alert(
            db, data["alert"], limit=5, exclude_ids=exclude
        )

        if not configured:
            print(
                f"[digest] email not configured; "
                f"{len(new_matches)} new tenders for {data['email']} not sent"
            )
            continue

        subject, html, text = render_digest(new_matches, urgent)
        try:
            await asyncio.to_thread(send_email, email_config, data["email"], subject, html, text)
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
