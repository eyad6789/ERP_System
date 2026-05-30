"""Meetings ORM models: Meeting (classified scheduled gathering with a status).

A meeting above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Meeting(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        DONE = "done", "Done"
        CANCELLED = "cancelled", "Cancelled"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    location = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "meetings_meeting"
        ordering = ["-classification", "start_at"]

    def __str__(self) -> str:
        return self.title_en
