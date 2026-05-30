"""Seed classified contract register entries across statuses and classifications.
Idempotent."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.contracts.infrastructure.models import ContractRecord

# title_ar, title_en, party, value, start_date, end_date, status, classification
CONTRACTS = [
    (
        "اتفاقية الخدمات الأمنية الاستراتيجية",
        "Strategic Security Services Agreement",
        "Sentinel Defense Group",
        Decimal("4500000.00"),
        date(2025, 1, 1),
        date(2027, 12, 31),
        ContractRecord.Status.ACTIVE,
        4,
    ),
    (
        "عقد توريد أنظمة الاتصالات",
        "Communications Systems Supply Contract",
        "Nexa Telecom",
        Decimal("1800000.00"),
        date(2024, 6, 1),
        date(2026, 5, 31),
        ContractRecord.Status.ACTIVE,
        3,
    ),
    (
        "عقد صيانة المركبات",
        "Fleet Maintenance Contract",
        "Atlas Motors",
        Decimal("620000.00"),
        date(2023, 3, 1),
        date(2025, 2, 28),
        ContractRecord.Status.RENEWED,
        2,
    ),
    (
        "اتفاقية خدمات الحوسبة السحابية",
        "Cloud Computing Services Agreement",
        "Cirrus Cloud",
        Decimal("950000.00"),
        date(2024, 9, 1),
        date(2026, 8, 31),
        ContractRecord.Status.ACTIVE,
        2,
    ),
    (
        "عقد تنظيف المرافق العامة",
        "Facility Cleaning Contract",
        "BrightCare Services",
        Decimal("210000.00"),
        date(2022, 1, 1),
        date(2024, 12, 31),
        ContractRecord.Status.EXPIRED,
        1,
    ),
    (
        "عقد توريد القرطاسية المكتبية",
        "Office Stationery Supply Contract",
        "Paperline Trading",
        Decimal("85000.00"),
        date(2025, 2, 1),
        date(2026, 1, 31),
        ContractRecord.Status.ACTIVE,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified contract register entries with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, party, value, start, end, status, clazz in CONTRACTS:
            _, made = ContractRecord.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "party": party,
                    "value": value,
                    "start_date": start,
                    "end_date": end,
                    "status": status,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(CONTRACTS)} contracts ({created} new)."))
