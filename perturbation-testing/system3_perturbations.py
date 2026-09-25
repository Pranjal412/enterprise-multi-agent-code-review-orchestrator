import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rubric_systems.system_3_extraction.extractor import (
    extract_fields,
    run_two_pass_extraction,
)


def main() -> None:
    baseline = {
        "document_type": "github_pr",
        "pr_number": 42,
        "title": "Improve validation",
        "lines_added": 100,
        "lines_deleted": 25,
        "total_changes": 125,
    }

    cases = [
        ("baseline", baseline),
        (
            "missing_optional_title",
            {key: value for key, value in baseline.items() if key != "title"},
        ),
        (
            "inconsistent_total",
            {**baseline, "total_changes": 130},
        ),
        (
            "invalid_integer",
            {**baseline, "lines_added": "one hundred"},
        ),
    ]

    for name, payload in cases:
        try:
            extracted = extract_fields(payload, name)
            two_pass = run_two_pass_extraction(payload, name)

            print(
                f"{name}: "
                f"extracted={extracted}, "
                f"pass1_valid={two_pass.validation.passed}, "
                f"pass2_valid={two_pass.validation.passed}, "
                f"discrepancies={two_pass.validation.discrepancies}"
            )
        except ValueError as error:
            print(f"{name}: rejected={type(error).__name__}: {error}")


if __name__ == "__main__":
    main()
