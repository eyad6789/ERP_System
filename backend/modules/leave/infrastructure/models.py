"""Leave ORM models: LeaveRequest (a classified employee time-off request with an
approve/reject workflow).

A request above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
The employee is stored as a CharField (no cross-module FK to personnel).
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class LeaveRequest(models.Model):
    class LeaveType(models.TextChoices):
        ANNUAL = "annual", "Annual"
        SICK = "sick", "Sick"
        EMERGENCY = "emergency", "Emergency"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.CharField(max_length=200)
    leave_type = models.CharField(
        max_length=20, choices=LeaveType.choices, default=LeaveType.ANNUAL
    )
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(max_length=500, blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_leaverequest"
        ordering = ["-classification", "-start_date"]

    def __str__(self) -> str:
        return f"{self.employee} ({self.leave_type})"
