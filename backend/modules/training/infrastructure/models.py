"""Training ORM models: TrainingCourse (classified course with a lifecycle status).

A course above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class TrainingCourse(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        ONGOING = "ongoing", "Ongoing"
        COMPLETED = "completed", "Completed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    hours = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPCOMING)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "training_trainingcourse"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
