from rubric_systems.multi_source_synthesis.synthesizer import SourceRecord, synthesize_sources


def test_multiple_sources_merge_with_provenance() -> None:
    result = synthesize_sources(
        [
            SourceRecord(
                source="github",
                data={"pr_number": 42, "status": "open"},
            ),
            SourceRecord(
                source="ci",
                data={"tests_passed": 18, "status": "open"},
            ),
        ]
    )

    assert result.merged["pr_number"] == 42
    assert result.merged["tests_passed"] == 18
    assert result.provenance["status"] == ["github", "ci"]
    assert result.conflicts == []


def test_conflicting_sources_are_recorded() -> None:
    result = synthesize_sources(
        [
            SourceRecord(
                source="github",
                data={"status": "open", "changed_files": 5},
            ),
            SourceRecord(
                source="static_analysis",
                data={"status": "merged", "changed_files": 5},
            ),
        ]
    )

    assert result.merged["status"] == "open"
    assert len(result.conflicts) == 1
    assert result.conflicts[0].field == "status"
    assert result.conflicts[0].values == {
        "github": "open",
        "static_analysis": "merged",
    }


def test_failed_source_is_preserved_without_blocking_synthesis() -> None:
    result = synthesize_sources(
        [
            SourceRecord(
                source="github",
                data={"pr_number": 42},
            ),
            SourceRecord(
                source="ci",
                data=None,
                available=False,
                error="CI service unavailable",
            ),
        ]
    )

    assert result.merged["pr_number"] == 42
    assert result.source_failures == {
        "ci": "CI service unavailable",
    }


def test_empty_sources_are_deterministic() -> None:
    result = synthesize_sources([])

    assert result.merged == {}
    assert result.provenance == {}
    assert result.conflicts == []
    assert result.source_failures == {}
