import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
from dataclasses import asdict

from rubric_systems.multi_source_synthesis.synthesizer import (
    SourceRecord,
    synthesize_sources,
)

result = synthesize_sources(
    [
        SourceRecord(
            source="github",
            data={
                "pr_number": 42,
                "status": "open",
                "changed_files": 5,
            },
        ),
        SourceRecord(
            source="ci",
            data={
                "status": "merged",
                "tests_passed": 18,
            },
        ),
        SourceRecord(
            source="static_analysis",
            data=None,
            available=False,
            error="Static analysis service unavailable",
        ),
    ]
)

print(
    json.dumps(
        {
            "merged": result.merged,
            "provenance": result.provenance,
            "conflicts": [asdict(conflict) for conflict in result.conflicts],
            "source_failures": result.source_failures,
        },
        indent=2,
        sort_keys=True,
    )
)
