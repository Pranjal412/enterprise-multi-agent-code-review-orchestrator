# Structured Extraction Reflection

The extraction system performs a two-pass extraction and then validates the
relationship between `lines_added`, `lines_deleted`, and `total_changes`.

## Observed successful case

For `evidence-pr-42`:
- `lines_added`: 100
- `lines_deleted`: 25
- `total_changes`: 125
- Consistency validation passed.

## Observed inconsistent case

For `inconsistent-pr-42`:
- `lines_added`: 100
- `lines_deleted`: 25
- `total_changes`: 130
- Expected total: 125
- Extracted total: 130
- Variance: 5
- Severity: MEDIUM
- Consistency validation failed.

## Interpretation

The two-pass structure makes the extracted representation available before
consistency validation and provides an explicit validation result. The
consistency check detects an arithmetic discrepancy rather than silently
accepting the stated total.

The check is intentionally limited to the fields and arithmetic relationship
implemented by this system. It should not be interpreted as complete semantic
validation of every possible pull-request attribute.
