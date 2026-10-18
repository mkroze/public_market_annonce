"""Outbound email: SMTP transport, branding, auth templates, and the alert
digest.

`digest` lives here rather than under `pipeline` because it is delivery shared
between stage 1's `scrape_digest` fan-out and the planned campaigns stage.
"""
