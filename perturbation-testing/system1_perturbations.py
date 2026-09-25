import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rubric_systems.system_1_validation.validator import (
    ValidationSystem,
    validate_review_input,
)


def main() -> None:
    system = ValidationSystem(validate_review_input, max_retries=2)

    cases = [
        (
            "baseline",
            {"owner": "octocat", "repo": "hello-world", "pr_number": 42},
        ),
        (
            "missing_owner",
            {"owner": "", "repo": "hello-world", "pr_number": 42},
        ),
        (
            "invalid_pr_number",
            {"owner": "octocat", "repo": "hello-world", "pr_number": 0},
        ),
        (
            "empty_repo",
            {"owner": "octocat", "repo": "", "pr_number": 42},
        ),
    ]

    for name, payload in cases:
        result = system.validate(
            payload,

        )
        print(
            f"{name}: valid={result.valid}, "
            f"attempts={result.attempts}, "
            f"errors={result.errors}"
        )


if __name__ == "__main__":
    main()
