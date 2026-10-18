"""Modules with no first-party imports, shared by more than one package.

`config` owns every boot-time constant and every filesystem path (all anchored
to `BASE_DIR`, never to the working directory). `mem_profile` is opt-in memory
profiling for long sweeps. Nothing admin-editable at runtime belongs here — that
is `db.settings`.
"""
