"""Performance ORM models: PerformanceReview (classified employee appraisal).

A review above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class PerformanceReview(models.Model):
    class Rating(models.TextChoices):
        OUTSTANDING = "outstanding", "Outstanding"
        GOOD = "good", "Good"
        NEEDS_IMPROVEMENT = "needs_improvement", "Needs Improvement"

    employee = models.CharField(max_length=200)
    period = models.CharField(max_length=100)
    score = models.PositiveSmallIntegerField(default=0)
    rating = models.CharField(max_length=20, choices=Rating.choices, default=Rating.GOOD)
    notes = models.TextField(blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "performance_performancereview"
        ordering = ["-classification", "employee"]

    def __str__(self) -> str:
        return f"{self.employee} ({self.period})"
