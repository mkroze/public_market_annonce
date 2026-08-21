"""Admin control plane: RBAC, audit logging, and admin API endpoints.

Kept isolated in its own APIRouter (prefix ``/api/admin``) and included from
``main.py``. Cross-module helpers that live in ``main`` (``get_current_user``,
``run_scrape_and_digest``, ``scrape_lock``) are imported lazily inside the
functions that need them to avoid a circular import at module load time.
"""

import asyncio
import csv
import json
import os
from io import StringIO

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel

from database import get_db
from emailer import email_is_configured, send_email
from settings import resolve_email_config, set_email_settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Roles & permissions ──────────────────────────────────────────────────────

ADMIN_ROLES = {"owner", "admin", "operator", "auditor", "support"}
ASSIGNABLE_ROLES = ADMIN_ROLES | {"user"}

ALL_PERMISSIONS = [
    "overview.view",
    "tenders.view", "tenders.moderate", "tenders.export",
    "imports.view", "imports.run", "imports.retry",
    "audit.view", "audit.export",
    "users.view", "users.suspend", "users.manage_role",
    "roles.view",
    "settings.view", "settings.manage",
]

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": set(ALL_PERMISSIONS),
    "admin": {
        "overview.view",
        "tenders.view", "tenders.moderate", "tenders.export",
        "imports.view", "imports.run", "imports.retry",
        "audit.view", "audit.export",
        "users.view", "roles.view",
    },
    "operator": {
        "overview.view",
        "tenders.view", "tenders.moderate",
        "imports.view", "imports.run", "imports.retry",
        "audit.view",
    },
    "auditor": {
        "overview.view",
        "tenders.view",
        "imports.view",
        "audit.view", "audit.export",
        "users.view", "roles.view",
    },
    "support": {
        "overview.view",
        "tenders.view", "tenders.moderate",
        "imports.view",
        "audit.view",
    },
}

ROLE_DESCRIPTIONS = {
    "owner": "Full control: roles, users, imports, tenders, audit, and high-risk operations.",
    "admin": "Manage tenders, imports, and exports. Cannot change roles.",
    "operator": "Run imports, review and moderate records, inspect non-sensitive logs.",
    "auditor": "Read-only access to admin data and audit logs, with audit export.",
    "support": "Limited tender review and operational diagnostics.",
}


def has_permission(role: str | None, perm: str) -> bool:
    return perm in ROLE_PERMISSIONS.get(role or "", set())


# ── Audit logging ────────────────────────────────────────────────────────────

async def log_audit(
    db,
    *,
    actor: dict | None,
    action: str,
    target_type: str | None = None,
    target_id=None,
    result: str = "success",
    request: Request | None = None,
    before=None,
    after=None,
):
    """Insert one audit row. Caller owns the db connection lifecycle."""
    ip = request.client.host if request and request.client else None
    route = request.url.path if request else None
    await db.execute(
        """INSERT INTO admin_audit_logs
           (actor_id, actor_email, actor_role, action, target_type, target_id,
            result, ip, route, before_json, after_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            (actor or {}).get("id"),
            (actor or {}).get("email"),
            (actor or {}).get("role"),
            action,
            target_type,
            str(target_id) if target_id is not None else None,
            result,
            ip,
            route,
            json.dumps(before, ensure_ascii=False) if before is not None else None,
            json.dumps(after, ensure_ascii=False) if after is not None else None,
        ),
    )
    await db.commit()


async def _audit_denied(actor: dict | None, request: Request, required: tuple[str, ...]):
    db = await get_db()
    try:
        await log_audit(
            db,
            actor=actor,
            action="admin.access_denied",
            target_type="permission",
            target_id=",".join(required) if required else None,
            result="denied",
            request=request,
        )
    finally:
        await db.close()


# ── Access control dependency ────────────────────────────────────────────────

def require_admin(*required: str):
    """Build a FastAPI dependency enforcing admin role + all listed permissions.

    401 if unauthenticated, 403 (audited as ``denied``) if the user is not an
    admin or is missing any required permission.
    """

    async def dependency(request: Request, authorization: str | None = Header(None)):
        from main import get_current_user  # lazy to avoid circular import

        user = await get_current_user(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        role = user.get("role") or "user"
        if user.get("status") == "suspended":
            await _audit_denied(user, request, required)
            raise HTTPException(status_code=403, detail="Account suspended")
        if role not in ADMIN_ROLES:
            await _audit_denied(user, request, required)
            raise HTTPException(status_code=403, detail="Admin access required")
        for perm in required:
            if not has_permission(role, perm):
                await _audit_denied(user, request, required)
                raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")
        return user

    return dependency


# ── Bootstrap ────────────────────────────────────────────────────────────────

async def bootstrap_admins():
    """Promote users listed in the ADMIN_EMAILS env var to ``owner`` on startup."""
    emails = [e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()]
    if not emails:
        return
    db = await get_db()
    try:
        for email in emails:
            await db.execute(
                """UPDATE users SET role = 'owner'
                   WHERE lower(email) = ?
                     AND (role IS NULL OR role NOT IN ('owner','admin','operator','auditor','support'))""",
                (email,),
            )
        await db.commit()
    finally:
        await db.close()


# ── Overview dashboard ───────────────────────────────────────────────────────

@router.get("/overview")
async def admin_overview(request: Request, user=Depends(require_admin("overview.view"))):
    db = await get_db()
    try:
        async def scalar(sql, params=()):
            return (await (await db.execute(sql, params)).fetchone())[0]

        last_row = await (await db.execute("SELECT * FROM scrape_log ORDER BY id DESC LIMIT 1")).fetchone()
        last_import = dict(last_row) if last_row else None

        tender_count = await scalar("SELECT COUNT(*) FROM tenders")
        detail_count = await scalar("SELECT COUNT(*) FROM tender_details")
        last_scraped = await scalar("SELECT MAX(scraped_at) FROM tenders")
        last_success = await scalar("SELECT MAX(finished_at) FROM scrape_log WHERE status = 'done'")

        failed_imports = await scalar("SELECT COUNT(*) FROM scrape_log WHERE status = 'failed'")
        missing_details = await scalar(
            "SELECT COUNT(*) FROM tenders t LEFT JOIN tender_details td ON td.tender_id = t.id WHERE td.tender_id IS NULL"
        )
        flagged = await scalar("SELECT COUNT(*) FROM tenders WHERE review_status = 'flagged'")
        archived = await scalar("SELECT COUNT(*) FROM tenders WHERE admin_status = 'archived'")
        stale = await scalar(
            "SELECT COUNT(*) FROM tenders WHERE deadline != '' AND deadline < date('now') AND status != 'cloture'"
        )

        gov_rows = await (await db.execute(
            """SELECT action, actor_email, target_type, target_id, result, created_at
               FROM admin_audit_logs
               WHERE action IN ('user.role_change','user.suspend','user.reactivate')
                  OR action LIKE '%.export'
               ORDER BY id DESC LIMIT 8"""
        )).fetchall()

        coverage = round(detail_count / tender_count * 100, 1) if tender_count else 0.0

        return {
            "generated_at": last_scraped,  # kept for compatibility; see freshness block
            "last_import": last_import,
            "freshness": {
                "tender_count": tender_count,
                "detail_count": detail_count,
                "detail_coverage_pct": coverage,
                "last_scraped_at": last_scraped,
                "last_successful_import_at": last_success,
                "source": "marchespublics.gov.ma",
            },
            "failure_queues": {
                "failed_imports": failed_imports,
                "missing_details": missing_details,
                "flagged_tenders": flagged,
                "archived_tenders": archived,
                "stale_records": stale,
            },
            "governance": [dict(r) for r in gov_rows],
            "health": {
                "database": "ok",
                "scraper_source": "unknown",  # no live ping; last attempt implied by last_import
                "scraper_last_attempt_at": last_import["started_at"] if last_import else None,
            },
        }
    finally:
        await db.close()


# ── Tender administration ────────────────────────────────────────────────────

@router.get("/tenders")
async def admin_tenders(
    request: Request,
    q: str = Query(""),
    category: str = Query(""),
    sector: str = Query(""),
    entity: str = Query(""),
    location: str = Query(""),
    status: str = Query(""),
    review_status: str = Query(""),
    admin_status: str = Query(""),
    detail: str = Query("", description="'yes' or 'no' for detail availability"),
    sort: str = Query("scraped_at"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    user=Depends(require_admin("tenders.view")),
):
    db = await get_db()
    try:
        conditions, params = [], []
        if q:
            conditions.append("(t.title LIKE ? OR t.reference LIKE ? OR t.entity LIKE ? OR t.id LIKE ?)")
            params.extend([f"%{q}%"] * 4)
        if category:
            conditions.append("t.category = ?"); params.append(category)
        if sector:
            conditions.append("t.sector_code = ?"); params.append(sector)
        if entity:
            conditions.append("t.entity LIKE ?"); params.append(f"%{entity}%")
        if location:
            conditions.append("t.location LIKE ?"); params.append(f"%{location}%")
        if status:
            conditions.append("t.status = ?"); params.append(status)
        if review_status:
            conditions.append("t.review_status = ?"); params.append(review_status)
        if admin_status:
            conditions.append("t.admin_status = ?"); params.append(admin_status)
        if detail == "yes":
            conditions.append("td.tender_id IS NOT NULL")
        elif detail == "no":
            conditions.append("td.tender_id IS NULL")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        allowed_sort = {
            "deadline": "t.deadline", "publication_date": "t.publication_date",
            "title": "t.title", "entity": "t.entity", "scraped_at": "t.scraped_at",
            "review_status": "t.review_status", "admin_status": "t.admin_status",
        }
        sort_col = allowed_sort.get(sort, "t.scraped_at")
        sort_dir = "DESC" if order.lower() == "desc" else "ASC"

        base_from = "FROM tenders t LEFT JOIN tender_details td ON td.tender_id = t.id"
        total = (await (await db.execute(f"SELECT COUNT(*) {base_from} {where}", params)).fetchone())[0]

        offset = (page - 1) * per_page
        rows = await (await db.execute(
            f"""SELECT t.*, td.estimation,
                       CASE WHEN td.tender_id IS NOT NULL THEN 1 ELSE 0 END AS detail_available
                {base_from} {where}
                ORDER BY {sort_col} {sort_dir}
                LIMIT ? OFFSET ?""",
            params + [per_page, offset],
        )).fetchall()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
            "data": [dict(r) for r in rows],
        }
    finally:
        await db.close()


class BatchRequest(BaseModel):
    action: str  # mark_reviewed | flag | archive | restore | retry_detail
    ids: list[str]
    note: str | None = None


@router.post("/tenders/batch")
async def admin_tenders_batch(
    req: BatchRequest,
    request: Request,
    user=Depends(require_admin("tenders.moderate")),
):
    valid_actions = {"mark_reviewed", "flag", "archive", "restore", "retry_detail"}
    if req.action not in valid_actions:
        raise HTTPException(status_code=422, detail=f"Unknown action: {req.action}")
    if not req.ids:
        raise HTTPException(status_code=422, detail="No tender ids provided")

    from scraper import ensure_tender_details  # lazy: heavy import graph

    db = await get_db()
    updated: list[str] = []
    failed: list[dict] = []
    try:
        for tid in req.ids:
            row = await (await db.execute(
                "SELECT id, detail_url FROM tenders WHERE id = ?", (tid,)
            )).fetchone()
            if not row:
                failed.append({"id": tid, "reason": "not_found"})
                continue
            try:
                if req.action == "mark_reviewed":
                    await db.execute("UPDATE tenders SET review_status = 'reviewed' WHERE id = ?", (tid,))
                elif req.action == "flag":
                    await db.execute(
                        "UPDATE tenders SET review_status = 'flagged', flag_note = ? WHERE id = ?",
                        (req.note or "", tid),
                    )
                elif req.action == "archive":
                    await db.execute("UPDATE tenders SET admin_status = 'archived' WHERE id = ?", (tid,))
                elif req.action == "restore":
                    await db.execute("UPDATE tenders SET admin_status = 'active' WHERE id = ?", (tid,))
                elif req.action == "retry_detail":
                    await db.execute("DELETE FROM tender_details WHERE tender_id = ?", (tid,))
                    await db.commit()
                    detail = await ensure_tender_details(db, tid, row["detail_url"] or "")
                    if not detail:
                        failed.append({"id": tid, "reason": "detail_unavailable"})
                        continue
                updated.append(tid)
            except Exception as e:  # noqa: BLE001 - report per-row failure
                failed.append({"id": tid, "reason": str(e)[:200]})
        await db.commit()

        if failed and updated:
            result = "partial"
        elif failed:
            result = "failure"
        else:
            result = "success"

        await log_audit(
            db, actor=user, action=f"tender.batch.{req.action}",
            target_type="tender", target_id=f"{len(updated)}/{len(req.ids)}",
            result=result, request=request,
            after={"updated": len(updated), "failed": len(failed)},
        )
        return {"action": req.action, "updated": updated, "failed": failed, "result": result}
    finally:
        await db.close()


# ── Import control center ────────────────────────────────────────────────────

def _launch_import(actor_email: str):
    from main import run_scrape_and_digest

    async def runner():
        try:
            await run_scrape_and_digest(actor_email=actor_email, trigger="manual")
        except Exception as e:  # noqa: BLE001
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE scrape_log SET status = 'failed', finished_at = datetime('now'), error = ? WHERE status = 'running'",
                    (str(e)[:500],),
                )
                await db.commit()
            finally:
                await db.close()

    asyncio.create_task(runner())


@router.get("/imports")
async def admin_imports(limit: int = Query(50, ge=1, le=200), user=Depends(require_admin("imports.view"))):
    from main import scrape_lock
    db = await get_db()
    try:
        rows = await (await db.execute("SELECT * FROM scrape_log ORDER BY id DESC LIMIT ?", (limit,))).fetchall()
        return {"data": [dict(r) for r in rows], "active": scrape_lock.locked()}
    finally:
        await db.close()


@router.get("/imports/{import_id}")
async def admin_import_detail(import_id: int, user=Depends(require_admin("imports.view"))):
    db = await get_db()
    try:
        row = await (await db.execute("SELECT * FROM scrape_log WHERE id = ?", (import_id,))).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Import run not found")
        return dict(row)
    finally:
        await db.close()


@router.post("/imports")
async def admin_run_import(request: Request, user=Depends(require_admin("imports.run"))):
    from main import scrape_lock
    if scrape_lock.locked():
        raise HTTPException(status_code=409, detail="An import is already running")
    _launch_import(user["email"])
    db = await get_db()
    try:
        await log_audit(db, actor=user, action="import.run", target_type="import", request=request)
    finally:
        await db.close()
    return {"status": "started"}


@router.post("/imports/{import_id}/retry")
async def admin_retry_import(import_id: int, request: Request, user=Depends(require_admin("imports.retry"))):
    from main import scrape_lock
    db = await get_db()
    try:
        row = await (await db.execute("SELECT id FROM scrape_log WHERE id = ?", (import_id,))).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Import run not found")
        if scrape_lock.locked():
            raise HTTPException(status_code=409, detail="An import is already running")
        _launch_import(user["email"])
        await log_audit(db, actor=user, action="import.retry", target_type="import", target_id=import_id, request=request)
    finally:
        await db.close()
    return {"status": "started"}


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def admin_users(
    role: str = Query(""),
    status: str = Query(""),
    q: str = Query(""),
    user=Depends(require_admin("users.view")),
):
    db = await get_db()
    try:
        conditions, params = [], []
        if role:
            conditions.append("role = ?"); params.append(role)
        if status:
            conditions.append("status = ?"); params.append(status)
        if q:
            conditions.append("(email LIKE ? OR name LIKE ? OR company LIKE ?)")
            params.extend([f"%{q}%"] * 3)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await (await db.execute(
            f"""SELECT id, email, name, company, plan, role, status, last_login,
                       mfa_enabled, invited_by, created_at
                FROM users {where} ORDER BY created_at DESC""",
            params,
        )).fetchall()
        return {"data": [dict(r) for r in rows]}
    finally:
        await db.close()


class UserStatusPatch(BaseModel):
    status: str  # active | suspended


@router.patch("/users/{user_id}")
async def admin_patch_user(user_id: int, req: UserStatusPatch, request: Request, user=Depends(require_admin("users.suspend"))):
    if req.status not in {"active", "suspended"}:
        raise HTTPException(status_code=422, detail="status must be 'active' or 'suspended'")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own account status")
    db = await get_db()
    try:
        target = await (await db.execute("SELECT id, email, status FROM users WHERE id = ?", (user_id,))).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        target = dict(target)
        await db.execute("UPDATE users SET status = ? WHERE id = ?", (req.status, user_id))
        await log_audit(
            db, actor=user,
            action="user.suspend" if req.status == "suspended" else "user.reactivate",
            target_type="user", target_id=user_id, request=request,
            before={"status": target["status"]}, after={"status": req.status},
        )
        return {"id": user_id, "status": req.status}
    finally:
        await db.close()


class UserRolePatch(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def admin_change_role(user_id: int, req: UserRolePatch, request: Request, user=Depends(require_admin("users.manage_role"))):
    if req.role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Allowed: {sorted(ASSIGNABLE_ROLES)}")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    db = await get_db()
    try:
        target = await (await db.execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,))).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        target = dict(target)
        if target["role"] == "owner" and req.role != "owner":
            owner_count = (await (await db.execute("SELECT COUNT(*) FROM users WHERE role = 'owner'")).fetchone())[0]
            if owner_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot demote the last owner")
        await db.execute("UPDATE users SET role = ? WHERE id = ?", (req.role, user_id))
        await log_audit(
            db, actor=user, action="user.role_change", target_type="user", target_id=user_id,
            request=request, before={"role": target["role"]}, after={"role": req.role},
        )
        return {"id": user_id, "role": req.role}
    finally:
        await db.close()


# ── Roles registry (read-only) ───────────────────────────────────────────────

@router.get("/roles")
async def admin_roles(user=Depends(require_admin("roles.view"))):
    return {
        "roles": [
            {
                "name": r,
                "description": ROLE_DESCRIPTIONS.get(r, ""),
                "permissions": sorted(ROLE_PERMISSIONS[r]),
            }
            for r in ["owner", "admin", "operator", "auditor", "support"]
        ],
        "all_permissions": ALL_PERMISSIONS,
    }


# ── Audit logs ───────────────────────────────────────────────────────────────

def _audit_filters(actor, action, target_type, result, date_from, date_to, q):
    conditions, params = [], []
    if actor:
        conditions.append("(actor_email LIKE ? OR actor_id = ?)")
        params.extend([f"%{actor}%", actor if str(actor).isdigit() else -1])
    if action:
        conditions.append("action = ?"); params.append(action)
    if target_type:
        conditions.append("target_type = ?"); params.append(target_type)
    if result:
        conditions.append("result = ?"); params.append(result)
    if date_from:
        conditions.append("created_at >= ?"); params.append(date_from)
    if date_to:
        conditions.append("created_at <= ?"); params.append(date_to)
    if q:
        conditions.append("(action LIKE ? OR target_id LIKE ? OR route LIKE ?)")
        params.extend([f"%{q}%"] * 3)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return where, params


@router.get("/audit-logs")
async def admin_audit_logs(
    actor: str = Query(""),
    action: str = Query(""),
    target_type: str = Query(""),
    result: str = Query(""),
    date_from: str = Query(""),
    date_to: str = Query(""),
    q: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user=Depends(require_admin("audit.view")),
):
    db = await get_db()
    try:
        where, params = _audit_filters(actor, action, target_type, result, date_from, date_to, q)
        total = (await (await db.execute(f"SELECT COUNT(*) FROM admin_audit_logs {where}", params)).fetchone())[0]
        offset = (page - 1) * per_page
        rows = await (await db.execute(
            f"SELECT * FROM admin_audit_logs {where} ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        )).fetchall()
        return {
            "total": total, "page": page, "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
            "data": [dict(r) for r in rows],
        }
    finally:
        await db.close()


@router.get("/audit-logs/export")
async def admin_audit_export(
    request: Request,
    actor: str = Query(""),
    action: str = Query(""),
    target_type: str = Query(""),
    result: str = Query(""),
    date_from: str = Query(""),
    date_to: str = Query(""),
    q: str = Query(""),
    user=Depends(require_admin("audit.export")),
):
    db = await get_db()
    try:
        where, params = _audit_filters(actor, action, target_type, result, date_from, date_to, q)
        rows = await (await db.execute(
            f"SELECT * FROM admin_audit_logs {where} ORDER BY id DESC LIMIT 10000", params
        )).fetchall()

        buf = StringIO()
        writer = csv.writer(buf)
        cols = ["id", "created_at", "actor_email", "actor_role", "action",
                "target_type", "target_id", "result", "ip", "route"]
        writer.writerow(cols)
        for r in rows:
            d = dict(r)
            writer.writerow([d.get(c, "") for c in cols])

        await log_audit(
            db, actor=user, action="audit.export", target_type="audit_log",
            target_id=f"{len(rows)} rows", request=request,
        )
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="audit_logs.csv"'},
        )
    finally:
        await db.close()


# ── Email / SMTP settings ─────────────────────────────────────────────────────

class EmailSettingsPatch(BaseModel):
    # All optional: only provided fields are written. A blank/omitted password
    # preserves the stored one (the UI never receives it back to resend).
    smtp_host: str | None = None
    smtp_port: str | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_from_name: str | None = None


def _email_settings_view(config: dict) -> dict:
    """Public shape of the email config — resolved values minus the secret."""
    return {
        "smtp_host": config["smtp_host"],
        "smtp_port": config["smtp_port"],
        "smtp_user": config["smtp_user"],
        "smtp_from": config["smtp_from"],
        "smtp_from_name": config["smtp_from_name"],
        "password_set": bool(config["smtp_password"]),
        "configured": email_is_configured(config),
    }


@router.get("/settings/email")
async def admin_get_email_settings(user=Depends(require_admin("settings.view"))):
    config = await resolve_email_config()
    return _email_settings_view(config)


@router.put("/settings/email")
async def admin_update_email_settings(
    req: EmailSettingsPatch,
    request: Request,
    user=Depends(require_admin("settings.manage")),
):
    # Write only the fields that were provided. The password is special: a blank
    # value means "leave the stored password untouched".
    values: dict[str, str] = {}
    for field in ("smtp_host", "smtp_port", "smtp_user", "smtp_from", "smtp_from_name"):
        provided = getattr(req, field)
        if provided is not None:
            values[field] = provided.strip()
    password_updated = bool(req.smtp_password)
    if password_updated:
        values["smtp_password"] = req.smtp_password

    db = await get_db()
    try:
        await set_email_settings(db, values, updated_by=user["email"])
        # Audit the change with the secret redacted.
        audited = {k: ("***" if k == "smtp_password" else v) for k, v in values.items()}
        await log_audit(
            db, actor=user, action="settings.email.update",
            target_type="settings", target_id="email", request=request,
            after=audited,
        )
    finally:
        await db.close()

    config = await resolve_email_config()
    return {**_email_settings_view(config), "password_updated": password_updated}


@router.post("/settings/email/test")
async def admin_test_email_settings(request: Request, user=Depends(require_admin("settings.manage"))):
    config = await resolve_email_config()
    if not email_is_configured(config):
        raise HTTPException(status_code=503, detail="SMTP non configure")
    subject = "Test - configuration email (admin)"
    text = "Votre configuration SMTP fonctionne."
    html = "<p>Votre configuration SMTP fonctionne.</p>"
    try:
        await asyncio.to_thread(send_email, config, user["email"], subject, html, text)
    except Exception as e:
        db = await get_db()
        try:
            await log_audit(
                db, actor=user, action="settings.email.test", target_type="settings",
                target_id="email", result="failure", request=request,
                after={"error": str(e)[:200]},
            )
        finally:
            await db.close()
        raise HTTPException(status_code=502, detail=f"Echec d'envoi: {e}")

    db = await get_db()
    try:
        await log_audit(
            db, actor=user, action="settings.email.test", target_type="settings",
            target_id="email", request=request, after={"to": user["email"]},
        )
    finally:
        await db.close()
    return {"status": "sent", "to": user["email"]}
