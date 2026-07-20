# Email Digest Alerts

**Date:** 2026-07-20
**Status:** Approved

## Goal

When the daily scrape detects new tenders, users receive one email digest listing the new tenders that match their saved alert criteria. Users manage alerts on a revamped Alerts page with multi-select filter pickers. Email goes out via SMTP; the scrape runs on an in-app daily scheduler.

## Data model

`alert_preferences` keeps its existing columns with these firm interpretations:

| Column | Meaning |
|---|---|
| `sectors` | Comma-separated sector codes (e.g. `A,D`). Empty = any sector. |
| `regions` | Comma-separated normalized region names, same values as `/api/regions`. Empty = any region. |
| `keywords` | Comma-separated terms. Empty = any. |
| `min_budget`, `max_budget` | Plain numbers in MAD as strings. Empty = unbounded. |
| `frequency` | Kept in schema; only `daily` is honored. Removed from the UI. |
| `enabled` | Disabled alerts are skipped by the digest. |

New table:

```sql
CREATE TABLE IF NOT EXISTS digest_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    alert_id INTEGER NOT NULL REFERENCES alert_preferences(id),
    tender_id TEXT NOT NULL REFERENCES tenders(id),
    sent_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, tender_id)
);
CREATE INDEX IF NOT EXISTS idx_digest_user ON digest_log(user_id);
```

`UNIQUE(user_id, tender_id)` guarantees a user never receives the same tender twice, and `MAX(sent_at)` per alert powers "last sent" on the Alerts page.

## New-offer detection (includes a scraper bug fix)

`scrape_all_sectors()` currently counts new tenders with `if db.total_changes:` — `total_changes` is a cumulative connection counter, so this overcounts after the first insert. Fix: capture `db.total_changes` before each `INSERT OR IGNORE` and compare after. Collect genuinely new tender ids and return them: `scrape_all_sectors() -> {"total_found": int, "total_new": int, "new_ids": list[str]}`.

## Matching engine — `backend/digest.py`

Pure function `match_alert(alert: dict, tender: dict) -> bool`. AND across criteria the alert sets; empty criteria are ignored (an alert with all criteria empty matches everything).

- **Sectors:** `tender["sector_code"]` is in the alert's sector set.
- **Regions:** `normalize_location(tender["location"])["region"]` is in the alert's region set (reuses the existing normalizer from `main.py`).
- **Keywords:** OR within the list — at least one term appears accent- and case-insensitively in `title`, `entity`, or `location`.
- **Budget:** applied after the other criteria pass. Fetch tender details via the lazy mechanism factored into `ensure_tender_details(tender_id)` (shared with `GET /api/tenders/{id}`), parse the French-formatted `estimation` (e.g. `1 234 567,89 MAD`) to a float. If it parses, enforce `min <= estimation <= max`. If estimation is missing or unparseable, the tender **matches anyway** (lenient — missing data must not hide opportunities); the email shows "Estimation non communiquee".

Budget-triggered detail fetches happen only for tenders that already passed the other criteria, keeping detail scrapes to a handful per run.

## Email delivery — `backend/emailer.py`

`smtplib` with STARTTLS; no new dependencies. Configuration via environment variables:

| Var | Default | Role |
|---|---|---|
| `SMTP_HOST` | *(unset)* | If unset, email is disabled. |
| `SMTP_PORT` | `587` | |
| `SMTP_USER`, `SMTP_PASSWORD` | | Login credentials (e.g. Gmail app password). |
| `SMTP_FROM` | value of `SMTP_USER` | From address. |
| `FRONTEND_URL` | `http://localhost:5173` | Base for links in emails. |

`send_email(to: str, subject: str, html: str, text: str)` sends a multipart/alternative message. When `SMTP_HOST` is unset the digest logs "email disabled", skips sending, and **does not** write `digest_log` rows — so once SMTP is configured, nothing was falsely marked as sent (tenders from earlier runs are still not re-sent, because only each run's `new_ids` are considered).

**Email content (French, one email per user per run):** subject "N nouvelles consultations correspondent a vos alertes"; body sectioned per alert name; each tender shows the title linked to `FRONTEND_URL/tenders/{id}`, buyer, location, deadline, and estimation; footer links to `FRONTEND_URL/alerts` for managing subscriptions. HTML styled inline to match the app's ivory/crimson look, plus a plain-text alternative.

## Orchestration

`run_digest(new_ids: list[str])` in `digest.py`:
1. Load enabled alerts joined with user emails.
2. For each new tender, evaluate `match_alert` per alert; group matches by user; a tender matching several of a user's alerts is listed once (under the first matching alert).
3. Drop tenders already present in `digest_log` for that user.
4. Send one email per user; on success, insert `digest_log` rows. A per-user send failure is logged and does not abort other users.

**Scheduler:** an asyncio background task started in the FastAPI lifespan. It sleeps until the next `DIGEST_HOUR` (env var, default `7`, local time), runs `scrape_all_sectors()` then `run_digest(new_ids)`, and repeats. A module-level `asyncio.Lock` is shared with `POST /api/scrape` so scheduled and manual runs cannot overlap. Manual `POST /api/scrape` also calls `run_digest` after scraping. If the scrape raises, no digest runs that cycle; the error is logged and the scheduler continues to the next day.

## API additions

- `POST /api/alerts/preview` (auth required): body = same shape as `AlertRequest`; returns `{count, sample}` where `count` is how many currently **active** (`status = 'en_cours'`) tenders match the criteria via the same `match_alert`, and `sample` is up to 5 of them (id, title, entity, location, deadline). Budget bounds in preview only use already-stored `tender_details` (no detail scraping storm).
- `POST /api/alerts/test-email` (auth required): sends a short test email to the logged-in user's address; returns `{status: "sent"}` or a 503 with a clear message when SMTP is not configured.

Existing `/api/alerts` CRUD endpoints are unchanged.

## Alerts page revamp — `frontend/src/pages/Alerts.tsx`

Rebuilt in the FilterBar's visual style (same card chrome, `label-academic` labels, crimson primary button). Logged-out state unchanged.

**Form (create and edit):**
- Name (text input, required).
- Keywords (text input, comma-separated).
- Sectors: multi-select checkbox-chip grid populated from `/api/filters` sectors (code + name).
- Regions: multi-select checkbox-chip grid populated from `/api/regions`.
- Budget: min / max number inputs (MAD).
- Enabled toggle.
- Live preview panel: on demand (button "Apercu"), calls `/api/alerts/preview` and shows "N consultations actives correspondent" plus sample titles.
- Frequency selector removed.

**Alert list:** each alert card shows its criteria as chips, an enable/disable toggle (PUT), edit (loads values into the form), delete, and the last digest date (from `digest_log`, returned by `GET /api/alerts` as `last_sent`).

A "Tester l'email" button on the page calls `/api/alerts/test-email` and reports success/failure in a toast.

UI copy is French without accented characters, matching the rest of the app.

## Error handling summary

- SMTP unset → digest skipped, logged, no `digest_log` writes.
- Per-user SMTP failure → logged, other users unaffected, no `digest_log` rows for the failed user.
- Scrape failure → no digest that cycle; scheduler continues next day.
- Detail-fetch failure during budget matching → treated as "estimation unknown" (lenient match).

## Testing

- `backend/test_digest.py` (pytest, like the existing `test_location_normalization.py`):
  - `match_alert`: each criterion alone, combinations, empty-criteria alert, accent/case-insensitive keywords, French number parsing for estimation, lenient behavior on missing estimation.
  - `run_digest` grouping and dedup with a monkeypatched `send_email`: one email per user, digest_log written on success, dedup on second run, disabled alerts skipped.
- Manual: create an alert in the UI, preview it, trigger `POST /api/scrape`, verify the email arrives (or use the test-email endpoint); verify `digest_log` prevents re-sends.

## Out of scope

- Weekly frequency and per-alert send scheduling.
- Token-based unsubscribe links (alerts are managed while logged in).
- Multi-language emails.
- Migrating old free-text alert rows (existing rows keep working; values that don't match real sector codes/regions simply never match).
