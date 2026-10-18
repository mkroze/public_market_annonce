"""The tender lifecycle, one module per stage.

This package mirrors `frontend/src/admin/stages/registry.ts`, which is the
admin space's single source of truth for the lifecycle: the sidebar, the
dashboard diagram, the stage routes and the Controls / Data / Logs views all
read from it. The module names carry the same step numbers so a stage on the
dashboard maps to exactly one file here.

    step 1  Collecte HTML          stage_01_collect    scrape notices, refresh catalog
    step 2  Dossiers ZIP           stage_02_archives   pre-download consultation archives
    step 3  Fiches universelles    stage_03_fiches     dispatch extraction, store results
    step 4  Video generation       —                   planned, no implementation
    step 5  Résultats/attributions stage_05_awards     award parsing groundwork only
    step 6  Campagnes              —                   planned, no implementation

Python module names cannot begin with a digit, hence the `stage_NN_` prefix
rather than a bare `01_`.

The gap at `04` is deliberate and stays: the step number is a contract with
`registry.ts`, `StageSlug` and the journal keys, so renumbering would desync
the admin sidebar, the dashboard diagram and every stage route. A planned
stage is an entry below with `module: None` and no file.

`control.py` is shared rather than a stage: it holds the cooperative
pause/resume/cancel primitive each sweep checkpoints against.

What is deliberately NOT here:

- `mpm/scheduler.py` drives every stage, so it belongs to no single one.
- `mpm/mail/digest.py` sends the alert e-mail that stage 1's `scrape_digest`
  workflow fans out to. It is delivery, shared with the planned campaigns
  stage.
- Moderation, lifecycle normalization and display live in `mpm/tenders/`:
  they serve the whole catalog, not one step.

STAGES below is metadata only — it imports no submodule, so adding a stage
cannot introduce an import cycle. `workflow` is the backend journal key
(`api/admin.py`'s WorkflowKey) and is None while a stage is planned.
"""

STAGES = (
    {"step": 1, "slug": "scrape", "title": "Collecte HTML",
     "module": "stage_01_collect", "workflow": "scrape_digest"},
    {"step": 2, "slug": "dce-cache", "title": "Dossiers ZIP",
     "module": "stage_02_archives", "workflow": "dce_cache"},
    {"step": 3, "slug": "dce-extraction", "title": "Fiches universelles",
     "module": "stage_03_fiches", "workflow": "dce_extraction"},
    {"step": 4, "slug": "video-generation", "title": "Video generation",
     "module": None, "workflow": None},
    {"step": 5, "slug": "awards", "title": "Résultats & attributions",
     "module": "stage_05_awards", "workflow": None},
    {"step": 6, "slug": "campaigns", "title": "Campagnes",
     "module": None, "workflow": None},
)

#: Stages with a module behind them, in lifecycle order.
IMPLEMENTED_STAGES = tuple(s for s in STAGES if s["module"])


def stage_by_workflow(workflow: str) -> dict | None:
    """The stage owning a backend journal key, or None."""
    return next((s for s in STAGES if s["workflow"] == workflow), None)
