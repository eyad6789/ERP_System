"""Finance ORM models: Budget (per fiscal year), Expenditure (classified spend),
and Contract (classified, owned, with progress/status).

Contracts and expenditures above the viewer's clearance are never returned in
full: their sensitive fields (title/vendor/value) are withheld server-side.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Budget(models.Model):
    fiscal_year = models.PositiveIntegerField(unique=True)
    total_amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=8, default="IQD")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "finance_budget"
        ordering = ["-fiscal_year"]

    def __str__(self) -> str:
        return f"Budget {self.fiscal_year}"


class Expenditure(models.Model):
    department_code = models.CharField(max_length=32, db_index=True)
    category = models.CharField(max_length=64)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "finance_expenditure"
        ordering = ["-classification", "department_code"]

    def __str__(self) -> str:
        return f"{self.department_code}/{self.category}"


class Contract(models.Model):
    class Status(models.TextChoices):
        SIGNED = "signed", "Signed"
        IN_PROGRESS = "in_progress", "In Progress"
        UNDER_REVIEW = "under_review", "Under Review"
        COMPLETED = "completed", "Completed"

    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    vendor = models.CharField(max_length=200)
    value = models.DecimalField(max_digits=18, decimal_places=2)
    progress = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SIGNED)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="owned_contracts",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "finance_contract"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
