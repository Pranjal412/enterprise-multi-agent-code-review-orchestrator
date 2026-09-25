from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ExtractionResult:
    document_id: str
    document_type: str
    files_modified: int | None
    lines_added: int | None
    lines_deleted: int | None
    total_changes: int | None
    security_notes: str | None


@dataclass(frozen=True)
class ConsistencyDiscrepancy:
    field_name: str
    expected_from_sum: float
    extracted_value: float
    variance: float
    severity: str


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    discrepancies: list[ConsistencyDiscrepancy]


@dataclass(frozen=True)
class TwoPassResult:
    document_id: str
    document_type: str
    first_pass: ExtractionResult
    second_pass: ExtractionResult
    validation: ValidationResult


def classify_document(document: dict[str, Any]) -> str:
    """Classify the supported document representation."""
    if document.get("type") == "github_pull_request":
        return "github_pull_request"

    return "unknown"


def extract_fields(
    document: dict[str, Any],
    document_id: str,
) -> ExtractionResult:
    """Extract only values actually present in the source."""
    return ExtractionResult(
        document_id=document_id,
        document_type=classify_document(document),
        files_modified=_optional_int(document.get("files_modified")),
        lines_added=_optional_int(document.get("lines_added")),
        lines_deleted=_optional_int(document.get("lines_deleted")),
        total_changes=_optional_int(document.get("total_changes")),
        security_notes=_optional_string(document.get("security_notes")),
    )


def validate_consistency(result: ExtractionResult) -> ValidationResult:
    """Check whether total_changes equals additions plus deletions."""
    discrepancies: list[ConsistencyDiscrepancy] = []

    if result.lines_added is None or result.lines_deleted is None:
        return ValidationResult(passed=True, discrepancies=[])

    expected = float(result.lines_added + result.lines_deleted)

    if result.total_changes is None:
        return ValidationResult(passed=True, discrepancies=[])

    extracted = float(result.total_changes)
    variance = abs(expected - extracted)

    if variance > 0:
        discrepancies.append(
            ConsistencyDiscrepancy(
                field_name="total_changes",
                expected_from_sum=expected,
                extracted_value=extracted,
                variance=variance,
                severity="HIGH" if variance >= 50 else "MEDIUM",
            )
        )

    return ValidationResult(
        passed=not discrepancies,
        discrepancies=discrepancies,
    )


def run_two_pass_extraction(
    document: dict[str, Any],
    document_id: str,
) -> TwoPassResult:
    """Run extraction twice and validate arithmetic consistency."""
    first_pass = extract_fields(document, document_id)
    second_pass = extract_fields(document, document_id)
    validation = validate_consistency(second_pass)

    return TwoPassResult(
        document_id=document_id,
        document_type=second_pass.document_type,
        first_pass=first_pass,
        second_pass=second_pass,
        validation=validation,
    )


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("expected an integer or null")

    return value


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError("expected a string or null")

    return value
