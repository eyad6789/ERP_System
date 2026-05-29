"""Assets ORM models: Asset (classified physical/logical asset with condition).

An asset above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Asset(models.Model):
    class Condition(models.TextChoices):
        OPERATIONAL = "operational", "Operational"
        MAINTENANCE = "maintenance", "Maintenance"
        DOWN = "down", "Down"

    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    condition = models.CharField(
        max_length=20, choices=Condition.choices, default=Condition.OPERATIONAL
    )
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assets_asset"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en
