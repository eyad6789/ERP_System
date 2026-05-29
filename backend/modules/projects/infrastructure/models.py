"""Projects ORM models: Project (classified initiative with status/progress) and
Milestone (a dated checkpoint owned by a project).

A project above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Project(models.Model):
    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On Hold"
        DONE = "done", "Done"

    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNING)
    progress = models.PositiveSmallIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    lead = models.CharField(max_length=200)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_project"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en


class Milestone(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="milestones",
    )
    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    due_date = models.DateField(null=True, blank=True)
    done = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_milestone"
        ordering = ["due_date", "title_en"]

    def __str__(self) -> str:
        return self.title_en
