import aiosqlite
import os
from config import DB_PATH
from tender_lifecycle import deadline_date_expr

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

        -- Saved searches: a member's one-click recall of a past catalog query.
        -- Unlike alerts, these never send email. The full filter set is stored
        -- as a JSON blob so the frontend can round-trip any TenderFilters shape.
        CREATE TABLE IF NOT EXISTS saved_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            criteria TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

        -- One-time email-action tokens (verify_email | password_reset). Only a
        -- hash of the raw token is stored; the raw token travels in the email link.
        CREATE TABLE IF NOT EXISTS email_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            purpose TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            target_email TEXT NOT NULL DEFAULT '',
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_email_tokens_lookup ON email_tokens(user_id, purpose);

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

        -- Internal website operating expense ledger. Stores provider costs,
        -- never provider secrets.
        CREATE TABLE IF NOT EXISTS website_costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            amount_minor INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'MAD',
            billing_cycle TEXT NOT NULL,
            service_period_start TEXT,
            service_period_end TEXT,
            due_date TEXT,
            paid_date TEXT,
            status TEXT NOT NULL DEFAULT 'planned',
            reference TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            created_by TEXT,
            updated_by TEXT,
            archived_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_website_costs_status ON website_costs(status);
        CREATE INDEX IF NOT EXISTS idx_website_costs_due_date ON website_costs(due_date);
        CREATE INDEX IF NOT EXISTS idx_website_costs_category ON website_costs(category);
        CREATE INDEX IF NOT EXISTS idx_website_costs_currency ON website_costs(currency);
        CREATE INDEX IF NOT EXISTS idx_website_costs_archived ON website_costs(archived_at);

        -- Editable schedules for the recurring background jobs (scrape+digest,
        -- DCE cache warm, DCE extraction). Persisted so the admin can retune the
        -- cadence at runtime without a redeploy; the scheduler loop reads this
        -- live each tick. One row per job key.
        CREATE TABLE IF NOT EXISTS job_schedules (
            job TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 0,
            schedule_kind TEXT NOT NULL DEFAULT 'daily',   -- daily | interval
            hour INTEGER NOT NULL DEFAULT 7,               -- for kind=daily (Africa/Casablanca)
            interval_minutes INTEGER NOT NULL DEFAULT 60,  -- for kind=interval
            last_run_at TEXT,
            last_status TEXT,                              -- ok | failed | running
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
    await _add_column_if_missing(db, "users", "theme", "theme TEXT DEFAULT 'system'")
    # email verification: NULL until the user confirms their address
    await _add_column_if_missing(db, "users", "email_verified_at", "email_verified_at TEXT")

    # users: company / eligibility profile (all optional, source: user, unverified).
    # Powers the "épuré" eligibility-aware catalog + facilitates legal procedures.
    # Identity & legal (dossier auto-fill, not a hide rule).
    await _add_column_if_missing(db, "users", "legal_form", "legal_form TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "ice", "ice TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "rc_number", "rc_number TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "rc_city", "rc_city TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "if_number", "if_number TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "cnss_number", "cnss_number TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "patente_number", "patente_number TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "hq_city", "hq_city TEXT DEFAULT ''")
    # Activity & eligibility drivers (JSON arrays, mirrors saved_searches.criteria).
    await _add_column_if_missing(db, "users", "profile_sectors_json", "profile_sectors_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "profile_categories_json", "profile_categories_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "qualifications_json", "qualifications_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "certifications_json", "certifications_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "coverage_regions_json", "coverage_regions_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "profile_keywords", "profile_keywords TEXT DEFAULT ''")
    # Size & capacity (bands, never an exact figure) + contract fourchette.
    await _add_column_if_missing(db, "users", "size_band", "size_band TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "revenue_band", "revenue_band TEXT DEFAULT ''")
    await _add_column_if_missing(db, "users", "contract_min", "contract_min INTEGER")
    await _add_column_if_missing(db, "users", "contract_max", "contract_max INTEGER")
    # Bidding preferences.
    await _add_column_if_missing(db, "users", "bids_in_groupement", "bids_in_groupement INTEGER DEFAULT 0")
    await _add_column_if_missing(db, "users", "preferred_procedures_json", "preferred_procedures_json TEXT DEFAULT '[]'")
    await _add_column_if_missing(db, "users", "eligibility_filter_default", "eligibility_filter_default INTEGER DEFAULT 0")
    # art. 27 self-declaration answers ({question_id: "oui"|"non"|"nsp"}); feeds
    # the eligibility classification (standing verdict), not the catalog hide rule.
    await _add_column_if_missing(db, "users", "standing_json", "standing_json TEXT DEFAULT '{}'")

    # tenders: admin moderation state
    await _add_column_if_missing(db, "tenders", "admin_status", "admin_status TEXT DEFAULT 'active'")
    await _add_column_if_missing(db, "tenders", "review_status", "review_status TEXT DEFAULT 'unreviewed'")
    await _add_column_if_missing(db, "tenders", "flag_note", "flag_note TEXT")

    # tenders: lifecycle and source freshness metadata
    await _add_column_if_missing(db, "tenders", "deadline_date", "deadline_date TEXT")
    await _add_column_if_missing(db, "tenders", "source_last_seen_at", "source_last_seen_at TEXT")
    await _add_column_if_missing(db, "tenders", "last_seen_import_id", "last_seen_import_id INTEGER")
    await _add_column_if_missing(db, "tenders", "archived_at", "archived_at TEXT")
    await _add_column_if_missing(db, "tenders", "archived_reason", "archived_reason TEXT")

    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_deadline_date ON tenders(deadline_date)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_admin_status ON tenders(admin_status)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_tenders_last_seen_import ON tenders(last_seen_import_id)")

    normalized_deadline = deadline_date_expr("deadline")
    await db.execute(
        f"""UPDATE tenders
           SET deadline_date = {normalized_deadline}
           WHERE deadline_date IS NOT {normalized_deadline}"""
    )

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
