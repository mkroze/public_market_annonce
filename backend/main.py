import asyncio
import os
import re
import unicodedata
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env (nearest one, searching up from the working directory) before any
# module reads os.getenv — SMTP creds, DIGEST_HOUR, ADMIN_EMAILS, etc.
load_dotenv()
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
import csv
from io import BytesIO, StringIO

from fastapi import FastAPI, Query, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import anthropic

from database import init_db, get_db
from legal_context import SYSTEM_PROMPT
from scraper import scrape_all_sectors, scrape_homepage_counts, scrape_tender_detail, ensure_tender_details
from dce_cache import ensure_dce_cached
from config import SECTORS, CATEGORIES
from auth import hash_password, verify_password, create_token, decode_token
from digest import run_digest, open_matches_for_alert, render_confirmation
from emailer import email_is_configured, send_email
from settings import resolve_email_config
from admin import router as admin_router, bootstrap_admins, is_bootstrap_admin_email
from tender_display import build_tender_display


scrape_lock = asyncio.Lock()


async def run_scrape_and_digest(actor_email: str | None = None, trigger: str = "scheduled") -> dict:
    async with scrape_lock:
        result = await scrape_all_sectors(actor_email=actor_email, trigger=trigger)
        new_ids = result.pop("new_ids", [])
        digest_result = await run_digest(new_ids)
        return {**result, **digest_result}


# The product contract is 07:00 Morocco time. Anchoring the scheduler to an
# explicit zone (rather than server-local time) keeps firing correct regardless
# of host TZ and across Morocco's DST/Ramadan wall-clock shifts.
MOROCCO_TZ = ZoneInfo("Africa/Casablanca")


async def daily_scheduler():
    hour = int(os.getenv("DIGEST_HOUR", "7"))
    while True:
        now = datetime.now(MOROCCO_TZ)
        target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        await asyncio.sleep(max(0.0, (target - now).total_seconds()))
        try:
            result = await run_scrape_and_digest()
            print(f"[scheduler] daily scrape+digest done: {result}")
        except Exception as e:
            print(f"[scheduler] daily scrape+digest failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bootstrap_admins()
    scheduler_task = asyncio.create_task(daily_scheduler())
    yield
    scheduler_task.cancel()


app = FastAPI(title="Marchés Publics Maroc API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)


# ── V1 catalog surface guard ─────────────────────────────────────────────────

# Auth entry points stay public so visitors can obtain a session.
V1_PUBLIC_API_PATHS = {"/api/auth/login", "/api/auth/register"}

# The launch API surface is intentionally narrow. Some paths are public reads;
# actions and account data are authenticated below.
V1_ALLOWED_API_PATHS = V1_PUBLIC_API_PATHS | {"/api/filters", "/api/auth/me"}


def is_tender_action_path(path: str) -> bool:
    return (
        path == "/api/tenders/export"
        or path.endswith("/pdf")
        or path.endswith("/dce")
    )


def is_public_v1_api_path(path: str, method: str) -> bool:
    if path in V1_PUBLIC_API_PATHS:
        return True
    if method != "GET":
        return False
    if path == "/api/filters":
        return True
    if path == "/api/tenders":
        return True
    if path.startswith("/api/tenders/") and not is_tender_action_path(path):
        return True
    return False


def requires_v1_auth(path: str, method: str) -> bool:
    if is_public_v1_api_path(path, method):
        return False
    return path.startswith("/api/")


def is_v1_catalog_api_path(path: str) -> bool:
    return (
        path in V1_ALLOWED_API_PATHS
        or path == "/api/tenders"
        or path.startswith("/api/tenders/")
        or path == "/api/alerts"
        or path.startswith("/api/alerts/")
        or path == "/api/account"
        or path.startswith("/api/account/")
        or path == "/api/favorites"
        or path.startswith("/api/favorites/")
        or path == "/api/admin"
        or path.startswith("/api/admin/")
    )


@app.middleware("http")
async def restrict_v1_api_surface(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and request.method != "OPTIONS":
        if not is_v1_catalog_api_path(path):
            return Response(status_code=404)
        if requires_v1_auth(path, request.method):
            user = await get_current_user(request.headers.get("authorization"))
            if not user:
                return Response(status_code=401)
    return await call_next(request)


# ── Auth helpers ─────────────────────────────────────────────────────────────

async def get_current_user(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data:
        return None
    db = await get_db()
    cursor = await db.execute("SELECT * FROM users WHERE id = ?", (data["sub"],))
    user = await cursor.fetchone()
    await db.close()
    return dict(user) if user else None


async def require_user(authorization: str | None = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    return user


# ── Auth endpoints ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    company: str = ""
    phone: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AccountPreferencesRequest(BaseModel):
    theme: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    db = await get_db()
    existing = await db.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if await existing.fetchone():
        await db.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    pw_hash = hash_password(req.password)
    cursor = await db.execute(
        "INSERT INTO users (email, password_hash, name, company, phone) VALUES (?, ?, ?, ?, ?)",
        (req.email, pw_hash, req.name, req.company, req.phone),
    )
    user_id = cursor.lastrowid

    # Promote ADMIN_EMAILS-listed accounts to owner at registration time so the
    # first admin can trigger an import without a server restart. bootstrap_admins()
    # still runs at startup as the fallback for accounts created before this ran.
    role = "user"
    if is_bootstrap_admin_email(req.email):
        await db.execute("UPDATE users SET role = 'owner' WHERE id = ?", (user_id,))
        role = "owner"

    await db.commit()
    await db.close()

    token = create_token(user_id, req.email)
    return {"token": token, "user": {"id": user_id, "email": req.email, "name": req.name, "plan": "free", "role": role, "status": "active", "theme": "system"}}


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    user = await cursor.fetchone()
    await db.close()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = dict(user)
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Account is not active")

    db = await get_db()
    await db.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user["id"],))
    await db.commit()
    await db.close()

    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "plan": user["plan"],
            "company": user.get("company", ""),
            "role": user.get("role", "user"),
            "status": user.get("status", "active"),
            "theme": user.get("theme", "system") or "system",
        },
    }


@app.get("/api/auth/me")
async def me(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "plan": user["plan"],
        "company": user.get("company", ""),
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "theme": user.get("theme", "system") or "system",
    }


ALLOWED_ACCOUNT_THEMES = {"system", "light", "dark"}


def account_view(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "company": user.get("company", "") or "",
        "phone": user.get("phone", "") or "",
        "plan": user.get("plan", "free"),
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "theme": user.get("theme", "system") or "system",
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
    }


@app.get("/api/account")
async def get_account(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    return account_view(user)


@app.patch("/api/account/preferences")
async def update_account_preferences(
    req: AccountPreferencesRequest,
    authorization: str | None = Header(None),
):
    user = await require_user(authorization)
    if req.theme not in ALLOWED_ACCOUNT_THEMES:
        raise HTTPException(status_code=422, detail="Theme must be system, light, or dark")

    db = await get_db()
    try:
        await db.execute("UPDATE users SET theme = ? WHERE id = ?", (req.theme, user["id"]))
        await db.commit()
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
        updated = await cursor.fetchone()
        return account_view(dict(updated))
    finally:
        await db.close()


@app.post("/api/account/change-password")
async def change_account_password(
    req: ChangePasswordRequest,
    authorization: str | None = Header(None),
):
    user = await require_user(authorization)
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 8 caracteres.")
    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit etre different.")
    if not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

    db = await get_db()
    try:
        await db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(req.new_password), user["id"]),
        )
        await db.commit()
    finally:
        await db.close()
    return {"status": "updated"}


# ── Tenders ──────────────────────────────────────────────────────────────────

@app.get("/api/tenders")
async def list_tenders(
    q: str = Query("", description="Keyword search"),
    category: str = Query("", description="Travaux, Fournitures, Services"),
    sector: str = Query("", description="Sector code like 1.12"),
    entity: str = Query("", description="Entity name filter"),
    location: str = Query("", description="Location / province filter"),
    status: str = Query("", description="en_cours, cloture"),
    procedure_type: str = Query("", description="Procedure type like AOO, AOS, AMI"),
    sort: str = Query("deadline", description="Sort field"),
    order: str = Query("asc", description="asc or desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    db = await get_db()
    conditions = []
    params = []

    if q:
        conditions.append("(title LIKE ? OR reference LIKE ? OR entity LIKE ?)")
        params.extend([f"%{q}%"] * 3)
    if category:
        conditions.append("category = ?")
        params.append(category)
    if sector:
        conditions.append("sector_code = ?")
        params.append(sector)
    if entity:
        conditions.append("entity LIKE ?")
        params.append(f"%{entity}%")
    if location:
        conditions.append("location LIKE ?")
        params.append(f"%{location}%")
    if status:
        conditions.append("status = ?")
        params.append(status)
    if procedure_type:
        conditions.append("procedure_type = ?")
        params.append(procedure_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    allowed_sort = {"deadline", "publication_date", "title", "entity", "location", "scraped_at", "estimation"}
    sort_col = sort if sort in allowed_sort else "deadline"
    sort_dir = "DESC" if order.lower() == "desc" else "ASC"

    # Prefix columns with t. for the JOIN query
    if sort_col == "estimation":
        order_clause = f"td.estimation {sort_dir}"
    else:
        order_clause = f"t.{sort_col} {sort_dir}"

    where_prefixed = where.replace("WHERE ", "WHERE ").replace("title", "t.title").replace("reference", "t.reference").replace("entity", "t.entity").replace("category", "t.category").replace("sector_code", "t.sector_code").replace("location", "t.location").replace("status", "t.status").replace("procedure_type", "t.procedure_type") if where else ""

    count_row = await db.execute(f"SELECT COUNT(*) as total FROM tenders t {where_prefixed}", params)
    total = (await count_row.fetchone())[0]

    offset = (page - 1) * per_page
    query = f"""
        SELECT t.*, td.estimation, td.caution_provisoire FROM tenders t
        LEFT JOIN tender_details td ON td.tender_id = t.id
        {where_prefixed}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(query, params + [per_page, offset])
    rows = await cursor.fetchall()
    await db.close()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "data": [dict(r) for r in rows],
    }


@app.get("/api/tenders/export")
async def export_tenders(
    format: str = Query("csv", description="csv, json, or excel"),
    q: str = Query(""),
    category: str = Query(""),
    sector: str = Query(""),
    entity: str = Query(""),
    location: str = Query(""),
    status: str = Query(""),
    procedure_type: str = Query(""),
    sort: str = Query("deadline"),
    order: str = Query("asc"),
):
    """Export all matching tenders (no pagination) as CSV, JSON, or Excel."""
    db = await get_db()
    conditions = []
    params = []

    if q:
        conditions.append("(title LIKE ? OR reference LIKE ? OR entity LIKE ?)")
        params.extend([f"%{q}%"] * 3)
    if category:
        conditions.append("category = ?")
        params.append(category)
    if sector:
        conditions.append("sector_code = ?")
        params.append(sector)
    if entity:
        conditions.append("entity LIKE ?")
        params.append(f"%{entity}%")
    if location:
        conditions.append("location LIKE ?")
        params.append(f"%{location}%")
    if status:
        conditions.append("status = ?")
        params.append(status)
    if procedure_type:
        conditions.append("procedure_type = ?")
        params.append(procedure_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    allowed_sort = {"deadline", "publication_date", "title", "entity", "location", "scraped_at"}
    sort_col = sort if sort in allowed_sort else "deadline"
    sort_dir = "DESC" if order.lower() == "desc" else "ASC"

    cursor = await db.execute(
        f"SELECT * FROM tenders {where} ORDER BY {sort_col} {sort_dir} LIMIT 10000",
        params,
    )
    rows = await cursor.fetchall()
    await db.close()

    columns = ["reference", "title", "entity", "category", "sector_name", "location",
               "deadline", "publication_date", "status", "procedure_type"]

    if format == "json":
        data = [{col: dict(r).get(col, "") for col in columns} for r in rows]
        import json as json_mod
        content = json_mod.dumps(data, ensure_ascii=False, indent=2)
        return Response(
            content=content.encode("utf-8"),
            media_type="application/json",
            headers={
                "Content-Disposition": 'attachment; filename="consultations.json"',
                "Content-Type": "application/json; charset=utf-8",
            },
        )

    if format == "excel":
        # Generate CSV with BOM for Excel compatibility
        buf = StringIO()
        buf.write("\ufeff")  # UTF-8 BOM for Excel
        writer = csv.writer(buf, delimiter=";")  # semicolon for French Excel
        headers_fr = ["Référence", "Objet", "Entité", "Catégorie", "Secteur",
                       "Localisation", "Date limite", "Date publication", "Statut", "Procédure"]
        writer.writerow(headers_fr)
        for r in rows:
            d = dict(r)
            writer.writerow([d.get(col, "") for col in columns])
        return Response(
            content=buf.getvalue().encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="consultations.csv"',
            },
        )

    # Default: CSV (standard comma-separated)
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for r in rows:
        d = dict(r)
        writer.writerow([d.get(col, "") for col in columns])
    return Response(
        content=buf.getvalue().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="consultations.csv"',
        },
    )


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
    if not detail and result.get("detail_url"):
        detail = await ensure_tender_details(db, tender_id, result["detail_url"])

    await db.close()

    if detail:
        result["details"] = detail

    normalized = build_tender_display(result, detail)
    result["display"] = normalized["display"]
    result["signals"] = normalized["signals"]
    return result


# ── Overview & Stats ─────────────────────────────────────────────────────────

@app.get("/api/overview")
async def overview():
    counts = await scrape_homepage_counts()
    total = sum(c["count"] for c in counts)
    return {"total_active": total, "sectors": counts}


@app.get("/api/stats")
async def stats():
    db = await get_db()

    total = (await (await db.execute("SELECT COUNT(*) FROM tenders")).fetchone())[0]

    cat_cursor = await db.execute(
        "SELECT category, COUNT(*) as count FROM tenders GROUP BY category ORDER BY count DESC"
    )
    by_category = [dict(r) for r in await cat_cursor.fetchall()]

    sector_cursor = await db.execute(
        """SELECT sector_code, sector_name, category, COUNT(*) as count
           FROM tenders GROUP BY sector_code ORDER BY count DESC LIMIT 20"""
    )
    top_sectors = [dict(r) for r in await sector_cursor.fetchall()]

    entity_cursor = await db.execute(
        "SELECT entity, COUNT(*) as count FROM tenders GROUP BY entity ORDER BY count DESC LIMIT 20"
    )
    top_entities = [dict(r) for r in await entity_cursor.fetchall()]

    active = (
        await (await db.execute("SELECT COUNT(*) FROM tenders WHERE status = 'en_cours'")).fetchone()
    )[0]

    # deadline is stored as 'DD/MM/YYYY HH:MM' — rebuild an ISO date for comparison
    closing_7d = (
        await (
            await db.execute(
                """SELECT COUNT(*) FROM tenders
                   WHERE status = 'en_cours'
                     AND length(deadline) >= 10
                     AND substr(deadline,7,4) || '-' || substr(deadline,4,2) || '-' || substr(deadline,1,2)
                         BETWEEN date('now') AND date('now', '+7 day')"""
            )
        ).fetchone()
    )[0]

    new_7d = (
        await (
            await db.execute(
                "SELECT COUNT(*) FROM tenders WHERE scraped_at >= datetime('now', '-7 day')"
            )
        ).fetchone()
    )[0]

    distinct_buyers = (
        await (await db.execute("SELECT COUNT(DISTINCT entity) FROM tenders")).fetchone()
    )[0]

    proc_cursor = await db.execute(
        "SELECT procedure_type, COUNT(*) as count FROM tenders GROUP BY procedure_type ORDER BY count DESC"
    )
    by_procedure = [dict(r) for r in await proc_cursor.fetchall()]

    await db.close()

    return {
        "total": total,
        "by_category": by_category,
        "top_sectors": top_sectors,
        "top_entities": top_entities,
        "kpis": {
            "active": active,
            "closing_7d": closing_7d,
            "new_7d": new_7d,
            "distinct_buyers": distinct_buyers,
        },
        "by_procedure": by_procedure,
    }


@app.get("/api/filters")
async def get_filters():
    db = await get_db()

    entities = await db.execute(
        "SELECT DISTINCT entity FROM tenders WHERE entity != '' ORDER BY entity"
    )
    entity_list = [r[0] for r in await entities.fetchall()]

    sectors = await db.execute(
        "SELECT DISTINCT sector_code, sector_name FROM tenders ORDER BY sector_code"
    )
    sector_list = [{"code": r[0], "name": r[1]} for r in await sectors.fetchall()]

    locations = await db.execute(
        "SELECT DISTINCT location FROM tenders WHERE location != '' ORDER BY location"
    )
    location_list = [r[0] for r in await locations.fetchall()]

    statuses = await db.execute(
        "SELECT DISTINCT status FROM tenders WHERE status != '' ORDER BY status"
    )
    status_list = [r[0] for r in await statuses.fetchall()]

    procedures = await db.execute(
        "SELECT DISTINCT procedure_type FROM tenders WHERE procedure_type != '' ORDER BY procedure_type"
    )
    procedure_list = [r[0] for r in await procedures.fetchall()]

    await db.close()

    return {
        "categories": [{"code": k, "name": v} for k, v in CATEGORIES.items()],
        "sectors": sector_list,
        "entities": entity_list,
        "locations": location_list,
        "regions": sorted(REGIONS),
        "statuses": status_list,
        "procedure_types": procedure_list,
    }


# ── Cities ───────────────────────────────────────────────────────────────────

CITY_REGIONS = {
    "Rabat": "Rabat-Sale-Kenitra",
    "Sale": "Rabat-Sale-Kenitra",
    "Kenitra": "Rabat-Sale-Kenitra",
    "Khemisset": "Rabat-Sale-Kenitra",
    "Sidi Kacem": "Rabat-Sale-Kenitra",
    "Sidi Slimane": "Rabat-Sale-Kenitra",
    "Skhirate-Temara": "Rabat-Sale-Kenitra",
    "Casablanca": "Casablanca-Settat",
    "Mohammedia": "Casablanca-Settat",
    "Settat": "Casablanca-Settat",
    "El Jadida": "Casablanca-Settat",
    "Berrechid": "Casablanca-Settat",
    "Benslimane": "Casablanca-Settat",
    "Mediouna": "Casablanca-Settat",
    "Nouaceur": "Casablanca-Settat",
    "Sidi Bennour": "Casablanca-Settat",
    "Marrakech": "Marrakech-Safi",
    "Safi": "Marrakech-Safi",
    "Essaouira": "Marrakech-Safi",
    "Chichaoua": "Marrakech-Safi",
    "El Kelaa Des Sraghna": "Marrakech-Safi",
    "Rehamna": "Marrakech-Safi",
    "Al Haouz": "Marrakech-Safi",
    "Youssoufia": "Marrakech-Safi",
    "Tanger-Assilah": "Tanger-Tetouan-Al Hoceima",
    "Tetouan": "Tanger-Tetouan-Al Hoceima",
    "Al Hoceima": "Tanger-Tetouan-Al Hoceima",
    "Larache": "Tanger-Tetouan-Al Hoceima",
    "Chefchaouen": "Tanger-Tetouan-Al Hoceima",
    "Mdiq-Fnideq": "Tanger-Tetouan-Al Hoceima",
    "Ouezzane": "Tanger-Tetouan-Al Hoceima",
    "Fahs-Anjra": "Tanger-Tetouan-Al Hoceima",
    "Fes": "Fes-Meknes",
    "Meknes": "Fes-Meknes",
    "Taza": "Fes-Meknes",
    "Ifrane": "Fes-Meknes",
    "Taounate": "Fes-Meknes",
    "Moulay Yacoub": "Fes-Meknes",
    "Sefrou": "Fes-Meknes",
    "Boulemane": "Fes-Meknes",
    "El Hajeb": "Fes-Meknes",
    "Agadir Ida Ou Tanane": "Souss-Massa",
    "Inezgane-Ait Melloul": "Souss-Massa",
    "Chtouka-Ait Baha": "Souss-Massa",
    "Tiznit": "Souss-Massa",
    "Taroudannt": "Souss-Massa",
    "Tata": "Souss-Massa",
    "Oujda-Angad": "Oriental",
    "Nador": "Oriental",
    "Berkane": "Oriental",
    "Driouch": "Oriental",
    "Figuig": "Oriental",
    "Jerada": "Oriental",
    "Taourirt": "Oriental",
    "Guercif": "Oriental",
    "Beni Mellal": "Beni Mellal-Khenifra",
    "Azilal": "Beni Mellal-Khenifra",
    "Khenifra": "Beni Mellal-Khenifra",
    "Khouribga": "Beni Mellal-Khenifra",
    "Errachidia": "Draa-Tafilalet",
    "Ouarzazate": "Draa-Tafilalet",
    "Midelt": "Draa-Tafilalet",
    "Tinghir": "Draa-Tafilalet",
    "Zagora": "Draa-Tafilalet",
    "Guelmim": "Guelmim-Oued Noun",
    "Assa-Zag": "Guelmim-Oued Noun",
    "Tan-Tan": "Guelmim-Oued Noun",
    "Laayoune": "Laayoune-Sakia El Hamra",
    "Boujdour": "Laayoune-Sakia El Hamra",
    "Es-Semara": "Laayoune-Sakia El Hamra",
    "Tarfaya": "Laayoune-Sakia El Hamra",
    "Dakhla": "Dakhla-Oued Ed-Dahab",
    "Oued Ed Dahab": "Dakhla-Oued Ed-Dahab",
    "Aousserd": "Dakhla-Oued Ed-Dahab",
}

REGIONS = list(set(CITY_REGIONS.values()))


def _location_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    ascii_value = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    ascii_value = re.sub(r"[^A-Za-z0-9]+", " ", ascii_value.upper())
    return re.sub(r"\s+", " ", ascii_value).strip()


LOCATION_ALIASES = {
    "TAROUDANT": "Taroudannt",
    "TAROUDANNT": "Taroudannt",
    "MOHAMMADIA": "Mohammedia",
    "KHEMISSAT": "Khemisset",
}

LOCATION_LOOKUP = {(_location_key(city)): city for city in CITY_REGIONS}
LOCATION_LOOKUP.update({_location_key(alias): city for alias, city in LOCATION_ALIASES.items()})


def normalize_location(raw_location: str) -> dict[str, str]:
    raw_key = _location_key(raw_location)
    cleaned = re.sub(
        r"\b(MAROC|PROVINCE|PREFECTURE|WILAYA|WIALAYA|WIALYA|DE|D|DU|DES|LA|LE)\b",
        " ",
        raw_key,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    matches = []
    for key, city in LOCATION_LOOKUP.items():
        pattern = rf"(^|\s){re.escape(key)}($|\s)"
        raw_match = re.search(pattern, raw_key)
        cleaned_match = re.search(pattern, cleaned)
        match = raw_match or cleaned_match
        if match:
            matches.append((match.start(), -len(key), city))

    if matches:
        _, _, city = sorted(matches)[0]
        return {"city": city, "region": CITY_REGIONS[city]}

    label = (raw_location or "").strip()
    return {"city": label.title() if label else "Non precise", "region": "Autre"}


DEADLINE_DATE_SQL = "substr(deadline,7,4) || '-' || substr(deadline,4,2) || '-' || substr(deadline,1,2)"


@app.get("/api/cities")
async def list_cities():
    db = await get_db()
    cursor = await db.execute(
        """SELECT location, COUNT(*) as total,
           SUM(CASE WHEN status = 'en_cours'
                    AND length(deadline) >= 10
                    AND substr(deadline,7,4) || '-' || substr(deadline,4,2) || '-' || substr(deadline,1,2) >= date('now')
                    THEN 1 ELSE 0 END) as active
           FROM tenders WHERE location != ''
           GROUP BY location ORDER BY total DESC"""
    )
    rows = await cursor.fetchall()
    await db.close()

    city_stats: dict[str, dict] = {}
    for r in rows:
        normalized = normalize_location(r["location"])
        city = normalized["city"]
        if city not in city_stats:
            city_stats[city] = {
                "name": city,
                "total": 0,
                "active": 0,
                "region": normalized["region"],
            }
        city_stats[city]["total"] += r["total"]
        city_stats[city]["active"] += r["active"] or 0

    cities = sorted(city_stats.values(), key=lambda c: c["total"], reverse=True)
    return {"cities": cities}


@app.get("/api/cities/{city_name}")
async def city_detail(city_name: str):
    db = await get_db()
    cursor = await db.execute(
        f"""SELECT location, category, sector_code, sector_name, status, deadline,
                   CASE WHEN status = 'en_cours'
                         AND length(deadline) >= 10
                         AND {DEADLINE_DATE_SQL} >= date('now')
                        THEN 1 ELSE 0 END as is_active
            FROM tenders WHERE location != ''"""
    )
    rows = await cursor.fetchall()
    await db.close()

    target = normalize_location(city_name)
    total = 0
    active = 0
    category_counts: dict[str, int] = {}
    sector_counts: dict[str, dict] = {}

    for row in rows:
        normalized = normalize_location(row["location"])
        if normalized["city"] != target["city"]:
            continue

        total += 1
        active += row["is_active"] or 0

        category = row["category"] or "Non classe"
        category_counts[category] = category_counts.get(category, 0) + 1

        sector_code = row["sector_code"] or "Non precise"
        if sector_code not in sector_counts:
            sector_counts[sector_code] = {
                "sector_code": sector_code,
                "sector_name": row["sector_name"] or sector_code,
                "count": 0,
            }
        sector_counts[sector_code]["count"] += 1

    by_category = [
        {"category": category, "count": count}
        for category, count in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    top_sectors = sorted(sector_counts.values(), key=lambda item: item["count"], reverse=True)[:10]

    return {
        "name": target["city"],
        "region": target["region"],
        "total": total,
        "active": active,
        "by_category": by_category,
        "top_sectors": top_sectors,
    }


# ── Regions ──────────────────────────────────────────────────────────────────

@app.get("/api/regions")
async def list_regions():
    db = await get_db()
    cursor = await db.execute(
        f"""SELECT location, COUNT(*) as total,
            SUM(CASE WHEN status = 'en_cours'
                     AND length(deadline) >= 10
                     AND {DEADLINE_DATE_SQL} >= date('now')
                     THEN 1 ELSE 0 END) as active
            FROM tenders WHERE location != '' GROUP BY location"""
    )
    rows = await cursor.fetchall()
    await db.close()

    region_stats: dict[str, dict] = {}
    for r in rows:
        normalized = normalize_location(r["location"])
        city = normalized["city"]
        region = normalized["region"]
        if region not in region_stats:
            region_stats[region] = {"name": region, "total": 0, "active": 0, "cities": []}
        region_stats[region]["total"] += r["total"]
        region_stats[region]["active"] += r["active"] or 0
        if city not in region_stats[region]["cities"]:
            region_stats[region]["cities"].append(city)

    result = sorted(region_stats.values(), key=lambda x: x["total"], reverse=True)
    return {"regions": result}


@app.get("/api/regions/{region_name}")
async def region_detail(region_name: str):
    db = await get_db()
    cursor = await db.execute(
        f"""SELECT location, category, sector_code, sector_name, status, deadline,
                   CASE WHEN status = 'en_cours'
                         AND length(deadline) >= 10
                         AND {DEADLINE_DATE_SQL} >= date('now')
                        THEN 1 ELSE 0 END as is_active
            FROM tenders WHERE location != ''"""
    )
    rows = await cursor.fetchall()
    await db.close()

    total = 0
    active = 0
    city_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    sector_counts: dict[str, dict] = {}

    for row in rows:
        normalized = normalize_location(row["location"])
        if normalized["region"] != region_name:
            continue

        city = normalized["city"]
        total += 1
        active += row["is_active"] or 0
        city_counts[city] = city_counts.get(city, 0) + 1

        category = row["category"] or "Non classe"
        category_counts[category] = category_counts.get(category, 0) + 1

        sector_code = row["sector_code"] or "Non precise"
        if sector_code not in sector_counts:
            sector_counts[sector_code] = {
                "sector_code": sector_code,
                "sector_name": row["sector_name"] or sector_code,
                "count": 0,
            }
        sector_counts[sector_code]["count"] += 1

    city_stats = [
        {"location": city, "total": count}
        for city, count in sorted(city_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    by_category = [
        {"category": category, "count": count}
        for category, count in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    top_sectors = sorted(sector_counts.values(), key=lambda item: item["count"], reverse=True)[:10]

    return {
        "name": region_name,
        "total": total,
        "active": active,
        "cities": city_stats,
        "by_category": by_category,
        "top_sectors": top_sectors,
    }


# ── Sectors ──────────────────────────────────────────────────────────────────

@app.get("/api/sectors")
async def list_sectors():
    db = await get_db()
    cursor = await db.execute(
        """SELECT sector_code, sector_name, category, COUNT(*) as count
           FROM tenders GROUP BY sector_code ORDER BY category, count DESC"""
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    await db.close()

    categories = {}
    for r in rows:
        cat = r["category"] or "Autre"
        if cat not in categories:
            categories[cat] = {"name": cat, "total": 0, "sectors": []}
        categories[cat]["total"] += r["count"]
        categories[cat]["sectors"].append(r)

    return {"categories": list(categories.values()), "all_sectors": rows}


@app.get("/api/sectors/{sector_code}")
async def sector_detail(sector_code: str):
    db = await get_db()

    name = SECTORS.get(sector_code, sector_code)

    total_cursor = await db.execute(
        "SELECT COUNT(*) FROM tenders WHERE sector_code = ?", (sector_code,)
    )
    total = (await total_cursor.fetchone())[0]

    active_cursor = await db.execute(
        "SELECT COUNT(*) FROM tenders WHERE sector_code = ? AND deadline >= date('now')",
        (sector_code,),
    )
    active = (await active_cursor.fetchone())[0]

    entity_cursor = await db.execute(
        """SELECT entity, COUNT(*) as count FROM tenders
           WHERE sector_code = ? GROUP BY entity ORDER BY count DESC LIMIT 10""",
        (sector_code,),
    )
    top_entities = [dict(r) for r in await entity_cursor.fetchall()]

    location_cursor = await db.execute(
        """SELECT location, COUNT(*) as count FROM tenders
           WHERE sector_code = ? AND location != '' GROUP BY location ORDER BY count DESC LIMIT 10""",
        (sector_code,),
    )
    top_locations = [dict(r) for r in await location_cursor.fetchall()]

    await db.close()

    return {
        "code": sector_code,
        "name": name,
        "total": total,
        "active": active,
        "top_entities": top_entities,
        "top_locations": top_locations,
    }


# ── Favorites ────────────────────────────────────────────────────────────────

@app.get("/api/favorites")
async def list_favorites(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        """SELECT t.* FROM tenders t
           JOIN favorites f ON f.tender_id = t.id
           WHERE f.user_id = ? ORDER BY f.created_at DESC""",
        (user["id"],),
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    await db.close()
    return {"data": rows}


@app.get("/api/favorites/ids")
async def list_favorite_ids(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        "SELECT tender_id FROM favorites WHERE user_id = ?", (user["id"],)
    )
    ids = [r[0] for r in await cursor.fetchall()]
    await db.close()
    return {"ids": ids}


@app.post("/api/favorites/{tender_id}")
async def add_favorite(tender_id: str, authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO favorites (user_id, tender_id) VALUES (?, ?)",
            (user["id"], tender_id),
        )
        await db.commit()
    finally:
        await db.close()
    return {"status": "added"}


@app.delete("/api/favorites/{tender_id}")
async def remove_favorite(tender_id: str, authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    await db.execute(
        "DELETE FROM favorites WHERE user_id = ? AND tender_id = ?",
        (user["id"], tender_id),
    )
    await db.commit()
    await db.close()
    return {"status": "removed"}


# ── Alert Preferences ───────────────────────────────────────────────────────

class AlertRequest(BaseModel):
    name: str = "Mon alerte"
    sectors: str = ""
    regions: str = ""
    keywords: str = ""
    min_budget: str = ""
    max_budget: str = ""
    frequency: str = "daily"
    enabled: bool = True


# Free beta: one alert per account. Enforced here (not just in the UI) so the
# rule holds even if someone calls the API directly.
BETA_ALERT_LIMIT = 1
BETA_ALERT_LIMIT_MESSAGE = (
    "La version beta gratuite est limitee a une alerte par compte."
)


async def send_confirmation_email(recipient: str, alert: dict) -> dict:
    """Best-effort confirmation email for an enabled alert. Never raises; the
    save always stands. Returns a status the UI uses to phrase its toast.

    reason codes: "disabled_alert" (not enabled, nothing to confirm),
    "smtp_disabled" (no SMTP configured), "send_failed" (delivery error).
    """
    config = await resolve_email_config()
    if not email_is_configured(config):
        return {"attempted": False, "delivered": False, "reason": "smtp_disabled"}
    subject, html, text = render_confirmation(alert)
    try:
        await asyncio.to_thread(send_email, config, recipient, subject, html, text)
    except Exception as e:
        print(f"[alerts] confirmation send failed for {recipient}: {e}")
        return {"attempted": True, "delivered": False, "reason": "send_failed"}
    return {"attempted": True, "delivered": True, "reason": None}


@app.get("/api/alerts")
async def list_alerts(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        """SELECT a.*,
                  (SELECT MAX(d.sent_at) FROM digest_log d WHERE d.alert_id = a.id) AS last_sent
           FROM alert_preferences a
           WHERE a.user_id = ? ORDER BY a.created_at DESC""",
        (user["id"],),
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    await db.close()
    return {"data": rows}


@app.post("/api/alerts")
async def create_alert(req: AlertRequest, authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        "SELECT COUNT(*) AS n FROM alert_preferences WHERE user_id = ?", (user["id"],)
    )
    existing = (await cursor.fetchone())["n"]
    if existing >= BETA_ALERT_LIMIT:
        await db.close()
        raise HTTPException(status_code=409, detail=BETA_ALERT_LIMIT_MESSAGE)

    cursor = await db.execute(
        """INSERT INTO alert_preferences (user_id, name, sectors, regions, keywords, min_budget, max_budget, frequency, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user["id"], req.name, req.sectors, req.regions, req.keywords,
         req.min_budget, req.max_budget, req.frequency, 1 if req.enabled else 0),
    )
    await db.commit()
    alert_id = cursor.lastrowid
    await db.close()

    # Confirmation email only when the saved alert is actually active.
    if req.enabled:
        email_status = await send_confirmation_email(user["email"], req.model_dump())
    else:
        email_status = {"attempted": False, "delivered": False, "reason": "disabled_alert"}
    return {"id": alert_id, "status": "created", "email": email_status}


@app.put("/api/alerts/{alert_id}")
async def update_alert(alert_id: int, req: AlertRequest, authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM alert_preferences WHERE id = ? AND user_id = ?",
        (alert_id, user["id"]),
    )
    if not await cursor.fetchone():
        await db.close()
        raise HTTPException(status_code=404, detail="Alerte introuvable.")

    await db.execute(
        """UPDATE alert_preferences SET name=?, sectors=?, regions=?, keywords=?,
           min_budget=?, max_budget=?, frequency=?, enabled=? WHERE id=? AND user_id=?""",
        (req.name, req.sectors, req.regions, req.keywords,
         req.min_budget, req.max_budget, req.frequency, 1 if req.enabled else 0,
         alert_id, user["id"]),
    )
    await db.commit()
    await db.close()

    # Confirmation fires whenever the alert ends up enabled — covers an edit
    # while enabled and a disabled→enabled reactivation. Disabling stays silent.
    if req.enabled:
        email_status = await send_confirmation_email(user["email"], req.model_dump())
    else:
        email_status = {"attempted": False, "delivered": False, "reason": "disabled_alert"}
    return {"status": "updated", "email": email_status}


@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: int, authorization: str | None = Header(None)):
    user = await require_user(authorization)
    db = await get_db()
    await db.execute(
        "DELETE FROM alert_preferences WHERE id = ? AND user_id = ?",
        (alert_id, user["id"]),
    )
    await db.commit()
    await db.close()
    return {"status": "deleted"}


@app.post("/api/alerts/preview")
async def preview_alert(req: AlertRequest, authorization: str | None = Header(None)):
    await require_user(authorization)
    db = await get_db()
    # Same open-matches path the digest uses, so preview counts and digest
    # contents can never disagree. Sample surfaces the soonest deadlines first.
    matches = await open_matches_for_alert(db, req.model_dump())
    await db.close()

    sample = [
        {key: tender.get(key) for key in ("id", "title", "entity", "location", "deadline")}
        for tender in matches[:5]
    ]
    return {"count": len(matches), "sample": sample}


@app.post("/api/alerts/test-email")
async def test_alert_email(authorization: str | None = Header(None)):
    user = await require_user(authorization)
    config = await resolve_email_config()
    if not email_is_configured(config):
        raise HTTPException(status_code=503, detail="SMTP non configure")
    subject = "Test - Alertes Marches Publics Maroc"
    text = "Ceci est un email de test de vos alertes. La configuration SMTP fonctionne."
    html = "<p>Ceci est un email de test de vos alertes. La configuration SMTP fonctionne.</p>"
    try:
        await asyncio.to_thread(send_email, config, user["email"], subject, html, text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Echec d'envoi: {e}")
    return {"status": "sent"}


# ── PDF Export ───────────────────────────────────────────────────────────────

@app.get("/api/tenders/{tender_id:path}/pdf")
async def export_tender_pdf(tender_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,))
    row = await cursor.fetchone()
    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="Not found")

    tender = dict(row)

    det_cursor = await db.execute(
        "SELECT * FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    detail = await det_cursor.fetchone()
    await db.close()

    detail = dict(detail) if detail else {}

    # Generate simple text-based PDF
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    from reportlab.lib.units import cm

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("CustomTitle", parent=styles["Heading1"], fontSize=16, spaceAfter=12)
    heading_style = ParagraphStyle("CustomHeading", parent=styles["Heading2"], fontSize=12,
                                    textColor=colors.HexColor("#2563eb"), spaceAfter=6, spaceBefore=12)
    normal_style = styles["Normal"]

    elements = []
    elements.append(Paragraph("Marchés Publics Maroc", title_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"<b>{tender.get('title', tender.get('reference', ''))}</b>", styles["Heading2"]))
    elements.append(Spacer(1, 12))

    # Basic info table
    info = [
        ["Référence", tender.get("reference", "")],
        ["Entité", tender.get("entity", "")],
        ["Catégorie", tender.get("category", "")],
        ["Secteur", tender.get("sector_name", "")],
        ["Localisation", tender.get("location", "")],
        ["Date limite", tender.get("deadline", "")],
        ["Date publication", tender.get("publication_date", "")],
        ["Procédure", tender.get("procedure_type", "")],
    ]
    t = Table(info, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f4ff")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    if detail:
        detail_fields = [
            ("Objet", "objet"), ("Acheteur", "acheteur"), ("Estimation", "estimation"),
            ("Lieu d'exécution", "lieu_execution"), ("Allotissement", "allotissement"),
            ("Caution provisoire", "caution_provisoire"), ("Qualifications", "qualifications"),
            ("Agréments", "agrements"), ("Contact", "contact"),
        ]
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Détails", heading_style))
        for label, key in detail_fields:
            val = detail.get(key, "")
            if val:
                elements.append(Paragraph(f"<b>{label}:</b> {val}", normal_style))
                elements.append(Spacer(1, 4))

    doc.build(elements)
    pdf_bytes = buf.getvalue()

    ref = tender.get("reference", tender_id).replace("/", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="tender_{ref}.pdf"'},
    )


# ── DCE Download ─────────────────────────────────────────────────────────────

@app.get("/api/tenders/{tender_id:path}/dce")
async def download_tender_dce(tender_id: str):
    db = await get_db()
    det_cursor = await db.execute(
        "SELECT dce_url FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    detail = await det_cursor.fetchone()

    dce_url = detail["dce_url"] if detail else ""
    if not dce_url:
        await db.close()
        return Response(content='{"error": "No DCE URL for this tender"}', status_code=404,
                        media_type="application/json")

    # Serve the cached ZIP instantly if present; otherwise fetch it once
    # (auto-filling the portal form), cache it, and serve — no form for the user.
    result = await ensure_dce_cached(db, tender_id, dce_url)
    await db.close()
    if not result:
        return Response(content='{"error": "Failed to download DCE"}', status_code=502,
                        media_type="application/json")

    path, filename = result
    return FileResponse(path, media_type="application/zip", filename=filename)


# Register the catch-all detail route after the download routes so their suffixes win.
app.add_api_route("/api/tenders/{tender_id:path}", get_tender, methods=["GET"])


# ── Scrape ───────────────────────────────────────────────────────────────────

@app.post("/api/scrape")
async def trigger_scrape():
    result = await run_scrape_and_digest()
    return {"status": "done", **result}


@app.get("/api/scrape/status")
async def scrape_status():
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM scrape_log ORDER BY id DESC LIMIT 5"
    )
    logs = [dict(r) for r in await cursor.fetchall()]
    await db.close()
    return {"logs": logs}


# ── Blog (static content) ───────────────────────────────────────────────────

BLOG_POSTS = [
    {
        "slug": "guide-marches-publics-maroc",
        "title": "Guide complet des marchés publics au Maroc",
        "summary": "Tout ce que vous devez savoir sur les marchés publics au Maroc : procédures, réglementation, et conseils pour réussir vos soumissions.",
        "category": "Guide",
        "date": "2025-01-15",
        "content": """
## Introduction aux marchés publics au Maroc

Les marchés publics au Maroc représentent un levier économique majeur, avec plus de 95 000 appels d'offres publiés chaque année sur le portail officiel marchespublics.gov.ma.

## Cadre réglementaire

Le décret n° 2-22-431 du 8 mars 2023 relatif aux marchés publics constitue le texte de référence. Il définit :

- **Les modes de passation** : appel d'offres ouvert, restreint, concours, procédure négociée
- **Les seuils** : déterminent le mode de passation applicable
- **Les délais** : publication, retrait des dossiers, dépôt des offres
- **Les garanties** : caution provisoire et définitive

## Types de marchés

### 1. Travaux
Concernent la réalisation d'ouvrages de bâtiment ou de génie civil : construction, rénovation, aménagement, VRD.

### 2. Fournitures
Portent sur l'achat ou la location de produits et matériels : équipement informatique, mobilier, fournitures de bureau.

### 3. Services
Couvrent les prestations intellectuelles et techniques : études, conseil, maintenance, gardiennage.

## Comment soumissionner

1. **S'inscrire** sur le portail marchespublics.gov.ma
2. **Rechercher** les appels d'offres correspondant à votre activité
3. **Retirer** le dossier de consultation (DCE)
4. **Préparer** votre offre technique et financière
5. **Déposer** votre offre dans les délais

## Conseils pour réussir

- Surveillez régulièrement les nouvelles publications
- Constituez vos dossiers administratifs à l'avance
- Analysez attentivement le cahier des charges
- Proposez des prix compétitifs mais réalistes
- Respectez scrupuleusement les délais
""",
    },
    {
        "slug": "decret-2-22-431-explique",
        "title": "Décret 2-22-431 : ce qui change pour les entreprises",
        "summary": "Analyse détaillée du décret 2-22-431 relatif aux marchés publics et ses implications pour les PME marocaines.",
        "category": "Analyse",
        "date": "2025-02-10",
        "content": """
## Le décret 2-22-431 en bref

Publié le 8 mars 2023, ce décret modernise le cadre des marchés publics au Maroc avec plusieurs innovations majeures.

## Principales nouveautés

### Dématérialisation renforcée
- Soumission électronique obligatoire pour les marchés > 1 million MAD
- Signature électronique des documents
- Archivage numérique des dossiers

### Préférence nationale
- Majoration de 15% sur les offres étrangères pour les marchés de travaux
- Majoration de 15% pour les fournitures d'origine marocaine

### PME et coopératives
- 20% des marchés réservés aux PME
- Allotissement obligatoire pour favoriser l'accès des petites entreprises
- Simplification des dossiers administratifs

### Délais
- Publication minimale de 21 jours pour les appels d'offres ouverts
- 40 jours pour les marchés > 60 millions MAD
- Réduction possible en cas d'urgence (15 jours)

### Transparence
- Publication systématique des résultats
- Motivation obligatoire des rejets
- Recours facilités pour les soumissionnaires
""",
    },
    {
        "slug": "comment-soumissionner-marche-public",
        "title": "Comment soumissionner à un marché public : guide étape par étape",
        "summary": "Guide pratique pour préparer et déposer votre offre sur un marché public au Maroc.",
        "category": "Guide",
        "date": "2025-03-05",
        "content": """
## Étape 1 : Identifier les opportunités

Utilisez MP Maroc pour rechercher les appels d'offres correspondant à votre secteur d'activité. Filtrez par :
- Secteur d'activité
- Localisation géographique
- Budget estimé
- Date limite de soumission

## Étape 2 : Retirer le DCE

Le Dossier de Consultation des Entreprises comprend :
- Le règlement de consultation (RC)
- Le cahier des prescriptions spéciales (CPS)
- Le bordereau des prix
- Les plans et documents techniques

## Étape 3 : Préparer le dossier administratif

Documents requis :
- Certificat d'inscription au registre du commerce
- Attestation fiscale (< 6 mois)
- Attestation CNSS (< 6 mois)
- Caution provisoire
- Déclaration sur l'honneur
- Certificat de qualification et classification (si travaux)

## Étape 4 : Élaborer l'offre technique

- Respectez le cahier des charges point par point
- Détaillez votre méthodologie
- Présentez vos références similaires
- Joignez les CV de l'équipe projet

## Étape 5 : Préparer l'offre financière

- Remplissez le bordereau des prix avec soin
- Vérifiez les calculs et les reports
- Assurez-vous de la cohérence avec l'offre technique

## Étape 6 : Déposer l'offre

- Respectez impérativement la date et l'heure limites
- Déposez les plis séparés (administratif, technique, financier)
- Conservez l'accusé de réception
""",
    },
    {
        "slug": "secteurs-actifs-marches-publics-2025",
        "title": "Les secteurs les plus actifs des marchés publics en 2025",
        "summary": "Analyse des secteurs qui concentrent le plus d'appels d'offres au Maroc en 2025.",
        "category": "Analyse",
        "date": "2025-04-20",
        "content": """
## Vue d'ensemble

Le marché public marocain continue de croître, porté par les grands projets d'infrastructure et la préparation de la Coupe du Monde 2030.

## Top 5 des secteurs

### 1. Construction et BTP
Le secteur le plus actif avec plus de 30% des appels d'offres. Les projets liés au Mondial 2030 (stades, routes, hôtels) stimulent fortement la demande.

### 2. Informatique et télécommunications
La transformation digitale de l'administration marocaine génère une demande croissante en solutions IT, cybersécurité et services cloud.

### 3. Gardiennage et sécurité
Un secteur stable avec des renouvellements réguliers de contrats par les administrations et établissements publics.

### 4. Fournitures médicales
La modernisation du système de santé et l'extension de la couverture sociale maintiennent une forte demande.

### 5. Études et ingénierie
Les grands projets nécessitent des études préalables, du suivi de chantier et de l'assistance technique.

## Tendances 2025

- **Développement durable** : intégration croissante de critères environnementaux
- **Innovation** : smart cities, IoT, intelligence artificielle
- **Régionalisation** : décentralisation des marchés vers les collectivités territoriales
""",
    },
    {
        "slug": "penalites-retard-marches-publics",
        "title": "Pénalités de retard dans les marchés publics : calcul et bonnes pratiques",
        "summary": "Comment sont calculées les pénalités de retard et comment les éviter dans l'exécution des marchés publics.",
        "category": "Décryptage",
        "date": "2025-05-12",
        "content": """
## Cadre juridique

Les pénalités de retard sont prévues par le CCAG (Cahier des Clauses Administratives Générales) applicable au type de marché.

## Calcul des pénalités

### Marchés de travaux
- **Taux journalier** : 1/1000 du montant du marché par jour de retard
- **Plafond** : 10% du montant total du marché
- **Franchise** : pas de pénalité pour les premiers jours (selon CPS)

### Marchés de fournitures
- **Taux journalier** : 1/1000 à 1/500 du montant du marché
- **Plafond** : 10% du montant

### Marchés de services
- Conditions fixées par le CPS spécifique au marché

## Comment éviter les pénalités

1. **Planification rigoureuse** : établissez un calendrier réaliste
2. **Suivi régulier** : identifiez les retards potentiels dès le début
3. **Communication** : informez le maître d'ouvrage de tout aléa
4. **Documentation** : conservez les preuves en cas de force majeure
5. **Ordres d'arrêt** : demandez-les formellement si nécessaire

## Contestation des pénalités

Le titulaire peut contester les pénalités en justifiant :
- Un cas de force majeure
- Un retard imputable au maître d'ouvrage
- Des ordres de service tardifs
""",
    },
]


@app.get("/api/blog")
async def list_blog_posts():
    return {"posts": [{k: v for k, v in p.items() if k != "content"} for p in BLOG_POSTS]}


@app.get("/api/blog/{slug}")
async def get_blog_post(slug: str):
    for p in BLOG_POSTS:
        if p["slug"] == slug:
            return p
    raise HTTPException(status_code=404, detail="Post not found")


# ── Assistant juridique (décret 2.22.431) ────────────────────────────────────

class AssistantRequest(BaseModel):
    question: str
    procedure: str = ""


@app.post("/api/assistant/ask")
async def assistant_ask(req: AssistantRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question vide")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question trop longue (1000 caractères max)")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Assistant non configuré : définissez ANTHROPIC_API_KEY côté serveur.",
        )

    user_content = question
    if req.procedure:
        user_content = f"[Procédure en cours de préparation : {req.procedure}]\n\n{question}"

    client = anthropic.AsyncAnthropic()
    try:
        response = await client.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            thinking={"type": "adaptive"},
            # Prompt système statique en tête de prompt pour le prompt caching
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_content}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=503, detail="Clé ANTHROPIC_API_KEY invalide.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Assistant saturé, réessayez dans un instant.")
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Erreur de l'assistant ({e.status_code}).")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Assistant injoignable, vérifiez la connexion réseau.")

    if response.stop_reason == "refusal":
        raise HTTPException(status_code=422, detail="L'assistant ne peut pas répondre à cette question.")

    answer = "".join(block.text for block in response.content if block.type == "text").strip()
    if not answer:
        raise HTTPException(status_code=502, detail="Réponse vide de l'assistant.")
    return {"answer": answer}


# ── Serve frontend (Docker production) ───────────────────────────────────────

@app.get("/")
async def redirect_root_to_catalog():
    return RedirectResponse(url="/tenders", status_code=307)


STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.is_dir():
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = STATIC_DIR / full_path
        if file.is_file() and STATIC_DIR in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
