"""Operations ORM models: Task (classified, prioritized, status-tracked).

Tasks above the viewer's clearance are excluded from the board server-side
(the personnel FILTER pattern), never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Task(models.Model):
    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    assignee = models.CharField(max_length=120, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "operations_task"
        ordering = ["-classification", "due_date"]

    def __str__(self) -> str:
        return self.title_en
