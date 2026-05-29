"""Fleet ORM models: Vehicle (classified vehicle with status/odometer) and its
MaintenanceRecord history.

A vehicle above the viewer's clearance is never returned by the directory query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Vehicle(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "Maintenance"
        RETIRED = "retired", "Retired"

    plate = models.CharField(max_length=32, unique=True)
    vtype = models.CharField(max_length=100)
    make = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    odometer = models.IntegerField(default=0)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fleet_vehicle"
        ordering = ["-classification", "plate"]

    def __str__(self) -> str:
        return self.plate


class MaintenanceRecord(models.Model):
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name="maintenance_records"
    )
    date = models.DateField()
    note_ar = models.CharField(max_length=200)
    note_en = models.CharField(max_length=200)
    cost = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "fleet_maintenancerecord"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.vehicle.plate} @ {self.date}"
