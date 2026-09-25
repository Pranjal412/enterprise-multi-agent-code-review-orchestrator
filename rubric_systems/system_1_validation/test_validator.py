from rubric_systems.system_1_validation.validator import ValidationSystem, normalize_review_input, validate_review_input


def test_valid_input_passes_without_retry() -> None:
    system = ValidationSystem(validate_review_input)

    result = system.validate(
        {
            "owner": "octocat",
            "repo": "Hello-World",
            "pr_number": 1,
        }
    )

    assert result.valid is True
    assert result.value is not None
    assert result.attempts == 1
    assert result.errors == []


def test_invalid_input_is_repaired_by_retry_transform() -> None:
    system = ValidationSystem(validate_review_input, max_retries=2)

    result = system.validate(
        {
            "owner": "",
            "repo": "",
            "pr_number": 0,
        },
        retry_transform=normalize_review_input,
    )

    assert result.valid is True
    assert result.value == {
        "owner": "unknown-owner",
        "repo": "unknown-repo",
        "pr_number": 1,
    }
    assert result.attempts == 2


def test_invalid_input_without_transform_is_rejected() -> None:
    system = ValidationSystem(validate_review_input, max_retries=2)

    result = system.validate(
        {
            "owner": "",
            "repo": "",
            "pr_number": 0,
        }
    )

    assert result.valid is False
    assert result.value is None
    assert len(result.errors) == 3
    assert result.attempts == 1


def test_retry_limit_is_bounded() -> None:
    calls = 0

    def always_invalid(_: dict[str, object]) -> list[str]:
        nonlocal calls
        calls += 1
        return ["invalid input"]

    def unchanged(
        value: dict[str, object],
        _: list[str],
    ) -> dict[str, object]:
        return value

    system = ValidationSystem(always_invalid, max_retries=2)
    result = system.validate({}, retry_transform=unchanged)

    assert result.valid is False
    assert result.attempts == 3
    assert calls == 3


def test_negative_retry_count_is_rejected() -> None:
    try:
        ValidationSystem(validate_review_input, max_retries=-1)
    except ValueError as exc:
        assert str(exc) == "max_retries must be non-negative"
    else:
        raise AssertionError("Expected ValueError")
