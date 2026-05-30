"""Attendance ORM models: AttendanceRecord (a classified daily attendance entry
for an employee, keyed by an opaque employee identifier — not a cross-module FK).

A record above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LEAVE = "leave", "Leave"
        LATE = "late", "Late"

    employee = models.CharField(max_length=200)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PRESENT)
    check_in = models.CharField(max_length=20, blank=True)
    check_out = models.CharField(max_length=20, blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_attendancerecord"
        ordering = ["-classification", "-date", "employee"]

    def __str__(self) -> str:
        return f"{self.employee} · {self.date}"
