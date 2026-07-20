import asyncio
import os
import re
import unicodedata

from database import get_db
from emailer import email_enabled, send_email


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
