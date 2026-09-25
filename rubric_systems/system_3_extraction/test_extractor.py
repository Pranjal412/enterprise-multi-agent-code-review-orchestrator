from rubric_systems.system_3_extraction.extractor import (
    classify_document,
    extract_fields,
    run_two_pass_extraction,
    validate_consistency,
)


def test_github_pull_request_is_classified() -> None:
    document = {"type": "github_pull_request"}

    assert classify_document(document) == "github_pull_request"


def test_structured_fields_are_extracted() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 5,
        "lines_added": 250,
        "lines_deleted": 120,
        "total_changes": 370,
        "security_notes": "No security findings reported.",
    }

    result = extract_fields(document, "pr-123")

    assert result.document_id == "pr-123"
    assert result.document_type == "github_pull_request"
    assert result.files_modified == 5
    assert result.lines_added == 250
    assert result.lines_deleted == 120
    assert result.total_changes == 370
    assert result.security_notes == "No security findings reported."


def test_missing_optional_fields_remain_none() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 2,
        "lines_added": 10,
        "lines_deleted": 5,
        "total_changes": 15,
    }

    result = extract_fields(document, "pr-missing-fields")

    assert result.security_notes is None


def test_consistency_validation_passes_when_sum_matches() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 5,
        "lines_added": 250,
        "lines_deleted": 120,
        "total_changes": 370,
    }

    result = extract_fields(document, "pr-valid")

    validation = validate_consistency(result)

    assert validation.passed is True
    assert validation.discrepancies == []


def test_consistency_validation_detects_discrepancy() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 5,
        "lines_added": 250,
        "lines_deleted": 120,
        "total_changes": 400,
    }

    result = extract_fields(document, "pr-inconsistent")
    validation = validate_consistency(result)

    assert validation.passed is False
    assert len(validation.discrepancies) == 1

    discrepancy = validation.discrepancies[0]

    assert discrepancy.field_name == "total_changes"
    assert discrepancy.expected_from_sum == 370.0
    assert discrepancy.extracted_value == 400.0
    assert discrepancy.variance == 30.0
    assert discrepancy.severity == "MEDIUM"


def test_two_pass_extraction_contains_both_passes() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 5,
        "lines_added": 250,
        "lines_deleted": 120,
        "total_changes": 370,
    }

    result = run_two_pass_extraction(document, "pr-two-pass")

    assert result.document_type == "github_pull_request"
    assert result.first_pass == result.second_pass
    assert result.validation.passed is True


def test_two_pass_extraction_surfaces_inconsistency() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": 5,
        "lines_added": 250,
        "lines_deleted": 120,
        "total_changes": 400,
    }

    result = run_two_pass_extraction(document, "pr-two-pass-error")

    assert result.validation.passed is False
    assert len(result.validation.discrepancies) == 1


def test_invalid_integer_field_is_rejected() -> None:
    document = {
        "type": "github_pull_request",
        "files_modified": "five",
    }

    try:
        extract_fields(document, "pr-invalid")
    except ValueError as exc:
        assert str(exc) == "expected an integer or null"
    else:
        raise AssertionError("Expected ValueError")
