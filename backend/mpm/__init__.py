"""The backend, as one import root.

Everything ships under `mpm` so that `uvicorn`, `unittest discover` and
`pip install -e .` resolve module names identically, whatever the working
directory. The ASGI app is `mpm.api.main:app`.

Layers, imports pointing down:

    core                    no first-party imports at all
    security, db            credentials and persistence
    mail, tenders, costs    domain
    pipeline                the tender lifecycle, one module per stage
    api, scheduler          HTTP surfaces and the job driver

One documented exception: `db.database` imports `tenders.tender_lifecycle`,
whose SQL-expression helpers have no first-party imports of their own.

Every `__init__.py` in this tree is metadata only — it imports no submodule and
runs no side effect. Two reasons, both load-bearing:

- `api.main` and `api.admin` import each other lazily inside functions to break
  a cycle; an eager import in a package `__init__` would re-create it.
- Each test module points `config.DB_PATH` at a throwaway database *before*
  importing `db.database`, which binds the value at import time. An `__init__`
  that pulled in a submodule would bind the real data file first.
"""
