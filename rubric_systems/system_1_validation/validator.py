from dataclasses import dataclass
from typing import Callable, Generic, TypeVar


T = TypeVar("T")


@dataclass(frozen=True)
class ValidationResult(Generic[T]):
    valid: bool
    value: T | None
    errors: list[str]
    attempts: int


Validator = Callable[[T], list[str]]


class ValidationSystem(Generic[T]):
    """Deterministic validation with bounded retry support."""

    def __init__(self, validator: Validator[T], max_retries: int = 2) -> None:
        if max_retries < 0:
            raise ValueError("max_retries must be non-negative")

        self.validator = validator
        self.max_retries = max_retries

    def validate(
        self,
        value: T,
        retry_transform: Callable[[T, list[str]], T] | None = None,
    ) -> ValidationResult[T]:
        current = value
        last_errors: list[str] = []

        for attempt in range(1, self.max_retries + 2):
            last_errors = self.validator(current)

            if not last_errors:
                return ValidationResult(
                    valid=True,
                    value=current,
                    errors=[],
                    attempts=attempt,
                )

            if retry_transform is None:
                break

            if attempt > self.max_retries:
                break

            current = retry_transform(current, last_errors)

        return ValidationResult(
            valid=False,
            value=None,
            errors=last_errors,
            attempts=attempt,
        )


def validate_review_input(review: dict[str, object]) -> list[str]:
    """Validate the minimum structure required for a review request."""
    errors: list[str] = []

    owner = review.get("owner")
    repo = review.get("repo")
    pr_number = review.get("pr_number")

    if not isinstance(owner, str) or not owner.strip():
        errors.append("owner must be a non-empty string")

    if not isinstance(repo, str) or not repo.strip():
        errors.append("repo must be a non-empty string")

    if not isinstance(pr_number, int) or isinstance(pr_number, bool):
        errors.append("pr_number must be an integer")
    elif pr_number <= 0:
        errors.append("pr_number must be greater than zero")

    return errors


def normalize_review_input(
    review: dict[str, object],
    errors: list[str],
) -> dict[str, object]:
    """Apply deterministic corrections for known validation failures."""
    normalized = dict(review)

    if "owner must be a non-empty string" in errors:
        normalized["owner"] = "unknown-owner"

    if "repo must be a non-empty string" in errors:
        normalized["repo"] = "unknown-repo"

    if "pr_number must be an integer" in errors:
        normalized["pr_number"] = 1
    elif "pr_number must be greater than zero" in errors:
        normalized["pr_number"] = 1

    return normalized
