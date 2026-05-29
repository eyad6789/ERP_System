"""Seed warehouses and classified inventory items across classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.inventory.infrastructure.models import InventoryItem, Warehouse

# code, name_ar, name_en, location
WAREHOUSES = [
    ("WH-CENTRAL", "المستودع المركزي", "Central Warehouse", "HQ Logistics Block"),
    ("WH-FIELD", "مستودع الميدان", "Field Depot", "Forward Operating Base"),
]

# sku, name_ar, name_en, quantity, unit, warehouse_code, classification
ITEMS = [
    ("AMM-7.62", "ذخيرة 7.62 ملم", "7.62mm Ammunition", 4, "crate", "WH-FIELD", 4),
    ("ENC-RADIO", "جهاز راديو مشفّر", "Encrypted Radio Set", 8, "unit", "WH-CENTRAL", 4),
    ("NV-GOGGLE", "نظارة رؤية ليلية", "Night Vision Goggles", 6, "unit", "WH-FIELD", 3),
    ("MED-KIT", "حقيبة إسعافات ميدانية", "Field Medical Kit", 45, "unit", "WH-CENTRAL", 2),
    ("FUEL-DSL", "وقود الديزل", "Diesel Fuel", 1200, "liter", "WH-CENTRAL", 2),
    ("OFF-PAPER", "ورق مكتبي A4", "A4 Office Paper", 320, "ream", "WH-CENTRAL", 1),
]


class Command(BaseCommand):
    help = "Seed warehouses and classified inventory items across classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        warehouses: dict[str, Warehouse] = {}
        wh_created = 0
        for code, name_ar, name_en, location in WAREHOUSES:
            warehouse, made = Warehouse.objects.update_or_create(
                code=code,
                defaults={"name_ar": name_ar, "name_en": name_en, "location": location},
            )
            warehouses[code] = warehouse
            wh_created += int(made)

        item_created = 0
        for sku, name_ar, name_en, quantity, unit, wh_code, clazz in ITEMS:
            _, made = InventoryItem.objects.update_or_create(
                sku=sku,
                defaults={
                    "name_ar": name_ar,
                    "name_en": name_en,
                    "quantity": quantity,
                    "unit": unit,
                    "warehouse": warehouses[wh_code],
                    "classification": clazz,
                },
            )
            item_created += int(made)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(WAREHOUSES)} warehouses ({wh_created} new) and "
                f"{len(ITEMS)} items ({item_created} new)."
            )
        )
