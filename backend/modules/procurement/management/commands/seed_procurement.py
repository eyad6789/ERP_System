"""Seed classified vendors and purchase orders across statuses and classifications.
Idempotent."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.procurement.infrastructure.models import PurchaseOrder, Vendor

# name_ar, name_en, category, rating, classification
VENDORS = [
    ("شركة الدفاع المتقدمة", "Advanced Defense Corp", "Defense Systems", 5, 4),
    ("حلول الاتصالات الآمنة", "Secure Comms Solutions", "Communications", 4, 3),
    ("الإمداد اللوجستي الوطني", "National Logistics Supply", "Logistics", 3, 2),
    ("مورد القرطاسية العام", "General Office Supplier", "Office Supplies", 2, 1),
]

# vendor_en, title_ar, title_en, total, status, classification
PURCHASE_ORDERS = [
    (
        "Advanced Defense Corp",
        "نظام رادار مشفّر",
        "Encrypted Radar System",
        Decimal("4500000.00"),
        PurchaseOrder.Status.APPROVED,
        4,
    ),
    (
        "Secure Comms Solutions",
        "أجهزة اتصال ميدانية",
        "Field Communication Units",
        Decimal("820000.00"),
        PurchaseOrder.Status.RECEIVED,
        3,
    ),
    (
        "National Logistics Supply",
        "عقد إمداد الوقود",
        "Fuel Supply Contract",
        Decimal("310000.50"),
        PurchaseOrder.Status.DRAFT,
        2,
    ),
    (
        "National Logistics Supply",
        "قطع غيار المركبات",
        "Vehicle Spare Parts",
        Decimal("145000.00"),
        PurchaseOrder.Status.CLOSED,
        2,
    ),
    (
        "General Office Supplier",
        "لوازم مكتبية ربع سنوية",
        "Quarterly Office Supplies",
        Decimal("28000.00"),
        PurchaseOrder.Status.APPROVED,
        1,
    ),
    (
        "General Office Supplier",
        "طابعات وأحبار",
        "Printers and Toner",
        Decimal("16500.75"),
        PurchaseOrder.Status.DRAFT,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified vendors and purchase orders with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        vendors: dict[str, Vendor] = {}
        vendor_created = 0
        for name_ar, name_en, category, rating, clazz in VENDORS:
            vendor, made = Vendor.objects.update_or_create(
                name_en=name_en,
                defaults={
                    "name_ar": name_ar,
                    "category": category,
                    "rating": rating,
                    "classification": clazz,
                },
            )
            vendors[name_en] = vendor
            vendor_created += int(made)

        order_created = 0
        for vendor_en, title_ar, title_en, total, status, clazz in PURCHASE_ORDERS:
            _, made = PurchaseOrder.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "vendor": vendors[vendor_en],
                    "title_ar": title_ar,
                    "total": total,
                    "status": status,
                    "classification": clazz,
                },
            )
            order_created += int(made)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(VENDORS)} vendors ({vendor_created} new) and "
                f"{len(PURCHASE_ORDERS)} purchase orders ({order_created} new)."
            )
        )
