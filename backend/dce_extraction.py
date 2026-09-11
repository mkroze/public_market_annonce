"""Per-tender DCE extraction storage + recap markdown.

The backend never runs OCR or extraction itself; it persists results delivered
by the (external) OCR/redaction + n8n pipeline via the callback endpoint, and
renders a deterministic ``context-{id}.md`` recap from each stored payload.
"""

import hashlib
import json
import os

from config import DCE_CONTEXT_DIR


def context_md_path(tender_id: str) -> str:
    # tender_id may contain slashes; hash it for a safe filename (mirrors dce_cache).
    digest = hashlib.sha1(tender_id.encode("utf-8")).hexdigest()
    return os.path.join(DCE_CONTEXT_DIR, f"context-{digest}.md")


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
    os.makedirs(DCE_CONTEXT_DIR, exist_ok=True)
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
    return row
