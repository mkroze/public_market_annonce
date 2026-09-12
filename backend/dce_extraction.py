"""Per-tender DCE extraction storage + recap markdown.

The backend never runs OCR or extraction itself; it persists results delivered
by the (external) OCR/redaction + n8n pipeline via the callback endpoint, and
renders a deterministic ``context-{id}.md`` recap from each stored payload.
"""

import asyncio
import hashlib
import json
import os

import config


def context_md_path(tender_id: str) -> str:
    # tender_id may contain slashes; hash it for a safe filename (mirrors dce_cache).
    digest = hashlib.sha1(tender_id.encode("utf-8")).hexdigest()
    return os.path.join(config.DCE_CONTEXT_DIR, f"context-{digest}.md")


def zip_content_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _render_context_md(tender_id: str, payload: dict) -> str:
    core = payload.get("core") or {}
    lines = [f"# DCE — {tender_id}", ""]
    obj = core.get("object")
    if obj and obj.get("value"):
        lines += ["## Objet", obj["value"], ""]
    key_points = payload.get("key_points") or []
    if key_points:
        lines += ["## Points clés"] + [f"- {p}" for p in key_points] + [""]
    dates = core.get("key_dates") or []
    if dates:
        lines += ["## Dates"] + [f"- {d.get('label', '')}: {d.get('value', '')}" for d in dates] + [""]
    quals = core.get("qualifications") or []
    if quals:
        lines += ["## Qualifications requises"] + [f"- {q.get('value', '')}" for q in quals] + [""]
    tags = payload.get("tags") or []
    if tags:
        lines += ["## Tags", ", ".join(tags), ""]
    lines += [f"_status: {payload.get('status', '')} · langue: {payload.get('ocr_lang', '')}_"]
    return "\n".join(lines)


async def store_extraction(db, tender_id: str, payload: dict) -> None:
    """Upsert the extraction row and (re)write the recap markdown. Commits."""
    os.makedirs(config.DCE_CONTEXT_DIR, exist_ok=True)
    await db.execute(
        """INSERT OR REPLACE INTO dce_extraction
           (tender_id, zip_hash, status, ocr_lang, model,
            core_json, key_points_json, tags_json, doc_types_json,
            redaction_stats, error, extracted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
        (
            tender_id,
            payload.get("zip_hash", ""),
            payload.get("status", "ok"),
            payload.get("ocr_lang", ""),
            payload.get("model", ""),
            json.dumps(payload.get("core") or {}, ensure_ascii=False),
            json.dumps(payload.get("key_points") or [], ensure_ascii=False),
            json.dumps(payload.get("tags") or [], ensure_ascii=False),
            json.dumps(payload.get("doc_types") or {}, ensure_ascii=False),
            json.dumps(payload.get("redaction_stats") or {}, ensure_ascii=False),
            payload.get("error"),
        ),
    )
    await db.commit()
    with open(context_md_path(tender_id), "w", encoding="utf-8") as f:
        f.write(_render_context_md(tender_id, payload))


async def get_extraction(db, tender_id: str) -> dict | None:
    row = await (await db.execute(
        "SELECT * FROM dce_extraction WHERE tender_id = ?", (tender_id,)
    )).fetchone()
    if not row:
        return None
    row = dict(row)
    row["core"] = json.loads(row.pop("core_json") or "{}")
    row["key_points"] = json.loads(row.pop("key_points_json") or "[]")
    row["tags"] = json.loads(row.pop("tags_json") or "[]")
    row["doc_types"] = json.loads(row.pop("doc_types_json") or "{}")
    row["redaction_stats"] = json.loads(row.get("redaction_stats") or "{}")
    return row


# Only one extraction sweep at a time (mirrors dce_cache_lock in dce_cache.py).
dce_extraction_lock = asyncio.Lock()

# ── Enqueue + warm-all sweep ─────────────────────────────────────────────────

import httpx  # noqa: E402

from dce_signing import sign_zip_token  # noqa: E402


async def enqueue_extraction(db, tender_id: str, base_url: str, client=None) -> bool:
    """POST a signed ZIP URL + tender_id to the n8n webhook. Returns success.

    ``client`` is injectable for tests; defaults to a real httpx.AsyncClient.
    """
    if not config.N8N_EXTRACT_WEBHOOK_URL:
        return False
    token = sign_zip_token(tender_id)
    zip_url = f"{base_url.rstrip('/')}/api/dce/{tender_id}/archive?token={token}"
    body = {"tender_id": tender_id, "zip_url": zip_url}
    owns = client is None
    client = client or httpx.AsyncClient()
    try:
        resp = await client.post(config.N8N_EXTRACT_WEBHOOK_URL, json=body, timeout=30)
        return 200 <= resp.status_code < 300
    except httpx.HTTPError:
        return False
    finally:
        if owns:
            await client.aclose()


async def _already_extracted(db, tender_id: str, zip_hash: str) -> bool:
    row = await (await db.execute(
        "SELECT zip_hash FROM dce_extraction WHERE tender_id = ?", (tender_id,)
    )).fetchone()
    return bool(row) and row["zip_hash"] == zip_hash and zip_hash != ""


async def extract_all_dces(base_url: str, actor_email: str | None = None) -> dict:
    """Enqueue every tender that has a cached DCE and isn't already extracted
    for the current ZIP. Records the sweep in dce_extraction_log."""
    async with dce_extraction_lock:
        from database import get_db
        from dce_cache import get_cached

        db = await get_db()
        cur = await db.execute(
            "INSERT INTO dce_extraction_log (status, actor_email) VALUES ('running', ?)",
            (actor_email,),
        )
        log_id = cur.lastrowid
        await db.commit()

        total = enqueued = skipped = failed = 0
        final_status = "done"
        err = None
        try:
            rows = await (await db.execute(
                "SELECT tender_id FROM dce_cache WHERE status = 'ok'"
            )).fetchall()
            total = len(rows)
            for r in rows:
                tid = r["tender_id"]
                cached = await get_cached(db, tid)
                if not cached:
                    skipped += 1
                    continue
                zh = zip_content_hash(cached[0])
                if await _already_extracted(db, tid, zh):
                    skipped += 1
                    continue
                if await enqueue_extraction(db, tid, base_url):
                    enqueued += 1
                else:
                    failed += 1
        except Exception as e:  # noqa: BLE001
            final_status = "failed"
            err = str(e)[:500]
        finally:
            await db.execute(
                """UPDATE dce_extraction_log
                   SET finished_at = datetime('now'), total=?, enqueued=?, skipped=?, failed=?, status=?, error=?
                   WHERE id=?""",
                (total, enqueued, skipped, failed, final_status, err, log_id),
            )
            await db.commit()
            await db.close()
        return {"total": total, "enqueued": enqueued, "skipped": skipped, "failed": failed, "status": final_status}
