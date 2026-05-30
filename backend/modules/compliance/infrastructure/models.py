"""Compliance ORM models: ComplianceItem (classified control/standard with status).

A compliance item above the viewer's clearance is never returned by the directory
query (FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class ComplianceItem(models.Model):
    class Status(models.TextChoices):
        COMPLIANT = "compliant", "Compliant"
        NON_COMPLIANT = "non_compliant", "Non Compliant"
        IN_REVIEW = "in_review", "In Review"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    standard = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_REVIEW)
    finding = models.TextField(blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "compliance_complianceitem"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
