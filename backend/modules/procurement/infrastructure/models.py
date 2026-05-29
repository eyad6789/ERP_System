"""Procurement ORM models: Vendor (rated supplier) and PurchaseOrder (classified
order placed against a vendor).

A purchase order above the viewer's clearance is never returned by the directory
query (FILTER pattern): the row is excluded server-side, never merely hidden in
the UI.
"""

from __future__ import annotations

from django.core.validators import MaxValueValidator
from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Vendor(models.Model):
    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(5)])
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "procurement_vendor"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        RECEIVED = "received", "Received"
        CLOSED = "closed", "Closed"

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="purchase_orders")
    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    total = models.DecimalField(max_digits=18, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "procurement_purchaseorder"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
