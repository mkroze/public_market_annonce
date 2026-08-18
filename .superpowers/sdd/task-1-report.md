# Task 1 Report: Backend Normalization Module

## Status

DONE

## Scope

Implemented Task 1 from `task-1-brief.md` only.

Created:

- `backend/tender_display.py`
- `backend/test_tender_display.py`

Unrelated existing modified and untracked files were left untouched.

## Implementation

The normalization module provides the required interfaces:

- `build_tender_display(tender, details=None)`
- `display_value(value, status="detected", source="computed", confidence="medium", raw=None)`
- `clean_text(value)`
- `parse_money(text)`

It includes the brief's required behavior for:

- whitespace and punctuation cleanup;
- detail-first title, buyer, and location normalization;
- duplicate commune, province, or prefecture suffix removal;
- base-tender fallback values;
- missing signal states;
- Moroccan money formats;
- zero estimation handling versus zero plan-price handling;
- explicit competition-label parsing for application counts;
- DCE availability signals.

## TDD Evidence

The mandated RED command was run before implementation:

```text
./.venv/bin/python -m unittest test_tender_display -v
```

It failed as expected with:

```text
ModuleNotFoundError: No module named 'tender_display'
```

After implementation, the same focused command passed:

```text
Ran 6 tests in 0.002s
OK
```

## Commit

Created path-limited commit:

```text
7bd184a feat: add tender display normalization
```

The commit contains only `backend/tender_display.py` and `backend/test_tender_display.py`.

## Concerns

None for Task 1. The full project test suite was not run because the brief specifies the focused backend command.

## Review Fixes

- Removed the broad commune, province, and prefecture suffix fallback; trailing location text is removed only when it matches the selected buyer or location.
- Preserved the original selected source value in `raw` for normalized display fields and money signals without mutating scraped inputs.
- Made estimation source provenance follow the cleaned selected value, including whitespace-only detail fallback to the base tender.

Focused verification:

```text
cd backend && .venv/bin/python -m unittest test_tender_display -v
Ran 9 tests in 0.002s
OK
```
