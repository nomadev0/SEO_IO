"""Utility helpers to score and prioritise SEO issues locally."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

SEVERITY_WEIGHTS = {
    "Critical": 1.0,
    "High": 0.8,
    "Medium": 0.5,
    "Low": 0.2,
}


@dataclass
class Issue:
    id: str
    title: str
    severity: str
    impact: float = 0.5  # Expected business impact (0-1)
    effort: float = 0.5  # Implementation effort (0-1, lower is better)
    category: str | None = None

    def score(self) -> float:
        severity_weight = SEVERITY_WEIGHTS.get(self.severity, 0.3)
        effort_modifier = 1.0 - max(0.0, min(self.effort, 1.0))
        impact_clamped = max(0.0, min(self.impact, 1.0))
        raw_score = (impact_clamped * 0.6 + severity_weight * 0.4) * (0.7 + 0.3 * effort_modifier)
        return round(raw_score, 3)


def prioritise(issues: Iterable[Issue]) -> List[Issue]:
    ranked = sorted(issues, key=lambda item: item.score(), reverse=True)
    return ranked
