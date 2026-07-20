import aiosqlite
import os
from config import DB_PATH

async def get_db() -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db

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
    """)
    await db.commit()
    await db.close()
