"""Helpdesk ORM model: Ticket (classified support request with priority/status).

A ticket above the viewer's clearance is never returned by the list query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
Status transitions run through an audited workflow endpoint.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Ticket(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    requester = models.CharField(max_length=200)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "helpdesk_ticket"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
