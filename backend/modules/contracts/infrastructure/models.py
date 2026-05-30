"""Contracts ORM models: ContractRecord (a classified general contract register
entry with start/end dates and a counterparty).

A contract above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
The counterparty is stored as a CharField (no cross-module FK to other modules).
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class ContractRecord(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        RENEWED = "renewed", "Renewed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    party = models.CharField(max_length=200)
    value = models.DecimalField(max_digits=18, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "contracts_contractrecord"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
