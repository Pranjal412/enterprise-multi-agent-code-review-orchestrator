import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rubric_systems.system_2_routing.router import ReviewRouter


def main() -> None:
    router = ReviewRouter(max_retries=1)

    cases = [
        ("baseline_valid", "item-a", [], 1),
        ("validation_failure_with_budget", "item-b", ["invalid input"], 1),
        ("validation_failure_exhausted", "item-c", ["invalid input"], 2),
    ]

    for name, item_id, errors, attempts in cases:
        decision = router.route(
            item_id=item_id,
            item={"name": item_id},
            validation_errors=errors,
            attempts=attempts,
        )
        print(
            f"{name}: route={decision.route.value}, "
            f"reason={decision.reason}, "
            f"attempts={decision.attempts}"
        )

    batch = [
        ("item-a", {"name": "a"}, [], 1),
        ("item-b", {"name": "b"}, ["invalid input"], 1),
        ("item-c", {"name": "c"}, ["invalid input"], 2),
    ]

    first = router.process_batch(batch)
    perturbed = router.process_batch(list(reversed(batch)))

    print(
        "baseline_batch="
        f"accepted={first.accepted}, "
        f"retried={first.retried}, "
        f"human_review={first.human_review}, "
        f"rejected={first.rejected}"
    )
    print(
        "reversed_batch="
        f"accepted={perturbed.accepted}, "
        f"retried={perturbed.retried}, "
        f"human_review={perturbed.human_review}, "
        f"rejected={perturbed.rejected}"
    )
    print(
        "same_route_counts_after_reordering="
        f"{(first.accepted, first.retried, first.human_review, first.rejected) == (perturbed.accepted, perturbed.retried, perturbed.human_review, perturbed.rejected)}"
    )


if __name__ == "__main__":
    main()
