"""One-time email-action tokens (email verification, password reset).

Only a SHA-256 hash of the raw token is ever stored; the raw token travels only
in the email link. Helpers here own the invalidate/issue/consume lifecycle but
never commit — the calling endpoint controls the transaction.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

VERIFY_EMAIL = "verify_email"
PASSWORD_RESET = "password_reset"

VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(minutes=60)
RESEND_COOLDOWN = timedelta(minutes=2)

# SQLite datetime('now') is UTC in 'YYYY-MM-DD HH:MM:SS'. We store expiries in the
# same shape/zone so lexical string comparison is a valid time comparison.
_FMT = "%Y-%m-%d %H:%M:%S"


def _utcnow() -> datetime:
    """Naive UTC now, matching SQLite's datetime('now') string shape/zone."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def issue_token(db, user_id: int, purpose: str, ttl: timedelta, target_email: str = "") -> str:
    """Invalidate prior unused tokens for (user, purpose), create a fresh one,
    and return the raw token (only its hash is persisted). Does not commit."""
    await db.execute(
        "UPDATE email_tokens SET used_at = datetime('now') "
        "WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
        (user_id, purpose),
    )
    raw = secrets.token_urlsafe(32)
    expires_at = (_utcnow() + ttl).strftime(_FMT)
    await db.execute(
        "INSERT INTO email_tokens (user_id, purpose, token_hash, target_email, expires_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (user_id, purpose, _hash_token(raw), target_email, expires_at),
    )
    return raw


async def consume_token(db, raw: str, purpose: str) -> dict | None:
    """Return the token row if valid (matching purpose, unused, unexpired) and
    mark it used; otherwise None. Does not commit."""
    cursor = await db.execute(
        "SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ?",
        (_hash_token(raw), purpose),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    row = dict(row)
    if row["used_at"] is not None:
        return None
    if row["expires_at"] < _utcnow().strftime(_FMT):
        return None
    await db.execute(
        "UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?", (row["id"],)
    )
    return row


async def last_unused_token_age(db, user_id: int, purpose: str) -> timedelta | None:
    """Age of the most recent unused token for (user, purpose), for rate-limiting
    resends. None when there is no such token."""
    cursor = await db.execute(
        "SELECT created_at FROM email_tokens "
        "WHERE user_id = ? AND purpose = ? AND used_at IS NULL "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id, purpose),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    created = datetime.strptime(row["created_at"], _FMT)
    return _utcnow() - created
