# Tradeoff and Reliability Analysis

## Scope

This reflection is based on the implemented rubric-alignment systems and the
observed unit-test, static-analysis, synthesis, and perturbation-test results.

## 1. Validation and Bounded Retry

The validation system provides deterministic validation and a bounded retry
mechanism.

Observed behavior:
- Valid input passed on the first attempt.
- Invalid owner, repository, and PR number inputs were rejected immediately
  when no repair transform was supplied.
- The retry budget is explicitly bounded.

Tradeoff:
- Bounded retries prevent uncontrolled repeated validation attempts.
- The system does not automatically repair invalid input unless a retry
  transformation is supplied. This keeps validation behavior predictable but
  places responsibility for repair logic on the caller.

## 2. Validation-Driven Routing

The routing system separates accepted inputs, retryable failures, and cases
requiring human review.

Observed behavior:
- Valid input routed to `accept`.
- Validation failure with remaining retry budget routed to `retry`.
- Exhausted retry budget routed to `human_review`.
- Reversing batch order preserved the route counts.

Tradeoff:
- Deterministic rule-based routing is easy to test and reproduce.
- It is intentionally less adaptive than a probabilistic or model-based
  routing strategy.

## 3. Structured Extraction and Two-Pass Consistency

The extraction system preserves optional fields as null values and performs
a consistency check between additions, deletions, and total changes.

Observed behavior:
- Valid change totals passed consistency validation.
- Removing an optional field did not cause a consistency failure.
- Changing total changes from 125 to 130 produced a MEDIUM discrepancy with
  variance 5.
- A non-integer `lines_added` value was rejected.

Tradeoff:
- Explicit typed extraction and consistency checks make malformed or
  contradictory values visible.
- The consistency rule is domain-specific to the GitHub pull-request change
  representation used here and does not by itself validate every possible
  semantic property of a review.

## 4. Multi-Source Synthesis

The synthesis component combines information from multiple sources while
preserving provenance.

Observed behavior:
- GitHub and CI data were merged.
- A disagreement between GitHub and CI on `status` was recorded as a conflict.
- An unavailable static-analysis source was recorded as a source failure.
- Other available source information remained usable.

Tradeoff:
- Provenance and explicit conflict reporting improve traceability.
- Conflict handling adds complexity because consumers must decide how to
  resolve or present conflicting values rather than silently accepting one
  source as authoritative.

## 5. Evidence and Reliability

The implementation has evidence from:
- pytest tests for Systems 1, 2, and 3
- mypy checks
- Ruff checks
- multi-source synthesis execution
- perturbation experiments
- recorded perturbation observations

The perturbation results show that invalid or inconsistent inputs are
surfaced rather than silently treated as valid.

## 6. Remaining Limitations

The Python rubric-alignment implementation is an evidence-oriented companion
to the existing TypeScript application. It does not replace the original
TypeScript Claude Agent SDK implementation.

The extraction consistency check currently covers the implemented arithmetic
relationship. It should not be interpreted as complete validation of all
possible GitHub pull-request semantics.

The routing logic is deterministic and rule-based; more complex production
routing could require additional contextual signals.

## Conclusion

The combined evidence demonstrates bounded validation, deterministic routing,
structured extraction with consistency checking, multi-source synthesis with
provenance and conflict detection, and deliberate edge-case testing.

The results also expose the tradeoffs of these mechanisms instead of treating
the implementation as universally reliable.
