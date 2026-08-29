"""DCE ZIP caching.

Downloads each tender's DCE once (filling the portal's anonymous form
programmatically via ``download_dce``), stores the ZIP on the persistent
``/app/data`` volume, and serves cached copies instantly. This removes both the
slow multi-step portal handshake and the double-hop proxying from the user's
download path — one click, no form, no wait.

Two entry points:
- ``ensure_dce_cached`` — lazy: serve from cache, or fetch+store on first use.
- ``cache_all_dces`` — admin warm-all: pre-fetch every tender's DCE in the
  background. Skips already-cached (resumable) and stops if disk runs low.
"""

import asyncio
import hashlib
import os
import shutil

from config import DCE_CACHE_DIR, DCE_MIN_FREE_BYTES
from database import get_db
from scraper import download_dce, ensure_tender_details

# Only one warm-all run at a time (mirrors main.scrape_lock for imports).
dce_cache_lock = asyncio.Lock()


def _disk_path(tender_id: str) -> str:
    # tender_id may contain slashes; hash it for a safe, collision-free filename.
    digest = hashlib.sha1(tender_id.encode("utf-8")).hexdigest()
    return os.path.join(DCE_CACHE_DIR, f"{digest}.zip")


def _has_free_space() -> bool:
    try:
        os.makedirs(DCE_CACHE_DIR, exist_ok=True)
        return shutil.disk_usage(DCE_CACHE_DIR).free >= DCE_MIN_FREE_BYTES
    except OSError:
        return True  # don't block the run on a stat failure


async def _store(db, tender_id: str, file_bytes: bytes, filename: str) -> tuple[str, str]:
    os.makedirs(DCE_CACHE_DIR, exist_ok=True)
    path = _disk_path(tender_id)
    with open(path, "wb") as f:
        f.write(file_bytes)
    await db.execute(
        """INSERT OR REPLACE INTO dce_cache (tender_id, filename, size, status, error, cached_at)
           VALUES (?, ?, ?, 'ok', NULL, datetime('now'))""",
        (tender_id, filename, len(file_bytes)),
    )
    await db.commit()
    return path, filename


async def get_cached(db, tender_id: str) -> tuple[str, str] | None:
    """Return (path, filename) if a healthy cached ZIP exists on disk, else None."""
    row = await (await db.execute(
        "SELECT filename FROM dce_cache WHERE tender_id = ? AND status = 'ok'", (tender_id,)
    )).fetchone()
    if not row:
        return None
    path = _disk_path(tender_id)
    if not os.path.exists(path):
        return None
    return path, (row["filename"] or "dce.zip")


async def ensure_dce_cached(db, tender_id: str, dce_url: str) -> tuple[str, str] | None:
    """Serve-from-cache, or fetch+store on a miss. Returns (path, filename) or None.

    The live fetch fills the portal's anonymous form automatically, so the user
    never sees a form even on the first (uncached) download.
    """
    cached = await get_cached(db, tender_id)
    if cached:
        return cached

    result = await download_dce(dce_url)
    if not result:
        await db.execute(
            """INSERT OR REPLACE INTO dce_cache (tender_id, filename, size, status, error, cached_at)
               VALUES (?, NULL, 0, 'failed', 'download failed', datetime('now'))""",
            (tender_id,),
        )
        await db.commit()
        return None

    file_bytes, filename = result
    return await _store(db, tender_id, file_bytes, filename)


async def cache_all_dces(actor_email: str | None = None) -> dict:
    """Warm the cache for every tender: ensure details -> download DCE -> store.

    Skips tenders already cached (resumable), and stops gracefully if free disk
    space drops below the guard threshold so a run can't fill the volume.
    """
    async with dce_cache_lock:
        db = await get_db()
        log_cursor = await db.execute(
            "INSERT INTO dce_cache_log (status, actor_email) VALUES ('running', ?)",
            (actor_email,),
        )
        log_id = log_cursor.lastrowid
        await db.commit()

        total = cached = skipped = failed = 0
        final_status = "done"
        err = None
        try:
            rows = await (await db.execute(
                "SELECT id, detail_url FROM tenders "
                "WHERE detail_url IS NOT NULL AND detail_url != ''"
            )).fetchall()
            total = len(rows)

            for row in rows:
                tender_id = row["id"]

                if await get_cached(db, tender_id):
                    skipped += 1
                    continue

                if not _has_free_space():
                    final_status = "stopped"
                    err = "Low disk space — stopped to protect the volume."
                    break

                # Make sure we have a dce_url (lazily scrape details if missing).
                detail = await ensure_tender_details(db, tender_id, row["detail_url"])
                dce_url = (detail or {}).get("dce_url", "")
                if not dce_url:
                    skipped += 1
                    continue

                if await ensure_dce_cached(db, tender_id, dce_url):
                    cached += 1
                else:
                    failed += 1

                # Keep counters fresh so the polling admin UI shows progress.
                await db.execute(
                    "UPDATE dce_cache_log SET total=?, cached=?, skipped=?, failed=? WHERE id=?",
                    (total, cached, skipped, failed, log_id),
                )
                await db.commit()
        except Exception as e:  # noqa: BLE001
            final_status = "failed"
            err = str(e)[:500]
        finally:
            await db.execute(
                """UPDATE dce_cache_log
                   SET finished_at = datetime('now'),
                       total=?, cached=?, skipped=?, failed=?, status=?, error=?
                   WHERE id = ?""",
                (total, cached, skipped, failed, final_status, err, log_id),
            )
            await db.commit()
            await db.close()

        return {"total": total, "cached": cached, "skipped": skipped,
                "failed": failed, "status": final_status}
