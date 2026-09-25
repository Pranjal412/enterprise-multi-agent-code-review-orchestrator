# Perturbation Testing Log

## Purpose

These experiments deliberately modify valid and invalid inputs to observe how
the rubric-alignment systems respond to edge cases.

## System 1 — Validation

### Baseline
- Input: valid owner, repository, and positive PR number.
- Observed: validation passed on attempt 1.

### Perturbation: missing owner
- Input change: owner changed to an empty string.
- Observed: rejected on attempt 1.
- Error: `owner must be a non-empty string`.

### Perturbation: invalid PR number
- Input change: PR number changed to `0`.
- Observed: rejected on attempt 1.
- Error: `pr_number must be greater than zero`.

### Perturbation: empty repository
- Input change: repository changed to an empty string.
- Observed: rejected on attempt 1.
- Error: `repo must be a non-empty string`.

## System 2 — Routing

### Baseline
- Valid item routed to `accept`.

### Perturbation: validation failure with retry budget
- Input change: validation error introduced while retry budget remained.
- Observed: routed to `retry`.

### Perturbation: retry budget exhausted
- Input change: validation failure presented after the retry budget was exhausted.
- Observed: routed to `human_review`.

### Perturbation: batch order reversal
- Input change: the same batch was processed in reverse order.
- Observed: route counts remained identical:
  - accepted: 1
  - retried: 1
  - human review: 1
  - rejected: 0

## System 3 — Structured Extraction

### Baseline
- Valid change totals: 100 additions + 25 deletions = 125 total changes.
- Observed: two-pass consistency validation passed.

### Perturbation: missing optional title
- Input change: optional title removed.
- Observed: extraction and consistency validation still passed.
- Optional fields remain nullable.

### Perturbation: inconsistent total
- Input change: total changes changed from 125 to 130.
- Observed: two-pass consistency validation failed.
- Expected total: 125.
- Extracted total: 130.
- Variance: 5.
- Severity: MEDIUM.

### Perturbation: invalid integer
- Input change: `lines_added` changed from integer `100` to `"one hundred"`.
- Observed: extraction rejected the input with:
  `ValueError: expected an integer or null`.

## Evidence Files

- `results/system1.txt`
- `results/system2.txt`
- `results/system3.txt`
