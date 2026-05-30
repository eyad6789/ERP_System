"""Payroll ORM models: Payslip (a classified pay record for one employee/period).

A payslip above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
The employee is stored as a CharField (no cross-module FK to personnel).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Payslip(models.Model):
    employee = models.CharField(max_length=200)
    period = models.CharField(max_length=100)
    base = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_payslip"
        ordering = ["-classification", "employee"]

    def __str__(self) -> str:
        return f"{self.employee} · {self.period}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.net = self.base + self.allowances - self.deductions
        super().save(*args, **kwargs)
