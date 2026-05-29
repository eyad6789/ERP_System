"""Inventory ORM models: Warehouse (storage location) and InventoryItem (a
classified stock record held in a warehouse).

An item above the viewer's clearance is never returned by the listing query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Warehouse(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    location = models.CharField(max_length=200)

    class Meta:
        db_table = "inventory_warehouse"
        ordering = ["code"]

    def __str__(self) -> str:
        return self.name_en


class InventoryItem(models.Model):
    sku = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    quantity = models.IntegerField(default=0)
    unit = models.CharField(max_length=50)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="items")
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_inventoryitem"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en
