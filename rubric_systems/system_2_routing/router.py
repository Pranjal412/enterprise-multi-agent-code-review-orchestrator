from dataclasses import dataclass
from enum import Enum
from typing import Generic, Sequence, TypeVar


T = TypeVar("T")


class Route(str, Enum):
    ACCEPT = "accept"
    RETRY = "retry"
    HUMAN_REVIEW = "human_review"
    REJECT = "reject"


@dataclass(frozen=True)
class RoutingDecision(Generic[T]):
    item_id: str
    route: Route
    reason: str
    attempts: int
    item: T


@dataclass(frozen=True)
class BatchResult(Generic[T]):
    decisions: list[RoutingDecision[T]]
    accepted: int
    retried: int
    human_review: int
    rejected: int


class ReviewRouter(Generic[T]):
    """Deterministic routing for validated review items."""

    def __init__(self, max_retries: int = 2) -> None:
        if max_retries < 0:
            raise ValueError("max_retries must be non-negative")

        self.max_retries = max_retries

    def route(
        self,
        item_id: str,
        item: T,
        validation_errors: Sequence[str],
        attempts: int = 1,
    ) -> RoutingDecision[T]:
        if not validation_errors:
            return RoutingDecision(
                item_id=item_id,
                route=Route.ACCEPT,
                reason="validation passed",
                attempts=attempts,
                item=item,
            )

        if attempts <= self.max_retries:
            return RoutingDecision(
                item_id=item_id,
                route=Route.RETRY,
                reason="validation failed and retry budget remains",
                attempts=attempts,
                item=item,
            )

        return RoutingDecision(
            item_id=item_id,
            route=Route.HUMAN_REVIEW,
            reason="validation failed and retry budget is exhausted",
            attempts=attempts,
            item=item,
        )

    def process_batch(
        self,
        items: Sequence[tuple[str, T, Sequence[str], int]],
    ) -> BatchResult[T]:
        decisions = [
            self.route(
                item_id=item_id,
                item=item,
                validation_errors=errors,
                attempts=attempts,
            )
            for item_id, item, errors, attempts in items
        ]

        return BatchResult(
            decisions=decisions,
            accepted=sum(d.route is Route.ACCEPT for d in decisions),
            retried=sum(d.route is Route.RETRY for d in decisions),
            human_review=sum(
                d.route is Route.HUMAN_REVIEW for d in decisions
            ),
            rejected=sum(d.route is Route.REJECT for d in decisions),
        )
