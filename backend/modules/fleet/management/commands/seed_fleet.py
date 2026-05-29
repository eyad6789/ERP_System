"""Seed classified vehicles across statuses and classifications, with a few
maintenance records. Idempotent."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.fleet.infrastructure.models import MaintenanceRecord, Vehicle

# plate, vtype, make, status, odometer, classification
VEHICLES = [
    ("CMD-001", "Armored SUV", "Toyota", Vehicle.Status.ACTIVE, 42000, 4),
    ("OPS-204", "Command Vehicle", "Mercedes", Vehicle.Status.MAINTENANCE, 88000, 3),
    ("LOG-310", "Cargo Truck", "Volvo", Vehicle.Status.ACTIVE, 156000, 2),
    ("UTL-415", "Utility Pickup", "Ford", Vehicle.Status.ACTIVE, 73000, 2),
    ("BUS-512", "Transport Bus", "Iveco", Vehicle.Status.RETIRED, 312000, 1),
    ("PTL-620", "Patrol Car", "Nissan", Vehicle.Status.ACTIVE, 21000, 1),
]

# plate, date, note_ar, note_en, cost
MAINTENANCE = [
    ("OPS-204", date(2026, 3, 14), "تغيير المحرك", "Engine overhaul", Decimal("4200.00")),
    ("LOG-310", date(2026, 4, 2), "استبدال الإطارات", "Tire replacement", Decimal("950.50")),
    ("PTL-620", date(2026, 5, 9), "صيانة دورية", "Routine service", Decimal("320.00")),
]


class Command(BaseCommand):
    help = "Seed classified vehicles with statuses, classifications, and maintenance."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for plate, vtype, make, status, odometer, clazz in VEHICLES:
            _, made = Vehicle.objects.update_or_create(
                plate=plate,
                defaults={
                    "vtype": vtype,
                    "make": make,
                    "status": status,
                    "odometer": odometer,
                    "classification": clazz,
                },
            )
            created += int(made)

        for plate, when, note_ar, note_en, cost in MAINTENANCE:
            vehicle = Vehicle.objects.get(plate=plate)
            MaintenanceRecord.objects.update_or_create(
                vehicle=vehicle,
                date=when,
                defaults={"note_ar": note_ar, "note_en": note_en, "cost": cost},
            )

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(VEHICLES)} vehicles ({created} new)."))
