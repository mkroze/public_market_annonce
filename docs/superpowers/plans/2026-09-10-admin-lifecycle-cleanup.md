# Admin Lifecycle Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reversible admin lifecycle cleanup queue so expired active tenders can be found, archived in bulk, audited, and hidden from public/member/alert surfaces.

**Architecture:** Add shared lifecycle helpers for deadline normalization and public visibility, then use them across admin APIs, public APIs, scraper persistence, and DCE cache cleanup. The frontend stays in the existing admin app but adds deadline/retention filters, badges, and a typed-confirmation cleanup action.

**Tech Stack:** FastAPI, aiosqlite, SQLite, unittest/TestClient, React 19, React Router, TypeScript, Vite, Vitest, Testing Library, Tailwind/daisyUI, lucide-react.

## Global Constraints

- No permanent tender deletion in this phase.
- Keep `/admin/imports` as the route, but change visible copy from "Imports" to "Scraping runs".
- Archive must remain reversible through the existing restore workflow.
- Cleanup actions that affect many records require typed confirmation with `ARCHIVE EXPIRED`.
- Archived tenders must be excluded from public/member/alert surfaces by default.
- Unknown or unparseable deadlines must never be auto-archived.
- Preserve manual archives during scraper upserts.
- Use icon plus text for new status badges; do not rely on color alone.
- Do not add new runtime dependencies.
- Do not touch unrelated dirty worktree files.

---

## File Structure

- Create `backend/tender_lifecycle.py`: shared deadline parsing, SQL expressions, and public visibility condition.
- Modify `backend/database.py`: add tender lifecycle columns, indexes, and backfill.
- Modify `backend/admin.py`: admin overview count, tender filtering, lifecycle response fields, archive metadata, cleanup endpoint.
- Modify `backend/main.py`: hide archived tenders from public list, export, detail, filters, stats/directories, favorites, PDF, and DCE access.
- Modify `backend/digest.py`: hide archived tenders from alert previews and digest candidates.
- Modify `backend/dce_cache.py`: use lifecycle helper for outdated cache cleanup.
- Modify `backend/scraper.py`: upsert existing tenders and populate lifecycle metadata.
- Modify backend tests: `backend/test_admin.py`, `backend/test_tender_routes.py`, `backend/test_dce_cache.py`, and a focused scraper test in `backend/test_digest.py` or a new `backend/test_scraper_lifecycle.py`.
- Modify `frontend/src/admin/types.ts`: lifecycle fields and cleanup response type.
- Modify `frontend/src/admin/api.ts`: cleanup endpoint client.
- Modify `frontend/src/admin/permissions.ts`: sidebar copy.
- Modify `frontend/src/admin/pages/Dashboard.tsx`: expired active metric copy and deep link.
- Modify `frontend/src/admin/pages/Imports.tsx`: page title copy.
- Modify `frontend/src/admin/pages/Tenders.tsx`: deadline filter, badges, flag note, cleanup action.
- Modify `frontend/src/admin/components/StatusBadge.tsx`: deadline and retention badges.
- Add frontend tests under `frontend/src/admin/__tests__/` or beside existing page tests if the local pattern is easier to extend.

---

### Task 1: Lifecycle Helper, Schema, And Backfill

**Files:**
- Create: `backend/tender_lifecycle.py`
- Modify: `backend/database.py`
- Test: `backend/test_admin.py`

**Interfaces:**
- Produces: `parse_deadline_date(deadline: str | None) -> str | None`
- Produces: `deadline_date_expr(column: str = "deadline") -> str`
- Produces: `deadline_state_expr(alias: str = "t") -> str`
- Produces: `public_visible_condition(alias: str = "t") -> str`
- Consumes: existing `database.init_db()` migration pattern and `_add_column_if_missing()`

- [ ] **Step 1: Write failing lifecycle helper tests**

Append these tests to `backend/test_admin.py` above `AdminAccessTest`:

```python
class TenderLifecycleHelperTest(unittest.TestCase):
    def test_parse_deadline_date_accepts_date_time(self):
        from tender_lifecycle import parse_deadline_date

        self.assertEqual(parse_deadline_date("31/12/2026 10:30"), "2026-12-31")

    def test_parse_deadline_date_accepts_date_only(self):
        from tender_lifecycle import parse_deadline_date

        self.assertEqual(parse_deadline_date("05/01/2027"), "2027-01-05")

    def test_parse_deadline_date_returns_none_for_unknown(self):
        from tender_lifecycle import parse_deadline_date

        self.assertIsNone(parse_deadline_date(""))
        self.assertIsNone(parse_deadline_date("not a date"))
```

- [ ] **Step 2: Write failing schema/backfill test**

Append this test to `BootstrapTest` or add a new class in `backend/test_admin.py`:

```python
class TenderLifecycleMigrationTest(unittest.TestCase):
    def test_init_db_adds_lifecycle_columns_and_backfills_deadline_date(self):
        run(_reset_db())

        async def seed_without_lifecycle_backfill():
            db = await database.get_db()
            await db.execute(
                "INSERT INTO tenders (id, reference, title, entity, deadline) VALUES (?, ?, ?, ?, ?)",
                ("T-LIFE", "REF-LIFE", "Lifecycle", "Entity", "31/12/2026 10:30"),
            )
            await db.commit()
            await db.close()

        run(seed_without_lifecycle_backfill())
        run(database.init_db())

        async def read_row():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT deadline_date, source_last_seen_at, last_seen_import_id, archived_at, archived_reason "
                "FROM tenders WHERE id = ?",
                ("T-LIFE",),
            )).fetchone()
            await db.close()
            return dict(row)

        row = run(read_row())
        self.assertEqual(row["deadline_date"], "2026-12-31")
        self.assertIn("source_last_seen_at", row)
        self.assertIn("last_seen_import_id", row)
        self.assertIn("archived_at", row)
        self.assertIn("archived_reason", row)
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleHelperTest test_admin.TenderLifecycleMigrationTest
```

Expected: fails because `tender_lifecycle.py` and lifecycle columns do not exist.

- [ ] **Step 4: Create `backend/tender_lifecycle.py`**

Add this file:

```python
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
    return (
        f"CASE WHEN {column} IS NOT NULL AND length({column}) >= 10 "
        f"THEN substr({column}, 7, 4) || '-' || substr({column}, 4, 2) || '-' || substr({column}, 1, 2) "
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
```

- [ ] **Step 5: Add lifecycle migrations and indexes**

In `backend/database.py`, after the existing tender moderation migrations, add:

```python
    # tenders: lifecycle and source freshness metadata
    await _add_column_if_missing(db, "tenders", "deadline_date", "deadline_date TEXT")
    await _add_column_if_missing(db, "tenders", "source_last_seen_at", "source_last_seen_at TEXT")
    await _add_column_if_missing(db, "tenders", "last_seen_import_id", "last_seen_import_id INTEGER")
    await _add_column_if_missing(db, "tenders", "archived_at", "archived_at TEXT")
    await _add_column_if_missing(db, "tenders", "archived_reason", "archived_reason TEXT")

    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_deadline_date ON tenders(deadline_date)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_admin_status ON tenders(admin_status)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_last_seen_import ON tenders(last_seen_import_id)")

    await db.execute(
        """UPDATE tenders
           SET deadline_date = substr(deadline, 7, 4) || '-' || substr(deadline, 4, 2) || '-' || substr(deadline, 1, 2)
           WHERE (deadline_date IS NULL OR deadline_date = '')
             AND deadline IS NOT NULL
             AND length(deadline) >= 10"""
    )
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleHelperTest test_admin.TenderLifecycleMigrationTest
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/tender_lifecycle.py backend/database.py backend/test_admin.py
git commit -m "Add tender lifecycle metadata"
```

---

### Task 2: Admin Lifecycle API And Cleanup Endpoint

**Files:**
- Modify: `backend/admin.py`
- Modify: `backend/test_admin.py`

**Interfaces:**
- Consumes: `deadline_state_expr(alias)`, `public_visible_condition(alias)`, and `deadline_date` columns from Task 1.
- Produces: `POST /api/admin/tenders/cleanup-expired?clear_dce_cache=true|false`
- Produces: admin tender fields `deadline_date`, `deadline_state`, `public_visible`, `source_last_seen_at`, `archived_at`, `archived_reason`
- Produces: updated `failure_queues.stale_records` semantics as expired active count while retaining the existing response key for compatibility.

- [ ] **Step 1: Write failing admin overview and filter tests**

Append tests to `BatchTest` in `backend/test_admin.py`:

```python
    async def _seed_lifecycle_tender(self, tid, deadline, *, admin_status="active", archived_reason=None):
        from tender_lifecycle import parse_deadline_date

        db = await database.get_db()
        await db.execute(
            """INSERT INTO tenders
               (id, reference, title, entity, deadline, deadline_date, admin_status, archived_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tid,
                "REF-" + tid,
                "Title " + tid,
                "Entity",
                deadline,
                parse_deadline_date(deadline),
                admin_status,
                archived_reason,
            ),
        )
        await db.commit()
        await db.close()

    def test_overview_counts_expired_active_tenders(self):
        run(self._seed_lifecycle_tender("OLD-ACTIVE", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("OLD-ARCHIVED", "01/01/2020 10:00", admin_status="archived"))
        run(self._seed_lifecycle_tender("FUTURE", "01/01/2099 10:00"))

        r = self.client.get("/api/admin/overview", headers=self.headers)

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["failure_queues"]["stale_records"], 1)

    def test_admin_tenders_filters_by_deadline_state_and_returns_lifecycle_fields(self):
        run(self._seed_lifecycle_tender("OLD-FILTER", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("FUTURE-FILTER", "01/01/2099 10:00"))

        r = self.client.get(
            "/api/admin/tenders?deadline_state=expired",
            headers=self.headers,
        )

        self.assertEqual(r.status_code, 200)
        ids = [row["id"] for row in r.json()["data"]]
        self.assertIn("OLD-FILTER", ids)
        self.assertNotIn("FUTURE-FILTER", ids)
        first = r.json()["data"][0]
        self.assertIn("deadline_state", first)
        self.assertIn("public_visible", first)
        self.assertIn("archived_at", first)
        self.assertIn("archived_reason", first)
```

- [ ] **Step 2: Write failing cleanup endpoint tests**

Append these tests to `BatchTest`:

```python
    def test_cleanup_expired_archives_only_active_expired_tenders(self):
        run(self._seed_lifecycle_tender("OLD-CLEAN", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("OLD-DONE", "01/01/2020 10:00", admin_status="archived"))
        run(self._seed_lifecycle_tender("FUTURE-CLEAN", "01/01/2099 10:00"))
        run(self._seed_lifecycle_tender("UNKNOWN-CLEAN", ""))

        r = self.client.post(
            "/api/admin/tenders/cleanup-expired?clear_dce_cache=false",
            headers=self.headers,
        )

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["matched"], 1)
        self.assertEqual(r.json()["archived"], 1)

        async def states():
            db = await database.get_db()
            rows = await (await db.execute(
                "SELECT id, admin_status, archived_reason FROM tenders "
                "WHERE id IN ('OLD-CLEAN', 'OLD-DONE', 'FUTURE-CLEAN', 'UNKNOWN-CLEAN')"
            )).fetchall()
            await db.close()
            return {row["id"]: dict(row) for row in rows}

        rows = run(states())
        self.assertEqual(rows["OLD-CLEAN"]["admin_status"], "archived")
        self.assertEqual(rows["OLD-CLEAN"]["archived_reason"], "expired_deadline")
        self.assertEqual(rows["OLD-DONE"]["admin_status"], "archived")
        self.assertEqual(rows["FUTURE-CLEAN"]["admin_status"], "active")
        self.assertEqual(rows["UNKNOWN-CLEAN"]["admin_status"], "active")
        self.assertGreaterEqual(run(_audit_count("tender.cleanup.expired_archive")), 1)

    def test_cleanup_expired_requires_moderation_permission(self):
        auditor = run(_make_user("aud-clean@x.com", role="auditor"))
        r = self.client.post(
            "/api/admin/tenders/cleanup-expired",
            headers=_auth(auditor, "aud-clean@x.com"),
        )

        self.assertEqual(r.status_code, 403)
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_admin.BatchTest
```

Expected: fails because admin deadline filtering and cleanup endpoint do not exist.

- [ ] **Step 4: Update admin overview**

In `backend/admin.py`, import lifecycle helpers near the existing imports:

```python
from tender_lifecycle import deadline_state_expr, public_visible_condition
```

Replace the stale count SQL with:

```python
        stale = await scalar(
            "SELECT COUNT(*) FROM tenders "
            "WHERE COALESCE(admin_status, 'active') != 'archived' "
            "AND COALESCE(deadline_date, '') != '' "
            "AND deadline_date < date('now')"
        )
```

- [ ] **Step 5: Add `deadline_state` admin query parameter and filtering**

In `admin_tenders`, add a parameter after `admin_status`:

```python
    deadline_state: str = Query("", description="'expired', 'open', or 'unknown'"),
```

After the detail filters, add:

```python
        deadline_state_sql = deadline_state_expr("t")
        if deadline_state:
            if deadline_state not in {"expired", "open", "unknown"}:
                raise HTTPException(status_code=422, detail="deadline_state must be expired, open, or unknown")
            conditions.append(f"{deadline_state_sql} = ?")
            params.append(deadline_state)
```

Update the `SELECT` list to include lifecycle fields:

```python
                       CASE WHEN td.tender_id IS NOT NULL THEN 1 ELSE 0 END AS detail_available,
                       {deadline_state_sql} AS deadline_state,
                       CASE WHEN {public_visible_condition("t")} THEN 1 ELSE 0 END AS public_visible
```

- [ ] **Step 6: Update batch archive and restore metadata**

In `admin_tenders_batch`, replace the archive and restore updates with:

```python
                elif req.action == "archive":
                    await db.execute(
                        """UPDATE tenders
                           SET admin_status = 'archived',
                               archived_at = datetime('now'),
                               archived_reason = 'manual'
                           WHERE id = ?""",
                        (tid,),
                    )
                elif req.action == "restore":
                    await db.execute(
                        """UPDATE tenders
                           SET admin_status = 'active',
                               archived_at = NULL,
                               archived_reason = NULL
                           WHERE id = ?""",
                        (tid,),
                    )
```

- [ ] **Step 7: Add cleanup request model and endpoint**

Add below `admin_tenders_batch`:

```python
class CleanupExpiredResponse(BaseModel):
    matched: int
    archived: int
    dce_removed: int = 0
    dce_freed_bytes: int = 0
    dce_error: str | None = None


@router.post("/tenders/cleanup-expired")
async def admin_cleanup_expired_tenders(
    request: Request,
    clear_dce_cache: bool = Query(False),
    user=Depends(require_admin("tenders.moderate")),
):
    db = await get_db()
    dce_removed = 0
    dce_freed = 0
    dce_error = None
    try:
        matched = (await (await db.execute(
            """SELECT COUNT(*) FROM tenders
               WHERE COALESCE(admin_status, 'active') != 'archived'
                 AND COALESCE(deadline_date, '') != ''
                 AND deadline_date < date('now')"""
        )).fetchone())[0]
        cur = await db.execute(
            """UPDATE tenders
               SET admin_status = 'archived',
                   archived_at = datetime('now'),
                   archived_reason = 'expired_deadline'
               WHERE COALESCE(admin_status, 'active') != 'archived'
                 AND COALESCE(deadline_date, '') != ''
                 AND deadline_date < date('now')"""
        )
        archived = cur.rowcount if cur.rowcount is not None else matched
        await db.commit()

        if clear_dce_cache:
            try:
                from dce_cache import clear_dce_cache as clear_cache

                dce_result = await clear_cache(db, mode="outdated")
                dce_removed = int(dce_result.get("removed", 0))
                dce_freed = int(dce_result.get("freed_bytes", 0))
            except Exception as e:  # noqa: BLE001 - return partial cleanup outcome
                dce_error = str(e)[:200]

        await log_audit(
            db,
            actor=user,
            action="tender.cleanup.expired_archive",
            target_type="tender",
            target_id=f"{archived}/{matched}",
            result="partial" if dce_error else "success",
            request=request,
            after={
                "matched": matched,
                "archived": archived,
                "clear_dce_cache": clear_dce_cache,
                "dce_removed": dce_removed,
                "dce_freed_bytes": dce_freed,
                "dce_error": dce_error,
            },
        )
        return CleanupExpiredResponse(
            matched=matched,
            archived=archived,
            dce_removed=dce_removed,
            dce_freed_bytes=dce_freed,
            dce_error=dce_error,
        ).model_dump()
    finally:
        await db.close()
```

- [ ] **Step 8: Run admin tests**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_admin.py
```

Expected: all admin tests pass.

- [ ] **Step 9: Commit**

```bash
git add backend/admin.py backend/test_admin.py
git commit -m "Add admin expired tender cleanup"
```

---

### Task 3: Public Visibility For Archived Tenders

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/digest.py`
- Modify: `backend/test_tender_routes.py`
- Modify: `backend/test_digest.py`

**Interfaces:**
- Consumes: `public_visible_condition(alias)` from Task 1.
- Produces: archived tenders hidden from public list, export, detail, stats/filter sources, favorites list, favorite ID list, add favorite, PDF, DCE, alert previews, and digest candidates.

- [ ] **Step 1: Write failing route tests for archived visibility**

Add tests to `backend/test_tender_routes.py` using the existing TestClient/fake DB style where possible. If this file mostly mocks `get_db`, add these database-backed tests near the end:

```python
class ArchivedTenderVisibilityTest(unittest.TestCase):
    def setUp(self):
        import os
        import tempfile
        import config
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        run(database.init_db())
        self.client = TestClient(main.app)

    def tearDown(self):
        import os

        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    async def _seed_tender(self, tid, admin_status="active"):
        import database

        db = await database.get_db()
        await db.execute(
            """INSERT INTO tenders
               (id, reference, title, entity, deadline, deadline_date, admin_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (tid, "REF-" + tid, "Title " + tid, "Entity", "01/01/2099 10:00", "2099-01-01", admin_status),
        )
        await db.commit()
        await db.close()

    def test_public_list_excludes_archived_tenders(self):
        run(self._seed_tender("VISIBLE", "active"))
        run(self._seed_tender("HIDDEN", "archived"))

        r = self.client.get("/api/tenders")

        self.assertEqual(r.status_code, 200)
        ids = [row["id"] for row in r.json()["data"]]
        self.assertIn("VISIBLE", ids)
        self.assertNotIn("HIDDEN", ids)

    def test_public_detail_returns_404_for_archived_tender(self):
        run(self._seed_tender("HIDDEN-DETAIL", "archived"))

        r = self.client.get("/api/tenders/HIDDEN-DETAIL")

        self.assertEqual(r.status_code, 404)
```

- [ ] **Step 2: Add failing digest visibility test**

Append this test to the digest test class that covers `open_matches_for_alert`:

```python
    def test_open_matches_excludes_archived_tenders(self):
        async def scenario():
            db = await database.get_db()
            await db.execute(
                """INSERT INTO tenders
                   (id, reference, title, entity, sector_code, deadline, deadline_date, status, admin_status)
                   VALUES
                   ('VISIBLE-DIGEST', 'R1', 'Visible', 'Entity', '1.1', '01/01/2099 10:00', '2099-01-01', 'en_cours', 'active'),
                   ('HIDDEN-DIGEST', 'R2', 'Hidden', 'Entity', '1.1', '01/01/2099 10:00', '2099-01-01', 'en_cours', 'archived')"""
            )
            await db.commit()
            rows = await digest.open_matches_for_alert(db, {"sectors": "1.1"}, limit=None)
            await db.close()
            return [row["id"] for row in rows]

        ids = run(scenario())
        self.assertIn("VISIBLE-DIGEST", ids)
        self.assertNotIn("HIDDEN-DIGEST", ids)
```

- [ ] **Step 3: Run route/digest tests to verify failure**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_tender_routes.py test_digest.py
```

Expected: archived records still appear or archived detail returns 200.

- [ ] **Step 4: Import and apply public visibility condition in `backend/main.py`**

Add import:

```python
from tender_lifecycle import public_visible_condition
```

In `list_tenders`, initialize conditions with:

```python
    conditions = [public_visible_condition("t")]
```

Build `where_prefixed` directly from prefixed conditions instead of string replacement. Use:

```python
    where_prefixed = f"WHERE {' AND '.join(conditions)}"
```

When appending conditions in `list_tenders`, prefix columns with `t.`:

```python
        conditions.append("(t.title LIKE ? OR t.reference LIKE ? OR t.entity LIKE ?)")
        conditions.append("t.category = ?")
        conditions.append("t.sector_code = ?")
        conditions.append("t.entity LIKE ?")
        conditions.append("t.location LIKE ?")
        conditions.append("t.status = ?")
        conditions.append("t.procedure_type = ?")
```

In `export_tenders`, initialize:

```python
    conditions = [public_visible_condition()]
```

Keep unaliased conditions there because the query uses `FROM tenders` without alias.

In `get_tender`, replace:

```python
    cursor = await db.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,))
```

with:

```python
    cursor = await db.execute(
        f"SELECT * FROM tenders t WHERE t.id = ? AND {public_visible_condition('t')}",
        (tender_id,),
    )
```

In `export_tender_pdf`, use the same `SELECT * FROM tenders t WHERE t.id = ? AND ...` query.

In `download_tender_dce`, join tenders before reading the detail URL:

```python
    det_cursor = await db.execute(
        f"""SELECT td.dce_url FROM tender_details td
            JOIN tenders t ON t.id = td.tender_id
            WHERE td.tender_id = ? AND {public_visible_condition('t')}""",
        (tender_id,),
    )
```

In `list_favorites`, add `AND {public_visible_condition('t')}` to the `WHERE`.

In `list_favorite_ids`, join tenders and filter visible IDs:

```python
        f"""SELECT f.tender_id FROM favorites f
            JOIN tenders t ON t.id = f.tender_id
            WHERE f.user_id = ? AND {public_visible_condition('t')}""",
```

In `add_favorite`, first check the target tender exists and is public-visible:

```python
        visible = await (await db.execute(
            f"SELECT id FROM tenders t WHERE t.id = ? AND {public_visible_condition('t')}",
            (tender_id,),
        )).fetchone()
        if not visible:
            raise HTTPException(status_code=404, detail="Tender not found")
```

- [ ] **Step 5: Apply public visibility to stats and filter queries**

For count/group queries in `stats()`, `get_filters()`, city/region helpers, sector detail, and directory endpoints that query `tenders`, add `WHERE {public_visible_condition()}` for unaliased queries or `WHERE {public_visible_condition('t')}` for aliased queries. When a query already has a `WHERE`, append `AND ...`.

Use this exact pattern for unaliased grouped queries:

```python
visible = public_visible_condition()
await db.execute(f"SELECT COUNT(*) FROM tenders WHERE {visible}")
```

Use this exact pattern for aliased grouped queries:

```python
visible_t = public_visible_condition("t")
await db.execute(f"SELECT t.category, COUNT(*) as count FROM tenders t WHERE {visible_t} GROUP BY t.category")
```

- [ ] **Step 6: Apply public visibility in `backend/digest.py`**

Import:

```python
from tender_lifecycle import public_visible_condition
```

In `open_matches_for_alert`, replace the `WHERE` with:

```python
           WHERE t.status = 'en_cours'
             AND {public_visible_condition('t')}"""
```

In the digest query around `backend/digest.py:327`, add the same public visibility condition alongside the existing new-tender/status filters.

- [ ] **Step 7: Run tests**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_tender_routes.py test_digest.py
```

Expected: route and digest tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/main.py backend/digest.py backend/test_tender_routes.py backend/test_digest.py
git commit -m "Hide archived tenders from public surfaces"
```

---

### Task 4: Scraper Upsert And Lifecycle Reconciliation

**Files:**
- Modify: `backend/scraper.py`
- Test: `backend/test_scraper_lifecycle.py`

**Interfaces:**
- Consumes: `parse_deadline_date(deadline)` from Task 1.
- Produces: scrape upsert behavior that updates existing tenders, sets lifecycle metadata, preserves manual archives, and restores expired-deadline archives only when a future deadline reappears.

- [ ] **Step 1: Create failing scraper lifecycle tests**

Create `backend/test_scraper_lifecycle.py`:

```python
import asyncio
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import config
import database
import scraper


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class ScraperLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        run(database.init_db())

    def tearDown(self):
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    async def _row(self, tid):
        db = await database.get_db()
        row = await (await db.execute("SELECT * FROM tenders WHERE id = ?", (tid,))).fetchone()
        await db.close()
        return dict(row)

    def test_rescrape_updates_existing_tender_and_counts_updated(self):
        first = {
            "id": "UP-1",
            "reference": "REF-UP",
            "title": "Old title",
            "entity": "Entity",
            "entity_code": "E",
            "sector_code": "1.1",
            "sector_name": "Sector",
            "category": "Travaux",
            "deadline": "01/01/2099 10:00",
            "publication_date": "01/01/2026",
            "status": "en_cours",
            "procedure_type": "AOO",
            "location": "Rabat",
            "detail_url": "https://example.test/old",
        }
        second = {**first, "title": "New title", "deadline": "02/01/2099 10:00"}

        with patch.object(scraper, "SECTORS", {"1.1": "Sector"}), patch.object(
            scraper, "scrape_sector", AsyncMock(side_effect=[[first], [second]])
        ):
            one = run(scraper.scrape_all_sectors())
            two = run(scraper.scrape_all_sectors())

        row = run(self._row("UP-1"))
        self.assertEqual(one["total_new"], 1)
        self.assertEqual(two["total_new"], 0)
        self.assertEqual(two["total_updated"], 1)
        self.assertEqual(row["title"], "New title")
        self.assertEqual(row["deadline_date"], "2099-01-02")
        self.assertIsNotNone(row["source_last_seen_at"])
        self.assertIsNotNone(row["last_seen_import_id"])

    def test_scraper_preserves_manual_archive(self):
        tender = {
            "id": "MANUAL-ARCHIVE",
            "reference": "REF-M",
            "title": "Manual archive",
            "entity": "Entity",
            "entity_code": "E",
            "sector_code": "1.1",
            "sector_name": "Sector",
            "category": "Travaux",
            "deadline": "01/01/2099 10:00",
            "publication_date": "01/01/2026",
            "status": "en_cours",
            "procedure_type": "AOO",
            "location": "Rabat",
            "detail_url": "https://example.test/manual",
        }

        async def seed_manual_archive():
            db = await database.get_db()
            await db.execute(
                """INSERT INTO tenders
                   (id, reference, title, entity, admin_status, archived_reason)
                   VALUES ('MANUAL-ARCHIVE', 'REF-M', 'Old', 'Entity', 'archived', 'manual')"""
            )
            await db.commit()
            await db.close()

        run(seed_manual_archive())
        with patch.object(scraper, "SECTORS", {"1.1": "Sector"}), patch.object(
            scraper, "scrape_sector", AsyncMock(return_value=[tender])
        ):
            run(scraper.scrape_all_sectors())

        row = run(self._row("MANUAL-ARCHIVE"))
        self.assertEqual(row["admin_status"], "archived")
        self.assertEqual(row["archived_reason"], "manual")

    def test_scraper_restores_expired_archive_when_future_deadline_reappears(self):
        tender = {
            "id": "AUTO-RESTORE",
            "reference": "REF-A",
            "title": "Auto restore",
            "entity": "Entity",
            "entity_code": "E",
            "sector_code": "1.1",
            "sector_name": "Sector",
            "category": "Travaux",
            "deadline": "01/01/2099 10:00",
            "publication_date": "01/01/2026",
            "status": "en_cours",
            "procedure_type": "AOO",
            "location": "Rabat",
            "detail_url": "https://example.test/auto",
        }

        async def seed_expired_archive():
            db = await database.get_db()
            await db.execute(
                """INSERT INTO tenders
                   (id, reference, title, entity, deadline_date, admin_status, archived_reason)
                   VALUES ('AUTO-RESTORE', 'REF-A', 'Old', 'Entity', '2020-01-01', 'archived', 'expired_deadline')"""
            )
            await db.commit()
            await db.close()

        run(seed_expired_archive())
        with patch.object(scraper, "SECTORS", {"1.1": "Sector"}), patch.object(
            scraper, "scrape_sector", AsyncMock(return_value=[tender])
        ):
            run(scraper.scrape_all_sectors())

        row = run(self._row("AUTO-RESTORE"))
        self.assertEqual(row["admin_status"], "active")
        self.assertIsNone(row["archived_reason"])
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_scraper_lifecycle.py
```

Expected: fails because scraper still uses `INSERT OR IGNORE` and does not return `total_updated`.

- [ ] **Step 3: Import lifecycle helper**

In `backend/scraper.py`, add:

```python
from tender_lifecycle import parse_deadline_date
```

- [ ] **Step 4: Replace insert-only persistence with upsert**

In `scrape_all_sectors`, initialize:

```python
    total_updated = 0
    total_skipped = 0
```

After creating the `scrape_log` row, keep `log_id = log_cursor.lastrowid` and use it for tender metadata.

Inside the tender loop, replace the `INSERT OR IGNORE` block with:

```python
                deadline_date = parse_deadline_date(t.get("deadline"))
                existing = await (await db.execute(
                    "SELECT id, admin_status, archived_reason FROM tenders WHERE id = ?",
                    (t["id"],),
                )).fetchone()
                if existing:
                    restore_auto_archive = (
                        existing["admin_status"] == "archived"
                        and existing["archived_reason"] == "expired_deadline"
                        and deadline_date is not None
                        and deadline_date >= datetime.utcnow().strftime("%Y-%m-%d")
                    )
                    await db.execute(
                        """UPDATE tenders
                           SET reference = ?, title = ?, entity = ?, entity_code = ?,
                               sector_code = ?, sector_name = ?, category = ?, deadline = ?,
                               deadline_date = ?, publication_date = ?, status = ?,
                               procedure_type = ?, location = ?, detail_url = ?,
                               source_last_seen_at = datetime('now'),
                               last_seen_import_id = ?,
                               admin_status = CASE WHEN ? THEN 'active' ELSE admin_status END,
                               archived_at = CASE WHEN ? THEN NULL ELSE archived_at END,
                               archived_reason = CASE WHEN ? THEN NULL ELSE archived_reason END
                           WHERE id = ?""",
                        (
                            t["reference"], t["title"], t["entity"], t["entity_code"],
                            t["sector_code"], t["sector_name"], t["category"], t["deadline"],
                            deadline_date, t["publication_date"], t["status"],
                            t["procedure_type"], t["location"], t["detail_url"],
                            log_id, restore_auto_archive, restore_auto_archive,
                            restore_auto_archive, t["id"],
                        ),
                    )
                    total_updated += 1
                else:
                    await db.execute(
                        """INSERT INTO tenders
                           (id, reference, title, entity, entity_code, sector_code,
                            sector_name, category, deadline, deadline_date, publication_date,
                            status, procedure_type, location, detail_url, source_last_seen_at,
                            last_seen_import_id)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)""",
                        (
                            t["id"], t["reference"], t["title"], t["entity"],
                            t["entity_code"], t["sector_code"], t["sector_name"],
                            t["category"], t["deadline"], deadline_date,
                            t["publication_date"], t["status"], t["procedure_type"],
                            t["location"], t["detail_url"], log_id,
                        ),
                    )
                    total_new += 1
                    new_ids.append(t["id"])
```

Also import `datetime` at the top:

```python
from datetime import datetime
```

- [ ] **Step 5: Persist updated/skipped counts**

Update the final scrape log query:

```python
        """UPDATE scrape_log
           SET finished_at = datetime('now'),
               tenders_found = ?,
               tenders_new = ?,
               tenders_updated = ?,
               tenders_skipped = ?,
               status = 'done'
           WHERE id = ?""",
        (total_found, total_new, total_updated, total_skipped, log_id),
```

Update the return object:

```python
    return {
        "total_found": total_found,
        "total_new": total_new,
        "total_updated": total_updated,
        "total_skipped": total_skipped,
        "new_ids": new_ids,
    }
```

- [ ] **Step 6: Run scraper lifecycle tests**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_scraper_lifecycle.py
```

Expected: all scraper lifecycle tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/scraper.py backend/test_scraper_lifecycle.py
git commit -m "Upsert scraped tenders with lifecycle state"
```

---

### Task 5: DCE Cache Outdated Cleanup Uses Lifecycle Metadata

**Files:**
- Modify: `backend/dce_cache.py`
- Modify: `backend/test_dce_cache.py`

**Interfaces:**
- Consumes: `public_visible_condition(alias)` and `deadline_date` lifecycle column from Task 1.
- Produces: `clear_dce_cache(mode="outdated")` that treats archived, expired, and removed tenders as outdated using normalized `deadline_date`.

- [ ] **Step 1: Update failing DCE cache test to use `deadline_date`**

In `backend/test_dce_cache.py`, update the outdated cleanup test seed from raw deadline-only rows to:

```python
        await self.db.execute(
            "INSERT INTO tenders (id, deadline, deadline_date, admin_status) VALUES ('T1', '01/01/2099 10:00', '2099-01-01', 'active')"
        )
        await self.db.execute(
            "INSERT INTO tenders (id, deadline, deadline_date, admin_status) VALUES ('T2', '01/01/2020 10:00', '2020-01-01', 'active')"
        )
        await self.db.execute(
            "INSERT INTO tenders (id, deadline, deadline_date, admin_status) VALUES ('T3', '01/01/2099 10:00', '2099-01-01', 'archived')"
        )
```

Store cache rows for `T1`, `T2`, and `T3`, then assert `T1` remains while `T2` and `T3` are removed:

```python
        self.assertIsNotNone(await dce_cache.get_cached(self.db, "T1"))
        self.assertIsNone(await dce_cache.get_cached(self.db, "T2"))
        self.assertIsNone(await dce_cache.get_cached(self.db, "T3"))
```

- [ ] **Step 2: Run DCE cache tests to verify failure**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_dce_cache.py
```

Expected: fails if the test database lacks `deadline_date` in its manual schema or the query still depends on raw substrings.

- [ ] **Step 3: Update manual test schema**

Where `backend/test_dce_cache.py` creates a manual `tenders` table, change:

```sql
CREATE TABLE tenders (id TEXT PRIMARY KEY, deadline TEXT, admin_status TEXT)
```

to:

```sql
CREATE TABLE tenders (id TEXT PRIMARY KEY, deadline TEXT, deadline_date TEXT, admin_status TEXT)
```

- [ ] **Step 4: Update `backend/dce_cache.py` outdated query**

Replace `_STALE_TENDER_IDS` with:

```python
_STALE_TENDER_IDS = """
    SELECT tender_id FROM dce_cache WHERE tender_id NOT IN (
        SELECT id FROM tenders
        WHERE COALESCE(admin_status, 'active') != 'archived'
          AND (deadline_date IS NULL OR deadline_date = '' OR deadline_date >= date('now'))
    )
"""
```

- [ ] **Step 5: Run DCE cache tests**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_dce_cache.py
```

Expected: all DCE cache tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/dce_cache.py backend/test_dce_cache.py
git commit -m "Use lifecycle metadata for DCE cleanup"
```

---

### Task 6: Admin Frontend Lifecycle UI

**Files:**
- Modify: `frontend/src/admin/types.ts`
- Modify: `frontend/src/admin/api.ts`
- Modify: `frontend/src/admin/permissions.ts`
- Modify: `frontend/src/admin/pages/Dashboard.tsx`
- Modify: `frontend/src/admin/pages/Imports.tsx`
- Modify: `frontend/src/admin/pages/Tenders.tsx`
- Modify: `frontend/src/admin/components/StatusBadge.tsx`
- Modify: `frontend/src/admin/components/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: lifecycle fields and cleanup endpoint from Task 2.
- Produces: deadline-state filter, deadline/retention badges, dashboard expired-active deep link, flag note submission, and typed-confirmation archive-expired action.

- [ ] **Step 1: Add frontend tests for dashboard link and cleanup dialog**

Create `frontend/src/admin/__tests__/admin-lifecycle.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import AdminTenders from "../pages/Tenders";
import * as api from "../api";

vi.mock("../api");
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "owner@test", role: "owner", status: "active" },
    token: "test-token",
    logout: vi.fn(),
    loading: false,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderWithRouter(ui: React.ReactElement, initialEntries = ["/admin"]) {
  localStorage.setItem("token", "test-token");
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      {ui}
    </MemoryRouter>,
  );
}

describe("admin lifecycle cleanup UI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("links the dashboard expired active metric to the expired active tender queue", async () => {
    vi.mocked(api.getOverview).mockResolvedValue({
      last_import: null,
      freshness: {
        tender_count: 10,
        detail_count: 8,
        detail_coverage_pct: 80,
        last_scraped_at: null,
        last_successful_import_at: null,
        source: "marchespublics.gov.ma",
      },
      failure_queues: {
        failed_imports: 0,
        missing_details: 0,
        flagged_tenders: 0,
        archived_tenders: 0,
        stale_records: 3,
      },
      governance: [],
      health: { database: "ok", scraper_source: "unknown", scraper_last_attempt_at: null },
    });

    renderWithRouter(<Dashboard />);

    const button = await screen.findByRole("button", { name: /expired active/i });
    fireEvent.click(button);
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/tenders?deadline_state=expired&admin_status=active");
  });

  it("requires typed confirmation before archiving expired tenders", async () => {
    vi.mocked(api.getAdminTenders).mockResolvedValue({
      total: 1,
      page: 1,
      per_page: 25,
      pages: 1,
      data: [{
        id: "T1",
        reference: "REF-T1",
        title: "Expired tender",
        entity: "Entity",
        sector_code: "1.1",
        sector_name: "Sector",
        category: "Travaux",
        deadline: "01/01/2020 10:00",
        deadline_date: "2020-01-01",
        deadline_state: "expired",
        publication_date: "01/01/2020",
        status: "en_cours",
        procedure_type: "AOO",
        location: "Rabat",
        scraped_at: "2026-09-10 10:00:00",
        admin_status: "active",
        review_status: "unreviewed",
        flag_note: null,
        detail_available: 0,
        estimation: null,
        public_visible: 1,
        source_last_seen_at: null,
        archived_at: null,
        archived_reason: null,
      }],
    });
    vi.mocked(api.cleanupExpiredTenders).mockResolvedValue({
      matched: 1,
      archived: 1,
      dce_removed: 0,
      dce_freed_bytes: 0,
      dce_error: null,
    });

    renderWithRouter(<AdminTenders />, ["/admin/tenders?deadline_state=expired&admin_status=active"]);

    fireEvent.click(await screen.findByRole("button", { name: /archive expired active/i }));
    const confirm = screen.getByRole("button", { name: /archive expired/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type to confirm/i), { target: { value: "ARCHIVE EXPIRED" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(api.cleanupExpiredTenders).toHaveBeenCalledWith({ clear_dce_cache: expect.any(Boolean) });
    });
  });
});
```

- [ ] **Step 2: Run frontend tests to verify failure**

Run:

```bash
cd frontend && npm test -- --run frontend/src/admin/__tests__/admin-lifecycle.test.tsx
```

Expected: fails because UI/types/API do not exist yet.

- [ ] **Step 3: Update frontend types**

In `frontend/src/admin/types.ts`, extend `AdminTender`:

```ts
  deadline_date: string | null;
  deadline_state: "expired" | "open" | "unknown";
  public_visible: number;
  source_last_seen_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
```

Add:

```ts
export interface CleanupExpiredResult {
  matched: number;
  archived: number;
  dce_removed: number;
  dce_freed_bytes: number;
  dce_error: string | null;
}
```

- [ ] **Step 4: Update admin API client**

In `frontend/src/admin/api.ts`, import `CleanupExpiredResult` and add:

```ts
export const cleanupExpiredTenders = (body: { clear_dce_cache: boolean }) =>
  request<CleanupExpiredResult>("/tenders/cleanup-expired", {
    method: "POST",
    params: { clear_dce_cache: body.clear_dce_cache ? "true" : "false" },
  });
```

- [ ] **Step 5: Add status badges**

In `frontend/src/admin/components/StatusBadge.tsx`, import `EyeOff` and add:

```tsx
export function DeadlineStateBadge({ state }: { state: "expired" | "open" | "unknown" | string }) {
  switch (state) {
    case "expired":
      return <Badge tone="warning" icon={<AlertTriangle className={ICON} aria-hidden />}>Expired</Badge>;
    case "open":
      return <Badge tone="success" icon={<Clock className={ICON} aria-hidden />}>Open</Badge>;
    default:
      return <Badge tone="neutral" icon={<Minus className={ICON} aria-hidden />}>Unknown</Badge>;
  }
}

export function RetentionBadge({ status, reason }: { status: string; reason?: string | null }) {
  if (status === "archived" && reason === "expired_deadline") {
    return <Badge tone="warning" icon={<Archive className={ICON} aria-hidden />}>Expired archive</Badge>;
  }
  if (status === "archived") {
    return <Badge tone="warning" icon={<Archive className={ICON} aria-hidden />}>Manual archive</Badge>;
  }
  return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Retained</Badge>;
}

export function PublicVisibilityBadge({ visible }: { visible: boolean }) {
  return visible
    ? <Badge tone="success" icon={<Eye className={ICON} aria-hidden />}>Public</Badge>
    : <Badge tone="neutral" icon={<EyeOff className={ICON} aria-hidden />}>Hidden</Badge>;
}
```

- [ ] **Step 6: Let confirmation dialogs render an extra control block**

In `frontend/src/admin/components/ConfirmDialog.tsx`, extend `ConfirmConfig`:

```ts
  extra?: ReactNode;
```

Render it after the typed-confirmation input block:

```tsx
        {config.extra && (
          <div className="mt-4">
            {config.extra}
          </div>
        )}
```

- [ ] **Step 7: Update navigation and scraping page copy**

In `frontend/src/admin/permissions.ts`, change the nav label:

```ts
  { label: "Scraping runs", path: "/admin/imports", icon: "DownloadCloud", permission: "imports.view" },
```

In `frontend/src/admin/pages/Imports.tsx`, change the `PageHeader` title:

```tsx
        title="Scraping runs"
        description="Trigger scrapes, cache DCE documents, monitor progress, and inspect run history."
```

- [ ] **Step 8: Update dashboard expired metric**

In `frontend/src/admin/pages/Dashboard.tsx`, replace the stale metric card with:

```tsx
        <MetricCard
          label="Expired active"
          value={q.stale_records}
          tone={q.stale_records ? "warning" : "neutral"}
          onClick={() => navigate("/admin/tenders?deadline_state=expired&admin_status=active")}
          sub="Archive or restore"
        />
```

- [ ] **Step 9: Update admin tenders filters and actions**

In `frontend/src/admin/pages/Tenders.tsx`:

Add imports:

```tsx
import { cleanupExpiredTenders } from "../api";
import { DeadlineStateBadge, PublicVisibilityBadge, RetentionBadge } from "../components/StatusBadge";
```

Add `deadline_state` to `FILTER_KEYS`:

```ts
const FILTER_KEYS = ["q", "category", "sector", "status", "review_status", "admin_status", "deadline_state", "detail", "sort", "order"];
```

Add cleanup runner:

```tsx
  async function runExpiredCleanup(clearDceCache: boolean) {
    try {
      const res = await cleanupExpiredTenders({ clear_dce_cache: clearDceCache });
      if (res.dce_error) {
        push(`${res.archived} expired tender(s) archived. DCE cleanup failed: ${res.dce_error}`, "info", 8000);
      } else if (res.archived === 0) {
        push("No expired active tenders to archive", "info");
      } else {
        push(`${res.archived} expired tender(s) archived`, "success");
      }
      load();
    } catch (e) {
      push(e instanceof ApiError ? e.message : "Expired cleanup failed", "error");
    }
  }
```

Add cleanup confirmation:

```tsx
  function confirmExpiredCleanup() {
    let clearCache = true;
    setConfirm({
      title: "Archive expired active tenders",
      action: "Archive expired active",
      target: "All active tenders with a past deadline",
      consequence: "Moves expired active tenders out of public/member/alert surfaces. They can be restored later.",
      reversible: true,
      confirmLabel: "Archive expired",
      typedConfirmation: "ARCHIVE EXPIRED",
      danger: true,
      extra: (
        <label className="flex items-start gap-2 text-sm font-sans text-[var(--color-charcoal)]">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            defaultChecked
            onChange={(e) => {
              clearCache = e.target.checked;
            }}
          />
          <span>Clear outdated cached DCE files for archived or expired tenders</span>
        </label>
      ),
      onConfirm: () => runExpiredCleanup(clearCache),
    });
  }
```

Add a page-level action in `PageHeader`:

```tsx
        actions={
          <button
            onClick={confirmExpiredCleanup}
            disabled={!canModerate}
            title={!canModerate ? "Requires tenders.moderate permission" : undefined}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-sans font-semibold rounded-lg text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Archive className="w-4 h-4" aria-hidden /> Archive expired active
          </button>
        }
```

Add deadline filter select:

```tsx
        <select aria-label="Deadline state" className={`select select-bordered select-sm ${inputCls}`} value={params.get("deadline_state") || ""} onChange={(e) => setFilter("deadline_state", e.target.value)}>
          <option value="">Any deadline</option>
          <option value="expired">Expired</option>
          <option value="open">Open</option>
          <option value="unknown">Unknown</option>
        </select>
```

Update the deadline cell:

```tsx
                    <td className="px-3 py-2 tabular-nums">
                      <div>{fmtDateOnly(t.deadline)}</div>
                      <div className="mt-1"><DeadlineStateBadge state={t.deadline_state} /></div>
                    </td>
```

Add compact visibility/retention display in the state cell:

```tsx
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <AdminStatusBadge status={t.admin_status} />
                        <RetentionBadge status={t.admin_status} reason={t.archived_reason} />
                        <PublicVisibilityBadge visible={!!t.public_visible} />
                      </div>
                    </td>
```

- [ ] **Step 10: Add flag note path**

In `confirmBatch`, use a typed prompt for flagging. Replace the flag button call with a dedicated function:

```tsx
  function confirmFlagBatch() {
    const ids = [...selected];
    let note = "";
    setConfirm({
      title: "Flag data issue",
      action: "Flag data issue",
      target: `${ids.length} tender${ids.length !== 1 ? "s" : ""}`,
      consequence: "Flags the selected tenders for a data-quality issue and stores the note with the records.",
      reversible: true,
      confirmLabel: "Flag issue",
      extra: (
        <label className="block text-sm font-sans text-[var(--color-slate)]">
          Note
          <textarea
            className="mt-1 w-full textarea textarea-bordered font-sans bg-base-100 border-[var(--color-border-subtle)] rounded"
            rows={3}
            onChange={(e) => { note = e.target.value; }}
          />
        </label>
      ),
      onConfirm: () => runBatch("flag", ids, note),
    });
  }
```

Change the flag button to:

```tsx
            <BatchBtn allowed={canModerate} onClick={confirmFlagBatch} icon={<Flag className="w-3.5 h-3.5" aria-hidden />} label="Flag issue" />
```

- [ ] **Step 11: Run frontend tests**

Run:

```bash
cd frontend && npm test -- --run frontend/src/admin/__tests__/admin-lifecycle.test.tsx
```

Expected: lifecycle UI tests pass.

- [ ] **Step 12: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/admin/types.ts frontend/src/admin/api.ts frontend/src/admin/permissions.ts frontend/src/admin/pages/Dashboard.tsx frontend/src/admin/pages/Imports.tsx frontend/src/admin/pages/Tenders.tsx frontend/src/admin/components/StatusBadge.tsx frontend/src/admin/components/ConfirmDialog.tsx frontend/src/admin/__tests__/admin-lifecycle.test.tsx
git commit -m "Add admin expired cleanup UI"
```

---

### Task 7: Full Regression And Integration Review

**Files:**
- Modify: files from prior tasks only when verification exposes a defect.
- Test: backend and frontend test suites.

**Interfaces:**
- Consumes: all outputs from Tasks 1-6.
- Produces: verified working lifecycle cleanup feature.

- [ ] **Step 1: Run targeted backend regression**

Run:

```bash
cd backend && .venv/bin/python -m unittest test_admin.py test_tender_routes.py test_dce_cache.py test_scraper_lifecycle.py
```

Expected: all targeted backend tests pass.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
cd backend && .venv/bin/python -m unittest
```

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend unit tests**

Run:

```bash
cd frontend && npm test -- --run
```

Expected: all frontend tests pass.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 5: Review changed SQL for archived visibility coverage**

Run:

```bash
rg -n "FROM tenders|JOIN tenders|SELECT .*tenders" backend/main.py backend/digest.py backend/admin.py backend/dce_cache.py
```

Expected: every public/member/alert query that returns or counts public tenders includes `public_visible_condition(...)`, while admin queries intentionally keep archived tenders visible.

- [ ] **Step 6: Check git diff for unrelated changes**

Run:

```bash
git status --short
git diff --stat
```

Expected: only lifecycle cleanup files changed by these tasks are in the final diff, plus pre-existing unrelated dirty files that were already present before implementation.

- [ ] **Step 7: Commit verification fixes only when needed**

If Step 1-6 required code changes, commit those fixes:

```bash
git add backend frontend
git commit -m "Stabilize admin lifecycle cleanup"
```

If Step 1-6 passed without additional code changes, do not create an empty commit.

---

## Completion Criteria

- Expired active tenders are counted correctly using normalized dates.
- Admin tenders can be filtered by expired/open/unknown deadline state.
- Operators can archive all expired active tenders with typed confirmation.
- Cleanup writes an audit event and optionally clears outdated DCE cache.
- Manual archive/restore records archive metadata correctly.
- Scraper upserts refresh existing tenders and preserves manual archives.
- Archived tenders are hidden from public/member/alert surfaces.
- Frontend build and backend targeted tests pass.
- Permanent purge remains unavailable and documented as a separate phase.
