from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SourceRecord:
    source: str
    data: dict[str, Any] | None
    available: bool = True
    error: str | None = None


@dataclass(frozen=True)
class Conflict:
    field: str
    values: dict[str, Any]


@dataclass(frozen=True)
class SynthesisResult:
    merged: dict[str, Any]
    provenance: dict[str, list[str]]
    conflicts: list[Conflict]
    source_failures: dict[str, str]


def synthesize_sources(sources: list[SourceRecord]) -> SynthesisResult:
    merged: dict[str, Any] = {}
    provenance: dict[str, list[str]] = {}
    conflicts: list[Conflict] = []
    source_failures: dict[str, str] = {}

    for record in sources:
        if not record.available or record.data is None:
            source_failures[record.source] = (
                record.error or "Source unavailable"
            )
            continue

        for field, value in record.data.items():
            provenance.setdefault(field, []).append(record.source)

            if field not in merged:
                merged[field] = value
                continue

            if merged[field] != value:
                conflicts.append(
                    Conflict(
                        field=field,
                        values={
                            source: source_data[field]
                            for source, source_data in (
                                (r.source, r.data)
                                for r in sources
                                if r.available and r.data is not None
                            )
                            if field in source_data
                        },
                    )
                )

    return SynthesisResult(
        merged=merged,
        provenance=provenance,
        conflicts=conflicts,
        source_failures=source_failures,
    )
