"""Risk ORM models: Risk (classified risk-register entry with a derived score).

A risk above the viewer's clearance is never returned by the register query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
The ``score`` is derived (likelihood * impact) and refreshed on every save.
"""

from __future__ import annotations

from typing import Any

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Risk(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        MITIGATING = "mitigating", "Mitigating"
        CLOSED = "closed", "Closed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    likelihood = models.PositiveSmallIntegerField()
    impact = models.PositiveSmallIntegerField()
    score = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    mitigation = models.TextField(blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "risk_risk"
        ordering = ["-classification", "-score", "title_en"]

    def __str__(self) -> str:
        return self.title_en

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.score = self.likelihood * self.impact
        super().save(*args, **kwargs)
