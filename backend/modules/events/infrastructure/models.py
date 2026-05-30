"""Events ORM models: Event (a classified scheduled calendar entry).

An event above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Event(models.Model):
    class EventType(models.TextChoices):
        MEETING = "meeting", "Meeting"
        DEADLINE = "deadline", "Deadline"
        HOLIDAY = "holiday", "Holiday"
        OPERATION = "operation", "Operation"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    event_type = models.CharField(
        max_length=20, choices=EventType.choices, default=EventType.MEETING
    )
    location = models.CharField(max_length=200, blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "events_event"
        ordering = ["-classification", "start_at"]

    def __str__(self) -> str:
        return self.title_en
