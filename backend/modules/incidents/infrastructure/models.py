"""Incidents ORM model: Incident (classified, severity-ranked, status-tracked).

Incidents above the viewer's clearance are excluded from queries server-side
(the personnel FILTER pattern). Status changes are audited.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Incident(models.Model):
    class Severity(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    severity = models.CharField(max_length=16, choices=Severity.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    reported_date = models.DateField(null=True, blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "incidents_incident"
        ordering = ["-classification", "-reported_date"]

    def __str__(self) -> str:
        return self.title_en
