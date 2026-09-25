# System 1 — Validation

This system demonstrates deterministic structured-input validation with bounded retry support.

## Behavior

1. Validate a review request.
2. Return explicit validation errors when the input is invalid.
3. Optionally apply a deterministic correction function.
4. Retry validation up to the configured retry limit.
5. Return a structured ValidationResult.
6. Reject the input when the retry limit is exhausted.

## Test

Run from the repository root:

    /voc/work/.local/bin/pytest rubric_systems/system_1_validation/test_validator.py

## Static analysis

    /voc/work/.local/bin/mypy rubric_systems/system_1_validation/validator.py
    ruff check rubric_systems/system_1_validation
