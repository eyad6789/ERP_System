"""Seed classified assets across conditions and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.assets.infrastructure.models import Asset

# name_ar, name_en, asset_type, location, condition, classification
ASSETS = [
    (
        "مركز البيانات الرئيسي",
        "Primary Data Center",
        "Facility",
        "HQ Basement",
        Asset.Condition.OPERATIONAL,
        4,
    ),
    (
        "نظام الاتصالات المشفّر",
        "Encrypted Comms System",
        "Communications",
        "Operations Wing",
        Asset.Condition.OPERATIONAL,
        4,
    ),
    (
        "مركبة الاستطلاع الميداني",
        "Field Reconnaissance Vehicle",
        "Vehicle",
        "Motor Pool A",
        Asset.Condition.MAINTENANCE,
        3,
    ),
    (
        "مولّد الطاقة الاحتياطي",
        "Backup Power Generator",
        "Equipment",
        "Utility Block",
        Asset.Condition.DOWN,
        2,
    ),
    (
        "خادم الأرشيف اللوجستي",
        "Logistics Archive Server",
        "IT Hardware",
        "Server Room 2",
        Asset.Condition.OPERATIONAL,
        2,
    ),
    (
        "حافلة النقل العامة",
        "General Transport Bus",
        "Vehicle",
        "Main Gate Lot",
        Asset.Condition.OPERATIONAL,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified assets with conditions and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for name_ar, name_en, asset_type, location, condition, clazz in ASSETS:
            _, made = Asset.objects.update_or_create(
                name_en=name_en,
                defaults={
                    "name_ar": name_ar,
                    "asset_type": asset_type,
                    "location": location,
                    "condition": condition,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(ASSETS)} assets ({created} new)."))
