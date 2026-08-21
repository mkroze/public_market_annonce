"""Admin-editable application settings, backed by the ``app_settings`` table.

Currently this is the SMTP / email configuration that the admin space manages.
The stored value always wins; a blank/missing value falls back to the matching
environment variable, so existing ``.env`` deployments keep working and the
admin UI can override any field without a redeploy.

The SMTP password is stored write-only: it is persisted here but never returned
to the frontend (the API exposes only ``password_set``).
"""

import os

from database import get_db

# app_settings key → environment variable used as the fallback when the stored
# value is blank. Order is also the canonical field order for the email config.
EMAIL_ENV_FALLBACK = {
    "smtp_host": "SMTP_HOST",
    "smtp_port": "SMTP_PORT",
    "smtp_user": "SMTP_USER",
    "smtp_password": "SMTP_PASSWORD",
    "smtp_from": "SMTP_FROM",
    "smtp_from_name": "SMTP_FROM_NAME",
}
EMAIL_KEYS = list(EMAIL_ENV_FALLBACK)


async def _load_stored(keys: list[str]) -> dict[str, str]:
    db = await get_db()
    try:
        placeholders = ",".join("?" * len(keys))
        cursor = await db.execute(
            f"SELECT key, value FROM app_settings WHERE key IN ({placeholders})", keys
        )
        return {row["key"]: row["value"] for row in await cursor.fetchall()}
    finally:
        await db.close()


async def resolve_email_config() -> dict[str, str]:
    """Effective email config: stored value if set, else the env fallback."""
    stored = await _load_stored(EMAIL_KEYS)
    config: dict[str, str] = {}
    for key, env_name in EMAIL_ENV_FALLBACK.items():
        value = (stored.get(key) or "").strip()
        if not value:
            value = os.getenv(env_name, "").strip()
        config[key] = value
    return config


async def set_email_settings(db, values: dict[str, str], *, updated_by: str | None = None) -> None:
    """Upsert the provided email settings. Caller owns the db connection so the
    write and its audit-log row commit together. Only known keys are written."""
    for key, value in values.items():
        if key not in EMAIL_ENV_FALLBACK:
            continue
        await db.execute(
            """INSERT INTO app_settings (key, value, updated_at, updated_by)
               VALUES (?, ?, datetime('now'), ?)
               ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   updated_at = excluded.updated_at,
                   updated_by = excluded.updated_by""",
            (key, value, updated_by),
        )
    await db.commit()
