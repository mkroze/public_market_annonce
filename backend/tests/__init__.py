"""Backend test suite.

Run from the `backend/` directory, so that `mpm` resolves as the import root the
same way it does under `uvicorn mpm.api.main:app`:

    .venv/bin/python -m unittest discover -s tests -t .

One module:

    .venv/bin/python -m unittest tests.test_admin

Tests stay flat here, one `test_<subject>.py` per subject: discovery needs no
package plumbing and every module resolves its fixtures relative to its own
`__file__`. Fixtures live in `testdata/<subject>_fixtures/`.

Each module points `config.DB_PATH` at its own temporary database *before*
importing `mpm.db.database`, which binds the value at import time, and mocks the
portal, n8n and SMTP — so nothing here touches real data or the network. That
ordering is why no `__init__.py` in `mpm` may import a submodule.
"""
