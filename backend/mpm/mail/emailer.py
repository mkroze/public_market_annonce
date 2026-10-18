import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# SMTP transport. Configuration is resolved by ``settings.resolve_email_config``
# (admin-editable DB values with env fallback) and passed in as a dict, so this
# module stays a pure transport with no knowledge of where config comes from.
# ``send_email`` is synchronous and meant to run in a worker thread.


def email_is_configured(config: dict) -> bool:
    return bool((config.get("smtp_host") or "").strip())


def _from_header(config: dict) -> str:
    address = (config.get("smtp_from") or config.get("smtp_user") or "").strip()
    name = (config.get("smtp_from_name") or "").strip()
    return f"{name} <{address}>" if name and address else address


def _port(config: dict) -> int:
    try:
        return int((config.get("smtp_port") or "587").strip() or "587")
    except (TypeError, ValueError):
        return 587


def build_message(config: dict, to: str, subject: str, html: str, text: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _from_header(config)
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def send_email(config: dict, to: str, subject: str, html: str, text: str) -> None:
    host = (config.get("smtp_host") or "").strip()
    if not host:
        raise RuntimeError("SMTP non configure (host manquant)")
    user = (config.get("smtp_user") or "").strip()
    password = config.get("smtp_password") or ""
    msg = build_message(config, to, subject, html, text)
    with smtplib.SMTP(host, _port(config), timeout=30) as smtp:
        smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
