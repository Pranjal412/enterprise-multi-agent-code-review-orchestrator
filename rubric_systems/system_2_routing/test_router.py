from rubric_systems.system_2_routing.router import (
    ReviewRouter,
    Route,
)


def test_valid_item_is_accepted() -> None:
    router: ReviewRouter[dict[str, object]] = ReviewRouter(max_retries=2)

    decision = router.route(
        item_id="item-1",
        item={"status": "valid"},
        validation_errors=[],
        attempts=1,
    )

    assert decision.route is Route.ACCEPT
    assert decision.reason == "validation passed"
    assert decision.attempts == 1


def test_failed_validation_routes_to_retry_when_budget_remains() -> None:
    router: ReviewRouter[dict[str, object]] = ReviewRouter(max_retries=2)

    decision = router.route(
        item_id="item-2",
        item={"status": "invalid"},
        validation_errors=["missing field"],
        attempts=1,
    )

    assert decision.route is Route.RETRY
    assert decision.attempts == 1
    assert "retry budget remains" in decision.reason


def test_exhausted_retry_budget_routes_to_human_review() -> None:
    router: ReviewRouter[dict[str, object]] = ReviewRouter(max_retries=2)

    decision = router.route(
        item_id="item-3",
        item={"status": "invalid"},
        validation_errors=["inconsistent data"],
        attempts=3,
    )

    assert decision.route is Route.HUMAN_REVIEW
    assert decision.attempts == 3
    assert "retry budget is exhausted" in decision.reason


def test_batch_processing_counts_each_route() -> None:
    router: ReviewRouter[dict[str, object]] = ReviewRouter(max_retries=2)

    result = router.process_batch(
        [
            ("accepted", {"value": 1}, [], 1),
            ("retry", {"value": 2}, ["error"], 1),
            ("human", {"value": 3}, ["error"], 3),
        ]
    )

    assert result.accepted == 1
    assert result.retried == 1
    assert result.human_review == 1
    assert result.rejected == 0
    assert len(result.decisions) == 3


def test_batch_order_is_deterministic() -> None:
    router: ReviewRouter[dict[str, object]] = ReviewRouter(max_retries=1)

    items: list[tuple[str, dict[str, object], list[str], int]] = [
        ("a", {"value": 1}, [], 1),
        ("b", {"value": 2}, ["error"], 1),
        ("c", {"value": 3}, ["error"], 2),
    ]

    first = router.process_batch(items)
    second = router.process_batch(items)

    assert first == second
    assert [decision.item_id for decision in first.decisions] == [
        "a",
        "b",
        "c",
    ]


def test_negative_retry_configuration_is_rejected() -> None:
    try:
        ReviewRouter(max_retries=-1)
    except ValueError as exc:
        assert str(exc) == "max_retries must be non-negative"
    else:
        raise AssertionError("Expected ValueError")
