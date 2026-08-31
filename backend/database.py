import aiosqlite
import os
from config import DB_PATH

async def get_db() -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db

async def _add_column_if_missing(db, table: str, column: str, ddl: str):
    """Idempotently add a column to an existing table (CREATE IF NOT EXISTS
    never alters an already-created table, so migrations need this)."""
    cursor = await db.execute(f"PRAGMA table_info({table})")
    existing = {row["name"] for row in await cursor.fetchall()}
    if column not in existing:
        await db.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS tenders (
            id TEXT PRIMARY KEY,
            reference TEXT,
            title TEXT,
            entity TEXT,
            entity_code TEXT,
            sector_code TEXT,
            sector_name TEXT,
            category TEXT,
            deadline TEXT,
            publication_date TEXT,
            status TEXT,
            procedure_type TEXT,
            location TEXT DEFAULT '',
            detail_url TEXT,
            scraped_at TEXT DEFAULT (datetime('now')),
            UNIQUE(reference, entity_code)
        );

        CREATE INDEX IF NOT EXISTS idx_tenders_location ON tenders(location);

        CREATE TABLE IF NOT EXISTS tender_details (
            tender_id TEXT PRIMARY KEY REFERENCES tenders(id),
            objet TEXT,
            acheteur TEXT,
            annonce_type TEXT,
            procedure TEXT,
            categorie TEXT,
            allotissement TEXT,
            lieu_execution TEXT,
            estimation TEXT,
            domaines TEXT,
            adresse_retrait TEXT,
            adresse_depot TEXT,
            lieu_ouverture TEXT,
            caution_provisoire TEXT,
            qualifications TEXT,
            agrements TEXT,
            variante TEXT,
            reunion TEXT,
            visite_lieux TEXT,
            contact TEXT,
            documents_url TEXT,
            dce_url TEXT,
            avis_url TEXT,
            reserved_pme TEXT,
            prix_plans TEXT,
            scraped_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT DEFAULT (datetime('now')),
            finished_at TEXT,
            tenders_found INTEGER DEFAULT 0,
            tenders_new INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',
            error TEXT
        );

        -- Metadata for DCE ZIPs cached on disk (one row per tender).
        CREATE TABLE IF NOT EXISTS dce_cache (
            tender_id TEXT PRIMARY KEY REFERENCES tenders(id),
            filename TEXT,
            size INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ok',   -- 'ok' | 'failed'
            error TEXT,
            cached_at TEXT DEFAULT (datetime('now'))
        );

        -- History of admin "download all DCEs" warm-cache runs.
        CREATE TABLE IF NOT EXISTS dce_cache_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT DEFAULT (datetime('now')),
            finished_at TEXT,
            total INTEGER DEFAULT 0,
            cached INTEGER DEFAULT 0,
            skipped INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',  -- running | done | failed | stopped
            error TEXT,
            actor_email TEXT,
            concurrency INTEGER,            -- threads the run is currently at
            pauses INTEGER DEFAULT 0        -- times it flagged + backed off
        );

        CREATE INDEX IF NOT EXISTS idx_tenders_sector ON tenders(sector_code);
        CREATE INDEX IF NOT EXISTS idx_tenders_category ON tenders(category);
        CREATE INDEX IF NOT EXISTS idx_tenders_entity ON tenders(entity);
        CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders(deadline);
        CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);

        -- User accounts
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            company TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            plan TEXT DEFAULT 'free',
            created_at TEXT DEFAULT (datetime('now'))
        );

        -- Saved/favorite tenders
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            tender_id TEXT NOT NULL REFERENCES tenders(id),
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, tender_id)
        );
        CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

        -- Alert preferences
        CREATE TABLE IF NOT EXISTS alert_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT DEFAULT 'Mon alerte',
            sectors TEXT DEFAULT '',
            regions TEXT DEFAULT '',
            keywords TEXT DEFAULT '',
            min_budget TEXT DEFAULT '',
            max_budget TEXT DEFAULT '',
            frequency TEXT DEFAULT 'daily',
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_user ON alert_preferences(user_id);

        -- Digest email log (dedup: a user never receives the same tender twice)
        CREATE TABLE IF NOT EXISTS digest_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            alert_id INTEGER NOT NULL REFERENCES alert_preferences(id),
            tender_id TEXT NOT NULL REFERENCES tenders(id),
            sent_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, tender_id)
        );
        CREATE INDEX IF NOT EXISTS idx_digest_user ON digest_log(user_id);

        -- Admin audit trail: one row per sensitive admin action or denied access
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id INTEGER,
            actor_email TEXT,
            actor_role TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            result TEXT DEFAULT 'success',
            ip TEXT,
            route TEXT,
            before_json TEXT,
            after_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_logs(actor_id);

        -- Admin-editable app settings (key/value). Currently holds the SMTP /
        -- email configuration set from the admin space; env vars are the fallback.
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now')),
            updated_by TEXT
        );
    """)

    # ── Migrations for pre-existing tables ──────────────────────────────────
    # users: admin role/status metadata
    await _add_column_if_missing(db, "users", "role", "role TEXT DEFAULT 'user'")
    await _add_column_if_missing(db, "users", "status", "status TEXT DEFAULT 'active'")
    await _add_column_if_missing(db, "users", "last_login", "last_login TEXT")
    await _add_column_if_missing(db, "users", "invited_by", "invited_by INTEGER")
    await _add_column_if_missing(db, "users", "mfa_enabled", "mfa_enabled INTEGER DEFAULT 0")

    # tenders: admin moderation state
    await _add_column_if_missing(db, "tenders", "admin_status", "admin_status TEXT DEFAULT 'active'")
    await _add_column_if_missing(db, "tenders", "review_status", "review_status TEXT DEFAULT 'unreviewed'")
    await _add_column_if_missing(db, "tenders", "flag_note", "flag_note TEXT")

    # scrape_log: attribution + richer import outcome
    await _add_column_if_missing(db, "scrape_log", "actor_email", "actor_email TEXT")
    await _add_column_if_missing(db, "scrape_log", "trigger", "trigger TEXT DEFAULT 'scheduled'")
    await _add_column_if_missing(db, "scrape_log", "tenders_updated", "tenders_updated INTEGER DEFAULT 0")
    await _add_column_if_missing(db, "scrape_log", "tenders_skipped", "tenders_skipped INTEGER DEFAULT 0")
    await _add_column_if_missing(db, "scrape_log", "warnings", "warnings TEXT")

    # dce_cache_log: parallel warm-all observability
    await _add_column_if_missing(db, "dce_cache_log", "concurrency", "concurrency INTEGER")
    await _add_column_if_missing(db, "dce_cache_log", "pauses", "pauses INTEGER DEFAULT 0")

    await db.commit()
    await db.close()
