"""Editable recurring-job scheduler (the "cron jobs" the admin space steers).

Replaces the single hardcoded daily scrape loop with a small, persisted job
registry. Each job (``scrape_digest``, ``dce_cache``, ``dce_extraction``,
``dce_cache_cleanup``, ``tender_stats``) has a
row in ``job_schedules`` with an ``enabled`` flag and either a *daily* firing
hour or an *interval* cadence. The scheduler loop reads the table live each tick,
so the admin can retune the cadence at runtime without a redeploy.

The due-decision (``is_due``) and next-run projection (``compute_next_run``) are
pure functions so they unit-test in isolation. Dispatch reuses the existing run
coroutines + their locks, so a scheduled run and a manual run never overlap.
"""

import asyncio
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from database import get_db

MOROCCO_TZ = ZoneInfo("Africa/Casablanca")

# Also the firing order inside one tick: ``tender_stats`` stays last so it
# counts after a scrape that is due at the same time.
VALID_JOBS = ("scrape_digest", "dce_cache", "dce_extraction", "dce_cache_cleanup", "tender_stats")

# actor_email recorded on runs the scheduler loop fires by itself.
SCHEDULER_ACTOR = "scheduler"
VALID_KINDS = ("daily", "interval")

JOB_LABELS = {
    "scrape_digest": "Scrape + digest e-mail",
    "dce_cache": "Mise en cache des DCE",
    "dce_extraction": "Extraction des DCE",
    "dce_cache_cleanup": "Nettoyage du cache DCE (échéances dépassées)",
    "tender_stats": "Calcul du nombre d'appels d'offres",
}

# How often the loop wakes to re-evaluate schedules. Small relative to the
# shortest sensible interval; a daily job fires on the first tick inside its hour.
TICK_SECONDS = 60

# Guard rails on admin-supplied values.
MIN_INTERVAL_MINUTES = 5
MAX_INTERVAL_MINUTES = 7 * 24 * 60  # a week


def _default_hour() -> int:
    try:
        return int(os.getenv("DIGEST_HOUR", "7"))
    except ValueError:
        return 7


def _default_rows() -> list[dict]:
    """Seed defaults. Scrape keeps today's behavior (daily @ DIGEST_HOUR, on);
    the DCE jobs are interval-based and OFF until an admin enables them; the
    cache cleanup is daily (an hour before the scrape) and OFF by default too.
    The tender count is recomputed daily at the scrape's hour (ON); the admin
    dashboard can switch it to hourly (kind=interval, 60 min)."""
    hour = _default_hour()
    return [
        {"job": "scrape_digest", "enabled": 1, "schedule_kind": "daily",
         "hour": hour, "interval_minutes": 1440},
        {"job": "dce_cache", "enabled": 0, "schedule_kind": "interval",
         "hour": hour, "interval_minutes": 30},
        {"job": "dce_extraction", "enabled": 0, "schedule_kind": "interval",
         "hour": hour, "interval_minutes": 120},
        {"job": "dce_cache_cleanup", "enabled": 0, "schedule_kind": "daily",
         "hour": (hour - 1) % 24, "interval_minutes": 1440},
        {"job": "tender_stats", "enabled": 1, "schedule_kind": "daily",
         "hour": hour, "interval_minutes": 60},
    ]


async def ensure_seeded(db) -> None:
    """Insert any missing default job rows (idempotent). Caller owns the db."""
    for row in _default_rows():
        await db.execute(
            """INSERT OR IGNORE INTO job_schedules
               (job, enabled, schedule_kind, hour, interval_minutes)
               VALUES (?, ?, ?, ?, ?)""",
            (row["job"], row["enabled"], row["schedule_kind"], row["hour"], row["interval_minutes"]),
        )
    await db.commit()


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
    # Rows are written tz-aware; tolerate naive by assuming Morocco time.
    return dt if dt.tzinfo else dt.replace(tzinfo=MOROCCO_TZ)


def is_due(row: dict, now: datetime) -> bool:
    """Whether an enabled job should fire at ``now`` (tz-aware, Morocco time)."""
    if not row.get("enabled"):
        return False
    last = _parse_dt(row.get("last_run_at"))
    if row.get("schedule_kind") == "interval":
        minutes = int(row.get("interval_minutes") or 0)
        if last is None:
            return True
        return (now - last) >= timedelta(minutes=max(1, minutes))
    # daily: fire once, on the first tick inside the target hour each day.
    if now.hour != int(row.get("hour") or 0):
        return False
    return last is None or last.date() != now.date()


def compute_next_run(row: dict, now: datetime) -> datetime | None:
    """Projected next firing for display; ``None`` when the job is disabled."""
    if not row.get("enabled"):
        return None
    if row.get("schedule_kind") == "interval":
        minutes = max(1, int(row.get("interval_minutes") or 0))
        last = _parse_dt(row.get("last_run_at"))
        if last is None:
            return now
        return max(last + timedelta(minutes=minutes), now)
    hour = int(row.get("hour") or 0)
    if is_due(row, now):
        return now
    target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target


def _row_view(row: dict, now: datetime) -> dict:
    nxt = compute_next_run(row, now)
    return {
        "job": row["job"],
        "label": JOB_LABELS.get(row["job"], row["job"]),
        "enabled": bool(row["enabled"]),
        "schedule_kind": row["schedule_kind"],
        "hour": row["hour"],
        "interval_minutes": row["interval_minutes"],
        "last_run_at": row.get("last_run_at"),
        "last_status": row.get("last_status"),
        "next_run_at": nxt.isoformat() if nxt else None,
        "updated_at": row.get("updated_at"),
        "updated_by": row.get("updated_by"),
    }


async def list_schedules(db) -> list[dict]:
    await ensure_seeded(db)
    rows = await (await db.execute(
        "SELECT * FROM job_schedules ORDER BY job"
    )).fetchall()
    now = datetime.now(MOROCCO_TZ)
    return [_row_view(dict(r), now) for r in rows]


async def get_schedule(db, job: str) -> dict | None:
    row = await (await db.execute(
        "SELECT * FROM job_schedules WHERE job = ?", (job,)
    )).fetchone()
    return dict(row) if row else None


def validate_update(fields: dict) -> dict:
    """Validate an admin schedule edit → the sanitized subset to persist.
    Raises ValueError with a user-facing message on bad input."""
    out: dict = {}
    if "enabled" in fields and fields["enabled"] is not None:
        out["enabled"] = 1 if fields["enabled"] else 0
    if fields.get("schedule_kind") is not None:
        if fields["schedule_kind"] not in VALID_KINDS:
            raise ValueError("schedule_kind must be 'daily' or 'interval'.")
        out["schedule_kind"] = fields["schedule_kind"]
    if fields.get("hour") is not None:
        hour = int(fields["hour"])
        if not 0 <= hour <= 23:
            raise ValueError("hour must be between 0 and 23.")
        out["hour"] = hour
    if fields.get("interval_minutes") is not None:
        minutes = int(fields["interval_minutes"])
        if not MIN_INTERVAL_MINUTES <= minutes <= MAX_INTERVAL_MINUTES:
            raise ValueError(
                f"interval_minutes must be between {MIN_INTERVAL_MINUTES} and {MAX_INTERVAL_MINUTES}."
            )
        out["interval_minutes"] = minutes
    return out


async def update_schedule(db, job: str, fields: dict, *, updated_by: str | None = None) -> dict:
    """Apply a validated partial update to one job. Caller owns the db so the
    write + audit row commit together. Returns the refreshed row view."""
    await ensure_seeded(db)
    clean = validate_update(fields)
    if clean:
        sets = ", ".join(f"{k} = ?" for k in clean)
        params = list(clean.values()) + [updated_by, job]
        await db.execute(
            f"UPDATE job_schedules SET {sets}, updated_at = datetime('now'), updated_by = ? WHERE job = ?",
            params,
        )
        await db.commit()
    row = await get_schedule(db, job)
    return _row_view(row, datetime.now(MOROCCO_TZ))


async def _set_run_state(job: str, *, last_run_at: str | None = None, last_status: str | None = None) -> None:
    db = await get_db()
    try:
        sets, params = [], []
        if last_run_at is not None:
            sets.append("last_run_at = ?"); params.append(last_run_at)
        if last_status is not None:
            sets.append("last_status = ?"); params.append(last_status)
        if not sets:
            return
        params.append(job)
        await db.execute(f"UPDATE job_schedules SET {', '.join(sets)} WHERE job = ?", params)
        await db.commit()
    finally:
        await db.close()


async def _job_is_busy(job: str) -> bool:
    """Whether the underlying pipeline for ``job`` is already running."""
    if job == "scrape_digest":
        from main import scrape_lock
        return scrape_lock.locked()
    if job == "dce_cache":
        from dce_cache import dce_cache_lock
        return dce_cache_lock.locked()
    if job == "dce_extraction":
        from pipeline_control import DCE_EXTRACTION
        return DCE_EXTRACTION.running
    if job == "dce_cache_cleanup":
        # Never sweep files while a warm-all run is writing them.
        from dce_cache import dce_cache_lock, dce_cleanup_lock
        return dce_cache_lock.locked() or dce_cleanup_lock.locked()
    return False


def _job_coro(job: str, *, actor_email: str, base_url: str | None):
    """The awaitable that performs one run of ``job`` (or None if unrunnable)."""
    if job == "scrape_digest":
        from main import run_scrape_and_digest
        # "Run now" from the admin Cron tab is a manual run; only the loop's own
        # firings (actor "scheduler") are scheduled.
        trigger = "scheduled" if actor_email == SCHEDULER_ACTOR else "manual"
        return run_scrape_and_digest(actor_email=actor_email, trigger=trigger)
    if job == "dce_cache":
        from dce_cache import cache_all_dces
        return cache_all_dces(actor_email=actor_email)
    if job == "dce_extraction":
        if not base_url:
            return None
        from dce_extraction import extract_all_dces
        return extract_all_dces(base_url, actor_email=actor_email)
    if job == "dce_cache_cleanup":
        from dce_cache import cleanup_outdated_dces
        return cleanup_outdated_dces(actor_email=actor_email)
    if job == "tender_stats":
        from admin import refresh_tender_stats
        return refresh_tender_stats(actor_email=actor_email)
    return None


# Run outcomes, in the order of severity the admin surfaces them.
# A job reports its own result: several sweeps catch their exceptions
# internally and return {"status": "failed"} or {"status": "stopped"}, so a
# coroutine returning without raising is not proof that the work succeeded.
_OUTCOME_ALIASES = {
    "ok": "ok", "done": "ok", "success": "ok",
    "partial": "partial",
    "failed": "failed", "error": "failed",
    "stopped": "stopped", "cancelled": "stopped", "canceled": "stopped",
}


def job_outcome(result) -> str:
    """Map a job's returned payload to the status recorded for that run."""
    if isinstance(result, dict):
        reported = str(result.get("status") or "").lower()
        if reported in _OUTCOME_ALIASES:
            return _OUTCOME_ALIASES[reported]
        # No explicit status: a non-zero failure counter still means the run
        # did not fully succeed, so it must not read as a clean success.
        if result.get("failed"):
            return "partial"
    return "ok"


# Run tables whose rows are owned by this process: an in-flight row can only be
# live while the process that wrote it is, so one left behind is interrupted work.
_RUN_TABLES = ("scrape_log", "dce_cache_log", "dce_extraction_log")


async def reconcile_interrupted_runs() -> int:
    """Close run rows a previous process left 'running'. Returns rows closed.

    Progress and control flags are process-local, so after a restart or a crash
    nothing owns those rows. Leaving them 'running' makes the admin claim work
    is in flight that will never finish.
    """
    db = await get_db()
    try:
        closed = 0
        for table in _RUN_TABLES:
            cur = await db.execute(
                f"""UPDATE {table}
                    SET status = 'interrupted',
                        finished_at = COALESCE(finished_at, datetime('now'))
                    WHERE status = 'running'"""
            )
            closed += cur.rowcount or 0
        await db.commit()
        if closed:
            print(f"[scheduler] reconciled {closed} interrupted run(s) at startup")
        return closed
    finally:
        await db.close()


async def _supervise(job: str, coro) -> None:
    try:
        result = await coro
        await _set_run_state(job, last_status=job_outcome(result))
    except Exception as e:  # noqa: BLE001
        print(f"[scheduler] job {job} failed: {e}")
        await _set_run_state(job, last_status="failed")


async def run_job(job: str, *, actor_email: str = SCHEDULER_ACTOR, base_url: str | None = None) -> bool:
    """Launch one run of ``job`` in the background. Returns False (no-op) if the
    job is unknown, already running, or missing a prerequisite (base_url)."""
    if job not in VALID_JOBS:
        return False
    if await _job_is_busy(job):
        return False
    coro = _job_coro(job, actor_email=actor_email, base_url=base_url)
    if coro is None:
        return False
    await _set_run_state(job, last_run_at=datetime.now(MOROCCO_TZ).isoformat(), last_status="running")
    asyncio.create_task(_supervise(job, coro))
    return True


async def _audit_scheduled_run(job: str) -> None:
    """Audit an automatic firing, mirroring the ``cron.run`` row a manual
    "run now" writes. Best-effort: a tracing failure must not stop the loop."""
    from admin import log_audit  # lazy: admin imports this module
    try:
        db = await get_db()
        try:
            await log_audit(db, actor={"email": SCHEDULER_ACTOR, "role": "system"},
                            action="cron.scheduled_run", target_type="job", target_id=job)
        finally:
            await db.close()
    except Exception as e:  # noqa: BLE001
        print(f"[scheduler] audit of scheduled run {job} failed: {e}")


def _base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "").strip()


async def tick() -> list[str]:
    """One scheduler pass: fire every due, enabled job. Returns fired job keys."""
    db = await get_db()
    try:
        await ensure_seeded(db)
        rows = [dict(r) for r in await (await db.execute("SELECT * FROM job_schedules")).fetchall()]
    finally:
        await db.close()
    now = datetime.now(MOROCCO_TZ)
    fired = []
    rows.sort(key=lambda r: VALID_JOBS.index(r["job"]) if r["job"] in VALID_JOBS else len(VALID_JOBS))
    for row in rows:
        if is_due(row, now):
            if await run_job(row["job"], actor_email=SCHEDULER_ACTOR, base_url=_base_url()):
                fired.append(row["job"])
                await _audit_scheduled_run(row["job"])
    return fired


async def job_scheduler_loop() -> None:
    """Long-lived loop started from the app lifespan; ticks every TICK_SECONDS."""
    while True:
        try:
            await tick()
        except Exception as e:  # noqa: BLE001
            print(f"[scheduler] tick failed: {e}")
        await asyncio.sleep(TICK_SECONDS)
