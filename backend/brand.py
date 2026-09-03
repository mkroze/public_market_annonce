"""Single source of truth for transactional email branding.

Email clients strip <style>/<link> and ignore CSS custom properties, so brand
tokens have to be inlined as literal values. These mirror the frontend design
system (frontend/src/index.css): navy primary, amber accent, Inter/system-sans
type, and a near-white blue-tinted canvas. Change a value here and every email
(auth verify/reset + alert digest/confirmation) updates from one place.

Layout is table-based (not flex/grid divs) for Outlook and mobile-client
compatibility, and every element carries its own inline font/colour so no email
falls back to Times New Roman.
"""

BRAND_NAME = "Marches Publics Maroc"

# --- Palette (mirrors frontend/src/index.css) --------------------------------
PRIMARY = "#00236f"        # --color-primary (navy)
PRIMARY_STRONG = "#1e3a8a"  # --color-primary-strong
ACCENT = "#f59e0b"         # --color-accent (amber)
INK = "#151c27"            # --color-ink (body text)
MUTED = "#444651"          # --color-muted (secondary text)
MUTED_LIGHT = "#757682"    # --color-muted-light (footer / captions)
APP_BG = "#f9f9ff"         # --color-app-bg (page canvas)
SURFACE = "#ffffff"        # --color-surface (card)
SURFACE_MUTED = "#f0f3ff"  # --color-surface-muted (subtle fills)
BORDER_SUBTLE = "#dce2f3"  # --color-border-subtle
ON_PRIMARY = "#ffffff"     # --color-on-primary

# Inter is the brand face; email clients rarely load web fonts, so we lead with
# "Inter" (used where installed) then fall back to a native sans stack that
# matches its geometry.
FONT_STACK = (
    "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
    "Helvetica,Arial,sans-serif"
)


def heading(text: str) -> str:
    """Primary in-body heading, navy on white."""
    return (
        f'<h1 style="margin:0 0 14px;font-family:{FONT_STACK};font-size:20px;'
        f'font-weight:700;line-height:1.3;color:{PRIMARY};">{text}</h1>'
    )


def paragraph(text: str, *, color: str = INK, size: int = 15) -> str:
    return (
        f'<p style="margin:0 0 14px;font-family:{FONT_STACK};font-size:{size}px;'
        f'line-height:1.6;color:{color};">{text}</p>'
    )


def button(label: str, url: str) -> str:
    """Primary call-to-action: navy pill, white label, brand radius."""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:22px 0;"><tr><td '
        f'style="border-radius:10px;background:{PRIMARY};">'
        f'<a href="{url}" style="display:inline-block;padding:12px 24px;'
        f'font-family:{FONT_STACK};font-size:15px;font-weight:600;'
        f'color:{ON_PRIMARY};text-decoration:none;border-radius:10px;">'
        f'{label}</a></td></tr></table>'
    )


def link(text: str, url: str) -> str:
    return (
        f'<a href="{url}" style="color:{PRIMARY};font-weight:600;'
        f'text-decoration:none;">{text}</a>'
    )


def fallback_link(url: str) -> str:
    """Plain-text URL block shown under a button in case it is not clickable."""
    return (
        f'<p style="margin:16px 0 0;font-family:{FONT_STACK};font-size:12px;'
        f'line-height:1.5;color:{MUTED_LIGHT};word-break:break-all;">'
        "Si le bouton ne fonctionne pas, copiez ce lien dans votre "
        f'navigateur :<br>{url}</p>'
    )


def shell(body_html: str, footer_html: str, preheader: str = "") -> str:
    """Wrap body content in the branded, email-safe outer layout.

    Structure: full-width canvas -> centered 600px card (white, rounded, subtle
    border) -> navy header band with an amber accent rule -> body -> muted
    footer strip.
    """
    pre = (
        f'<span style="display:none!important;visibility:hidden;opacity:0;'
        f'height:0;width:0;overflow:hidden;mso-hide:all;">{preheader}</span>'
        if preheader
        else ""
    )
    return (
        f'<div style="margin:0;padding:0;background:{APP_BG};">{pre}'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{APP_BG};padding:24px 12px;"><tr>'
        '<td align="center">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        f'style="width:100%;max-width:600px;background:{SURFACE};'
        f'border:1px solid {BORDER_SUBTLE};border-radius:16px;overflow:hidden;">'
        # Header band: navy wordmark + amber accent rule.
        f'<tr><td style="background:{PRIMARY};padding:20px 28px;">'
        f'<span style="font-family:{FONT_STACK};font-size:18px;font-weight:700;'
        f'letter-spacing:0.2px;color:{ON_PRIMARY};">{BRAND_NAME}</span>'
        '</td></tr>'
        f'<tr><td style="height:3px;line-height:3px;font-size:0;'
        f'background:{ACCENT};">&nbsp;</td></tr>'
        # Body.
        f'<tr><td style="padding:28px;">{body_html}</td></tr>'
        # Footer.
        f'<tr><td style="padding:18px 28px;border-top:1px solid {BORDER_SUBTLE};'
        f'background:{SURFACE_MUTED};font-family:{FONT_STACK};font-size:12px;'
        f'line-height:1.5;color:{MUTED_LIGHT};">{footer_html}</td></tr>'
        '</table></td></tr></table></div>'
    )
