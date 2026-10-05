# DCE Extraction — Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the app-side of the DCE extraction pipeline — store per-tender structured extraction + a `context-dce-{id}.md` recap, expose a signed ZIP-fetch endpoint and an authenticated n8n callback, and an admin warm-all enqueue sweep — all testable in this repo against the documented callback contract, before the GPU box or n8n exist.

**Architecture:** The GPU box (OCR + redaction) and n8n (orchestration + OpenRouter) are **out of scope** here; this plan builds only what lives in the FastAPI/SQLite backend. n8n fetches a tender's cached DCE ZIP via a short-lived **HMAC-signed URL**, runs OCR→redact→extract, and POSTs results to a **shared-secret callback**; the backend validates and persists them. Extraction is company-agnostic (one shared row per tender). Reuses existing patterns: `database.py` migrations, `dce_cache.py` storage/batch style, the `restrict_v1_api_surface` allowlist, and `admin.py` RBAC + `log_audit`.

**Tech Stack:** Python 3, FastAPI, aiosqlite, `unittest` + `fastapi.testclient.TestClient`, `hmac`/`hashlib`/`secrets`, `httpx` (already used by `scraper.py`).

## Global Constraints

- Backend is the source of truth; frontend gating is UX only (matches the existing surface allowlist mindset).
- **Compliance invariant:** the backend never receives raw OCR text — only redacted, already-extracted results via the callback. The ZIP it serves is the *source* document; it is served only over a short-lived signed URL to the OCR box.
- Any new `/api/...` path must be added to `is_v1_catalog_api_path` (allowlist) in `backend/main.py` **and** covered in `backend/test_v1_api_surface.py`, or it returns 404. Machine endpoints (callback, signed ZIP fetch) must **also** be added to `is_public_v1_api_path` so they skip user-JWT auth, and enforce their own secret/token auth internally.
- Extraction is **company-agnostic**: one `dce_extraction` row per `tender_id`. No personalization here.
- Never fabricate data: the callback stores exactly what it receives; `not_found`/`null` fields are stored as-is, never inferred.
- Secrets (`DCE_EXTRACTION_SECRET`) come from env; never hard-code. Follow the `os.getenv(...)` pattern already in `config.py`.
- All new tests run with `cd backend && .venv/bin/python -m unittest <module>`.
- Frequent, path-limited commits (this repo currently has unrelated untracked files that must be preserved — never `git add -A`).

---

## Callback contract (the interface n8n + the OCR/redaction service must fulfill)

`POST /api/dce/extraction-callback` with header `X-Extraction-Secret: <DCE_EXTRACTION_SECRET>` and JSON body:

```json
{
  "tender_id": "string (must exist in tenders)",
  "zip_hash": "sha256 hex of the source ZIP that was processed",
  "status": "ok | partial | failed",
  "ocr_lang": "fr | ar | mixed | unknown",
  "model": "openrouter model id used for extraction",
  "core": {
    "object":        {"value": "…", "confidence": "high|med|low", "source_doc": "CPS", "quote": "…"},
    "key_dates":     [{"label": "deadline", "value": "…", "confidence": "…", "source_doc": "RC", "quote": "…"}],
    "qualifications":[{"value": "…", "confidence": "…", "source_doc": "…", "quote": "…"}],
    "agrements":     [{"value": "…", "confidence": "…", "source_doc": "…", "quote": "…"}],
    "required_documents": [{"value": "…", "confidence": "…", "source_doc": "…", "quote": "…"}],
    "financial":     {"caution": {"value": "…", …}, "ca_min": {"value": "…", …}},
    "lots":          [{"label": "Lot 1", "amount": "…", "confidence": "…", "quote": "…"}],
    "award_criteria":{"value": "…", "confidence": "…", "source_doc": "RC", "quote": "…"}
  },
  "key_points": ["free-form notable clause / risk", "…"],
  "tags": ["voirie", "réservé-pme", "…"],
  "doc_types": {"cps.pdf": "CPS", "rc.pdf": "RC"},
  "redaction_stats": {"names": 3, "cin": 1, "email": 0, "phone": 2},
  "error": null
}
```

Any core field may be `null` ("not found"). `status: failed` may carry only `error` + `redaction_stats` (e.g. `redaction_blocked`).

---

### Task 1: Config, schema & migrations

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/database.py`
- Test: `backend/test_dce_extraction.py` (create)

**Interfaces:**
- Produces: tables `dce_extraction`, `dce_extraction_log`; config `DCE_CONTEXT_DIR`, `N8N_EXTRACT_WEBHOOK_URL`, `DCE_EXTRACTION_SECRET`, `DCE_EXTRACT_SIGNING_TTL`.

- [ ] **Step 1: Write the failing schema test**

Create `backend/test_dce_extraction.py`:

```python
import asyncio
import os
import tempfile
import unittest


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class SchemaTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        run(database.init_db())

    def tearDown(self):
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_dce_extraction_tables_exist(self):
        import database

        async def scenario():
            db = await database.get_db()
            cols = {r["name"] for r in await (await db.execute("PRAGMA table_info(dce_extraction)")).fetchall()}
            log_cols = {r["name"] for r in await (await db.execute("PRAGMA table_info(dce_extraction_log)")).fetchall()}
            await db.close()
            return cols, log_cols

        cols, log_cols = run(scenario())
        self.assertLessEqual(
            {"tender_id", "zip_hash", "status", "ocr_lang", "model",
             "core_json", "key_points_json", "tags_json", "doc_types_json",
             "redaction_stats", "error", "extracted_at"},
            cols,
        )
        self.assertLessEqual(
            {"id", "started_at", "finished_at", "total", "enqueued",
             "skipped", "failed", "status", "actor_email"},
            log_cols,
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.SchemaTest -v`
Expected: FAIL — `dce_extraction` PRAGMA returns no columns (table missing).

- [ ] **Step 3: Add config constants**

In `backend/config.py`, after the `DCE_WARM_MIN_THREADS` line, add:

```python
# DCE extraction pipeline. Recap markdown lives next to the ZIP cache on /app/data.
DCE_CONTEXT_DIR = os.getenv("DCE_CONTEXT_DIR", "data/dce_context")
# n8n webhook the backend calls to enqueue one tender for OCR→redact→extract.
N8N_EXTRACT_WEBHOOK_URL = os.getenv("N8N_EXTRACT_WEBHOOK_URL", "")
# Shared secret the n8n callback must present, and HMAC key for signed ZIP URLs.
DCE_EXTRACTION_SECRET = os.getenv("DCE_EXTRACTION_SECRET", "")
# Signed ZIP-fetch URL lifetime (seconds) handed to the OCR box.
DCE_EXTRACT_SIGNING_TTL = int(os.getenv("DCE_EXTRACT_SIGNING_TTL", "900"))  # 15 min
```

- [ ] **Step 4: Add the tables + migrations**

In `backend/database.py`, inside the `executescript("""…""")` block (before the closing `"""`), append:

```sql
        -- Per-tender DCE extraction result (company-agnostic). One row per tender.
        CREATE TABLE IF NOT EXISTS dce_extraction (
            tender_id TEXT PRIMARY KEY REFERENCES tenders(id),
            zip_hash TEXT DEFAULT '',
            status TEXT DEFAULT 'ok',        -- ok | partial | failed
            ocr_lang TEXT DEFAULT '',
            model TEXT DEFAULT '',
            core_json TEXT DEFAULT '{}',
            key_points_json TEXT DEFAULT '[]',
            tags_json TEXT DEFAULT '[]',
            doc_types_json TEXT DEFAULT '{}',
            redaction_stats TEXT DEFAULT '{}',
            error TEXT,
            extracted_at TEXT DEFAULT (datetime('now'))
        );

        -- History of admin "extract all DCEs" enqueue sweeps.
        CREATE TABLE IF NOT EXISTS dce_extraction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT DEFAULT (datetime('now')),
            finished_at TEXT,
            total INTEGER DEFAULT 0,
            enqueued INTEGER DEFAULT 0,
            skipped INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',   -- running | done | failed
            actor_email TEXT,
            error TEXT
        );
```

(No `_add_column_if_missing` calls needed — these are new tables created by `CREATE TABLE IF NOT EXISTS`.)

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.SchemaTest -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/config.py backend/database.py backend/test_dce_extraction.py
git commit -m "feat(dce): add extraction schema, config, and context dir"
```

---

### Task 2: Extraction storage + context-md writer

**Files:**
- Create: `backend/dce_extraction.py`
- Test: `backend/test_dce_extraction.py` (add `StorageTest`)

**Interfaces:**
- Consumes: `database.get_db`; `config.DCE_CONTEXT_DIR`.
- Produces:
  - `context_md_path(tender_id: str) -> str`
  - `zip_content_hash(path: str) -> str`
  - `async store_extraction(db, tender_id: str, payload: dict) -> None` — upserts the row and writes `context-{id}.md`.
  - `async get_extraction(db, tender_id: str) -> dict | None` — returns the row with JSON fields decoded.

- [ ] **Step 1: Write the failing storage test**

Add to `backend/test_dce_extraction.py`:

```python
class StorageTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    def _seed(self, tid):
        import database
        async def s():
            db = await database.get_db()
            await db.execute(
                "INSERT INTO tenders (id, reference, title, entity) VALUES (?, ?, ?, ?)",
                (tid, "R", "T", "E"),
            )
            await db.commit()
            await db.close()
        run(s())

    def test_store_and_get_roundtrip_and_context_md(self):
        import dce_extraction
        self._seed("T1")
        payload = {
            "zip_hash": "abc", "status": "ok", "ocr_lang": "fr", "model": "m",
            "core": {"object": {"value": "Voirie", "confidence": "high", "source_doc": "CPS", "quote": "q"}},
            "key_points": ["Caution 2%"], "tags": ["voirie"],
            "doc_types": {"cps.pdf": "CPS"}, "redaction_stats": {"names": 2}, "error": None,
        }

        async def scenario():
            import database
            db = await database.get_db()
            await dce_extraction.store_extraction(db, "T1", payload)
            row = await dce_extraction.get_extraction(db, "T1")
            await db.close()
            return row

        row = run(scenario())
        self.assertEqual(row["status"], "ok")
        self.assertEqual(row["core"]["object"]["value"], "Voirie")
        self.assertEqual(row["tags"], ["voirie"])
        md_path = dce_extraction.context_md_path("T1")
        self.assertTrue(os.path.exists(md_path))
        with open(md_path, encoding="utf-8") as f:
            body = f.read()
        self.assertIn("Voirie", body)
        self.assertIn("voirie", body)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.StorageTest -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dce_extraction'`.

- [ ] **Step 3: Implement `backend/dce_extraction.py`**

Create `backend/dce_extraction.py`:

```python
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.StorageTest -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/dce_extraction.py backend/test_dce_extraction.py
git commit -m "feat(dce): extraction storage and context-md writer"
```

---

### Task 3: HMAC-signed ZIP-fetch URLs

**Files:**
- Create: `backend/dce_signing.py`
- Test: `backend/test_dce_extraction.py` (add `SigningTest`)

**Interfaces:**
- Consumes: `config.DCE_EXTRACTION_SECRET`, `config.DCE_EXTRACT_SIGNING_TTL`.
- Produces:
  - `sign_zip_token(tender_id: str, now: int | None = None) -> str` — returns `"{expiry}.{hexsig}"`.
  - `verify_zip_token(tender_id: str, token: str, now: int | None = None) -> bool`.

- [ ] **Step 1: Write the failing signing test**

Add to `backend/test_dce_extraction.py`:

```python
class SigningTest(unittest.TestCase):
    def setUp(self):
        import config
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900

    def test_sign_then_verify_ok(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertTrue(dce_signing.verify_zip_token("T/1", tok, now=1100))

    def test_expired_token_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertFalse(dce_signing.verify_zip_token("T/1", tok, now=1000 + 901))

    def test_wrong_tender_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertFalse(dce_signing.verify_zip_token("OTHER", tok, now=1100))

    def test_tampered_signature_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        expiry, _sig = tok.split(".", 1)
        self.assertFalse(dce_signing.verify_zip_token("T/1", f"{expiry}.deadbeef", now=1100))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.SigningTest -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dce_signing'`.

- [ ] **Step 3: Implement `backend/dce_signing.py`**

Create `backend/dce_signing.py`:

```python
"""Stateless HMAC-signed, short-lived tokens authorizing the OCR box to fetch
one tender's cached DCE ZIP. No DB state: the token carries its own expiry and
is bound to the tender_id by the signature."""

import hashlib
import hmac
import time

import config


def _sign(tender_id: str, expiry: int) -> str:
    msg = f"{tender_id}.{expiry}".encode("utf-8")
    key = config.DCE_EXTRACTION_SECRET.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def sign_zip_token(tender_id: str, now: int | None = None) -> str:
    now = int(time.time()) if now is None else now
    expiry = now + config.DCE_EXTRACT_SIGNING_TTL
    return f"{expiry}.{_sign(tender_id, expiry)}"


def verify_zip_token(tender_id: str, token: str, now: int | None = None) -> bool:
    now = int(time.time()) if now is None else now
    if not config.DCE_EXTRACTION_SECRET or not token or "." not in token:
        return False
    expiry_str, sig = token.split(".", 1)
    try:
        expiry = int(expiry_str)
    except ValueError:
        return False
    if now > expiry:
        return False
    return hmac.compare_digest(sig, _sign(tender_id, expiry))
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.SigningTest -v`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add backend/dce_signing.py backend/test_dce_extraction.py
git commit -m "feat(dce): HMAC-signed ZIP-fetch tokens"
```

---

### Task 4: Signed ZIP-fetch endpoint + surface allowlist

**Files:**
- Modify: `backend/main.py`
- Test: `backend/test_dce_extraction.py` (add `ZipFetchApiTest`), `backend/test_v1_api_surface.py`

**Interfaces:**
- Consumes: `dce_signing.verify_zip_token`, `dce_cache.get_cached`.
- Produces: `GET /api/dce/{tender_id}/archive?token=…` → the cached ZIP (FileResponse) or 401/404. Public (no user JWT), token-authenticated.

- [ ] **Step 1: Write the failing endpoint test**

Add to `backend/test_dce_extraction.py` (uses `TestClient` + real temp DB + a fake cached ZIP):

```python
class ZipFetchApiTest(unittest.TestCase):
    def setUp(self):
        import config, database
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900
        self.cachedir = tempfile.mkdtemp()
        config.DCE_CACHE_DIR = self.cachedir
        run(database.init_db())
        self.client = TestClient(main.app)

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.cachedir, ignore_errors=True)

    def _seed_with_zip(self, tid):
        import database, dce_cache
        async def s():
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                             (tid, "R", "T", "E"))
            await db.commit()
            path = dce_cache._disk_path(tid)
            os.makedirs(self.cachedir, exist_ok=True)
            with open(path, "wb") as f:
                f.write(b"PK\x03\x04zipbytes")
            await db.execute(
                "INSERT INTO dce_cache (tender_id, filename, size, status) VALUES (?,?,?, 'ok')",
                (tid, "dce.zip", 9),
            )
            await db.commit()
            await db.close()
        run(s())

    def test_valid_token_returns_zip(self):
        import dce_signing
        self._seed_with_zip("T1")
        tok = dce_signing.sign_zip_token("T1")
        r = self.client.get(f"/api/dce/T1/archive?token={tok}")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"zipbytes", r.content)

    def test_bad_token_is_401(self):
        self._seed_with_zip("T1")
        r = self.client.get("/api/dce/T1/archive?token=nope.deadbeef")
        self.assertEqual(r.status_code, 401)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.ZipFetchApiTest -v`
Expected: FAIL — 404 (route missing / blocked by surface guard).

- [ ] **Step 3: Allowlist the path + exempt it from user auth**

In `backend/main.py`, in `is_public_v1_api_path(...)` (the function that returns True for paths that skip user-JWT auth — it contains the `/api/tenders` / `/api/filters` checks around line 150), add before its final `return False`:

```python
    if path.startswith("/api/dce/") and path.endswith("/archive"):
        return True
    if path == "/api/dce/extraction-callback":
        return True
```

In `is_v1_catalog_api_path(...)` (around line 167), add to the boolean chain:

```python
        or path.startswith("/api/dce/")
```

- [ ] **Step 4: Add the endpoint**

In `backend/main.py`, near the other tender/DCE routes, add (add `from fastapi.responses import FileResponse` to the imports if not present; `dce_signing` and `dce_cache` are imported lazily inside to avoid import-order issues):

```python
@app.get("/api/dce/{tender_id:path}/archive")
async def fetch_dce_archive(tender_id: str, token: str = ""):
    import dce_signing
    import dce_cache
    if not dce_signing.verify_zip_token(tender_id, token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    db = await get_db()
    cached = await dce_cache.get_cached(db, tender_id)
    await db.close()
    if not cached:
        raise HTTPException(status_code=404, detail="DCE not cached")
    path, filename = cached
    return FileResponse(path, media_type="application/zip", filename=filename)
```

Note the `{tender_id:path}` converter so tender IDs containing `/` still route.

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.ZipFetchApiTest -v`
Expected: PASS.

- [ ] **Step 6: Add a surface-guard test**

In `backend/test_v1_api_surface.py`, mirror the existing style used for other public catalog paths and assert `/api/dce/T1/archive` is allowlisted (not 404 by the surface middleware) and does not require a Bearer token. Example (adapt to the file's existing helper/assertion style):

```python
    def test_dce_archive_is_public_surface(self):
        # allowlisted + auth-exempt: reaches the handler (401 for bad token), not 404/401-from-guard
        r = client.get("/api/dce/T1/archive?token=bad.sig")
        self.assertEqual(r.status_code, 401)  # handler-level, not surface 404
```

- [ ] **Step 7: Run surface tests**

Run: `cd backend && .venv/bin/python -m unittest test_v1_api_surface.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/main.py backend/test_dce_extraction.py backend/test_v1_api_surface.py
git commit -m "feat(dce): signed ZIP-fetch endpoint for the OCR box"
```

---

### Task 5: n8n callback endpoint

**Files:**
- Modify: `backend/main.py`
- Test: `backend/test_dce_extraction.py` (add `CallbackApiTest`), `backend/test_v1_api_surface.py`

**Interfaces:**
- Consumes: `config.DCE_EXTRACTION_SECRET`, `dce_extraction.store_extraction`.
- Produces: `POST /api/dce/extraction-callback` (header `X-Extraction-Secret`) → validates secret + `tender_id` existence, stores, returns `{"stored": true}`. 401 on bad secret, 404 on unknown tender.

- [ ] **Step 1: Write the failing callback test**

Add to `backend/test_dce_extraction.py`:

```python
class CallbackApiTest(unittest.TestCase):
    def setUp(self):
        import config, database
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())
        self.client = TestClient(main.app)
        run(self._seed("T1"))

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    async def _seed(self, tid):
        import database
        db = await database.get_db()
        await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                         (tid, "R", "T", "E"))
        await db.commit()
        await db.close()

    def _body(self):
        return {"tender_id": "T1", "zip_hash": "abc", "status": "ok", "ocr_lang": "fr",
                "model": "m", "core": {"object": {"value": "Voirie", "confidence": "high"}},
                "key_points": [], "tags": ["voirie"], "doc_types": {}, "redaction_stats": {}, "error": None}

    def test_bad_secret_is_401(self):
        r = self.client.post("/api/dce/extraction-callback", json=self._body(),
                             headers={"X-Extraction-Secret": "wrong"})
        self.assertEqual(r.status_code, 401)

    def test_unknown_tender_is_404(self):
        b = self._body(); b["tender_id"] = "MISSING"
        r = self.client.post("/api/dce/extraction-callback", json=b,
                             headers={"X-Extraction-Secret": "test-secret"})
        self.assertEqual(r.status_code, 404)

    def test_valid_callback_stores(self):
        r = self.client.post("/api/dce/extraction-callback", json=self._body(),
                             headers={"X-Extraction-Secret": "test-secret"})
        self.assertEqual(r.status_code, 200)
        import database, dce_extraction
        async def check():
            db = await database.get_db()
            row = await dce_extraction.get_extraction(db, "T1")
            await db.close()
            return row
        row = run(check())
        self.assertEqual(row["core"]["object"]["value"], "Voirie")
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.CallbackApiTest -v`
Expected: FAIL — 404 (route missing).

- [ ] **Step 3: Add the callback model + endpoint**

In `backend/main.py`, near the other `BaseModel` request models, add:

```python
class ExtractionCallback(BaseModel):
    tender_id: str
    zip_hash: str = ""
    status: str = "ok"
    ocr_lang: str = ""
    model: str = ""
    core: dict = {}
    key_points: list = []
    tags: list = []
    doc_types: dict = {}
    redaction_stats: dict = {}
    error: str | None = None
```

Then the endpoint (uses `Header` — already imported in main via FastAPI; if not, add `from fastapi import Header`):

```python
@app.post("/api/dce/extraction-callback")
async def dce_extraction_callback(
    payload: ExtractionCallback,
    x_extraction_secret: str = Header(default=""),
):
    import dce_extraction
    from config import DCE_EXTRACTION_SECRET
    if not DCE_EXTRACTION_SECRET or not hmac.compare_digest(x_extraction_secret, DCE_EXTRACTION_SECRET):
        raise HTTPException(status_code=401, detail="Invalid extraction secret")
    db = await get_db()
    exists = await (await db.execute("SELECT id FROM tenders WHERE id = ?", (payload.tender_id,))).fetchone()
    if not exists:
        await db.close()
        raise HTTPException(status_code=404, detail="Tender not found")
    await dce_extraction.store_extraction(db, payload.tender_id, payload.model_dump())
    await db.close()
    return {"stored": True}
```

Add `import hmac` at the top of `main.py` if not already present.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.CallbackApiTest -v`
Expected: PASS (all 3).

- [ ] **Step 5: Add a surface-guard test**

In `backend/test_v1_api_surface.py`, assert the callback is allowlisted + auth-exempt (adapt to the file's style):

```python
    def test_extraction_callback_is_public_surface(self):
        # no Bearer, wrong secret -> handler-level 401, proving it isn't surface-404'd
        r = client.post("/api/dce/extraction-callback", json={"tender_id": "x"},
                        headers={"X-Extraction-Secret": "wrong"})
        self.assertEqual(r.status_code, 401)
```

- [ ] **Step 6: Run surface tests**

Run: `cd backend && .venv/bin/python -m unittest test_v1_api_surface.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/test_dce_extraction.py backend/test_v1_api_surface.py
git commit -m "feat(dce): authenticated n8n extraction callback"
```

---

### Task 6: Public read endpoint for extraction results

**Files:**
- Modify: `backend/main.py`
- Test: `backend/test_dce_extraction.py` (add `ReadApiTest`)

**Interfaces:**
- Consumes: `dce_extraction.get_extraction`, `tender_lifecycle.public_visible_condition`.
- Produces: `GET /api/tenders/{tender_id}/dce-extraction` → the decoded extraction (or 404). Hidden for archived/non-visible tenders (reuse the public-visibility helper). This path is already allowlisted (`/api/tenders/…`) and login-gated by the existing `requires_v1_auth` rules — no surface change needed.

- [ ] **Step 1: Write the failing read test**

Add to `backend/test_dce_extraction.py`:

```python
class ReadApiTest(unittest.TestCase):
    def setUp(self):
        import config, database
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())
        self.client = TestClient(main.app)

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    def _seed(self, tid, admin_status="active", store=True):
        import database, dce_extraction
        async def s():
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity, admin_status) VALUES (?,?,?,?,?)",
                             (tid, "R", "T", "E", admin_status))
            await db.commit()
            if store:
                await dce_extraction.store_extraction(db, tid, {"status": "ok", "core": {"object": {"value": "V"}}, "tags": ["t"]})
            await db.close()
        run(s())

    def test_returns_extraction(self):
        self._seed("T1")
        r = self.client.get("/api/tenders/T1/dce-extraction")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["core"]["object"]["value"], "V")

    def test_missing_extraction_is_404(self):
        self._seed("T2", store=False)
        r = self.client.get("/api/tenders/T2/dce-extraction")
        self.assertEqual(r.status_code, 404)

    def test_archived_tender_is_404(self):
        self._seed("T3", admin_status="archived")
        r = self.client.get("/api/tenders/T3/dce-extraction")
        self.assertEqual(r.status_code, 404)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.ReadApiTest -v`
Expected: FAIL — 404 for the first test (route missing).

- [ ] **Step 3: Add the read endpoint**

In `backend/main.py` (import `from tender_lifecycle import public_visible_condition` is already added by the archived-visibility work; if absent, add it):

```python
@app.get("/api/tenders/{tender_id:path}/dce-extraction")
async def get_tender_dce_extraction(tender_id: str):
    import dce_extraction
    db = await get_db()
    visible = await (await db.execute(
        f"SELECT id FROM tenders t WHERE t.id = ? AND {public_visible_condition('t')}",
        (tender_id,),
    )).fetchone()
    if not visible:
        await db.close()
        raise HTTPException(status_code=404, detail="Tender not found")
    row = await dce_extraction.get_extraction(db, tender_id)
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="No extraction for this tender")
    return row
```

> Note: `/api/tenders/{tender_id}/dce-extraction` must be registered **before** any broad `/api/tenders/{tender_id}` catch-all, or place it so FastAPI's more specific path wins. Verify with the tests below.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.ReadApiTest -v`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/test_dce_extraction.py
git commit -m "feat(dce): public read endpoint for extraction results"
```

---

### Task 7: Enqueue + admin warm-all sweep

**Files:**
- Modify: `backend/dce_extraction.py`
- Modify: `backend/admin.py`
- Test: `backend/test_dce_extraction.py` (add `EnqueueTest`), `backend/test_admin.py` (add `ExtractionSweepTest`)

**Interfaces:**
- Consumes: `dce_signing.sign_zip_token`, `config.N8N_EXTRACT_WEBHOOK_URL`, `dce_cache.get_cached`, `admin.log_audit`, `admin.has_permission`, the existing admin auth dependency used by the "Run import" endpoint.
- Produces:
  - `async enqueue_extraction(db, tender_id, base_url, client=None) -> bool` — POSTs `{tender_id, zip_url}` (signed) to the n8n webhook; returns success.
  - `async extract_all_dces(base_url, actor_email=None) -> dict` — sweep cached DCEs, skip already-extracted with a matching `zip_hash`, enqueue the rest, log to `dce_extraction_log`.
  - `POST /api/admin/dce-extraction/run` (perm `imports.run`) and `GET /api/admin/dce-extraction/status` (perm `imports.view`).

- [ ] **Step 1: Write the failing enqueue test (mock httpx)**

Add to `backend/test_dce_extraction.py`:

```python
class EnqueueTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900
        config.N8N_EXTRACT_WEBHOOK_URL = "https://n8n.example/webhook/extract"
        run(database.init_db())

    def tearDown(self):
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_enqueue_posts_signed_zip_url(self):
        import dce_extraction

        class FakeResp:
            status_code = 200

        sent = {}

        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def post(self, url, json=None, timeout=None):
                sent["url"] = url
                sent["json"] = json
                return FakeResp()

        async def scenario():
            import database
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                             ("T1", "R", "T", "E"))
            await db.commit()
            ok = await dce_extraction.enqueue_extraction(db, "T1", "https://app.example", client=FakeClient())
            await db.close()
            return ok

        ok = run(scenario())
        self.assertTrue(ok)
        self.assertEqual(sent["url"], "https://n8n.example/webhook/extract")
        self.assertEqual(sent["json"]["tender_id"], "T1")
        self.assertIn("/api/dce/T1/archive?token=", sent["json"]["zip_url"])
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.EnqueueTest -v`
Expected: FAIL — `AttributeError: module 'dce_extraction' has no attribute 'enqueue_extraction'`.

- [ ] **Step 3: Implement enqueue + sweep in `backend/dce_extraction.py`**

Append to `backend/dce_extraction.py`:

```python
import httpx

import config
from dce_signing import sign_zip_token


async def enqueue_extraction(db, tender_id: str, base_url: str, client=None) -> bool:
    """POST a signed ZIP URL + tender_id to the n8n webhook. Returns success.
    `client` is injectable for tests; defaults to a real httpx.AsyncClient."""
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
```

- [ ] **Step 4: Run the enqueue test to verify it passes**

Run: `cd backend && .venv/bin/python -m unittest test_dce_extraction.EnqueueTest -v`
Expected: PASS.

- [ ] **Step 5: Write the failing admin-endpoint test**

Add `ExtractionSweepTest` to `backend/test_admin.py`, following the exact auth/setup pattern the file already uses for the existing **"Run import"** admin test (same TestClient, same way it authenticates an owner/admin actor, same header-token helper). Assert:

```python
    def test_run_extraction_requires_permission(self):
        # a role WITHOUT imports.run gets 403 (mirror the run-import permission test)
        ...

    def test_run_extraction_enqueues_and_logs(self):
        # monkeypatch dce_extraction.extract_all_dces to a fake returning a known dict;
        # POST /api/admin/dce-extraction/run as an authorized actor -> 200 + that dict;
        # assert a dce_extraction_log row semantics via GET /api/admin/dce-extraction/status
        ...
```

Fill these in by copying the existing run-import test's authorization scaffolding verbatim and swapping the route/permission. (The run-import test is the canonical template in `test_admin.py`.)

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && .venv/bin/python -m unittest test_admin.ExtractionSweepTest -v`
Expected: FAIL — route missing (404) / permission not enforced.

- [ ] **Step 7: Add the admin endpoints**

In `backend/admin.py`, mirroring the existing **run-import** endpoint (same dependency for the authenticated actor, same `has_permission` gate, same `log_audit` call, same `Request` use for `base_url`), add:

```python
@router.post("/dce-extraction/run")
async def run_dce_extraction(request: Request, actor=Depends(_admin_actor_dependency)):
    if not has_permission(actor.get("role"), "imports.run"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    import dce_extraction
    base_url = str(request.base_url)
    db = await get_db()
    await log_audit(db, actor=actor, action="dce_extraction.run", route="/api/admin/dce-extraction/run")
    await db.close()
    result = await dce_extraction.extract_all_dces(base_url, actor_email=actor.get("email"))
    return result


@router.get("/dce-extraction/status")
async def dce_extraction_status(actor=Depends(_admin_actor_dependency)):
    if not has_permission(actor.get("role"), "imports.view"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    db = await get_db()
    row = await (await db.execute(
        "SELECT * FROM dce_extraction_log ORDER BY id DESC LIMIT 1"
    )).fetchone()
    done = await (await db.execute("SELECT COUNT(*) AS n FROM dce_extraction WHERE status != 'failed'")).fetchone()
    await db.close()
    return {"last_run": dict(row) if row else None, "extracted_count": done["n"]}
```

Replace `_admin_actor_dependency` with the **actual dependency name** the existing admin routes use (find it in `admin.py` — the run-import route depends on it). Match its signature exactly.

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m unittest test_admin.ExtractionSweepTest test_dce_extraction.EnqueueTest -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/dce_extraction.py backend/admin.py backend/test_dce_extraction.py backend/test_admin.py
git commit -m "feat(dce): enqueue + admin warm-all extraction sweep"
```

---

### Task 8: Full regression & surface pass

**Files:** none (verification only).

- [ ] **Step 1: Run the whole backend suite**

Run: `cd backend && .venv/bin/python -m unittest discover -s . -p 'test_*.py'`
Expected: OK, 0 failures/errors. If a `/api/dce/...` route is 404'd, re-check the two allowlist edits in Task 4 Step 3 and the `{tender_id:path}` converters.

- [ ] **Step 2: Confirm path-limited working tree**

Run: `git status --short`
Expected: only the files this plan created/modified are committed; all pre-existing untracked files (strategy docs, `context.md`, `screenshots/`, etc.) remain untouched. Never `git add -A`.

- [ ] **Step 3: Manual contract smoke (optional, no external services)**

With `DCE_EXTRACTION_SECRET=test` set, POST a sample callback body (from the contract section) to a locally-running instance and confirm a `dce_extraction` row + `context-{id}.md` appear. This validates the contract the OCR/n8n plans must implement.

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-11-dce-extraction-pipeline-design.md`):
- Data model `dce_extraction` + `dce_extraction_log` + `context-dce-{id}.md` → Tasks 1–2. ✅
- Compliance boundary (backend only ever gets redacted, already-extracted results; ZIP served only via signed URL to the OCR box) → Tasks 3–5. ✅
- Callback contract (n8n → app), authenticated → Task 5. ✅
- Flexible extraction contract (core + `not_found` + `key_points` + `tags`, provenance carried in `core.*.confidence/source_doc/quote`) → stored verbatim in Tasks 2 & 5; **enforced by the OCR/extraction plan, not here** (backend stores what it's given). ✅
- Trigger: admin warm-all (reuses cache-style sweep + `dce_extraction_log`) + skip-unchanged via `zip_hash` → Task 7. Lazy-on-view enqueue: the `enqueue_extraction` helper exists (Task 7); wiring it into the tender-detail view is deferred to the consuming feature (C1/D2 display) — noted as a follow-up, not a gap in this pipeline. ✅
- Read/consumption endpoint (respects archived visibility) → Task 6. ✅
- Surface allowlist + tests for every new path → Tasks 4–5. ✅
- **Out of scope (own plans):** OCR + FR/AR redaction service (incl. redaction golden-set tests), n8n flow config, video-reel Phase 2. Flagged in the header. ✅

**Placeholder scan:** The only intentionally-templated spots are Task 7 Steps 5 & 7, where the admin auth-dependency name and the `test_admin.py` authorization scaffolding must be copied from the existing **run-import** endpoint/test (canonical template in the file). This is deliberate — the exact dependency name is discoverable in `admin.py` and copying the proven pattern is safer than inventing a signature. Everything else is complete code.

**Type consistency:** `store_extraction(db, tender_id, payload: dict)` is called with `payload.model_dump()` (Task 5) and raw dicts (Tasks 2, 6) — both dicts. `get_extraction` decodes `core/key_points/tags/doc_types` consistently everywhere they're read. `sign_zip_token`/`verify_zip_token` signatures match across Tasks 3, 4, 7. `enqueue_extraction(db, tender_id, base_url, client=None)` matches its test and its `extract_all_dces` caller.
