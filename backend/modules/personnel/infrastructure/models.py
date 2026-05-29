"""Personnel ORM models: Department (self-referential hierarchy) and Person.

Each Person carries a `classification` (1-4) used for server-side clearance
filtering — records above the viewer's clearance are never returned by the API.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Department(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name_ar = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )

    class Meta:
        db_table = "personnel_department"

    def __str__(self) -> str:
        return self.code


class Person(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        LEAVE = "leave", "On leave"
        MISSION = "mission", "On mission"

    name_ar = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    rank_ar = models.CharField(max_length=64, blank=True)
    rank_en = models.CharField(max_length=64, blank=True)
    department = models.ForeignKey(
        Department, null=True, on_delete=models.PROTECT, related_name="members"
    )
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    attendance = models.PositiveSmallIntegerField(default=100)
    joined_year = models.PositiveSmallIntegerField(null=True, blank=True)
    contract_type = models.CharField(max_length=32, blank=True)

    class Meta:
        db_table = "personnel_person"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en
