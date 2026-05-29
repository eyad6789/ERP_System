"""Seed the financial year budget, classified expenditures, and contracts.
Idempotent (update_or_create). Bilingual AR/EN with a spread of classifications.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.finance.infrastructure.models import Budget, Contract, Expenditure
from modules.iam.infrastructure.models import User

FISCAL_YEAR = 2026
TOTAL_AMOUNT = Decimal("480000000000")

# department_code, category, amount, classification
EXPENDITURES = [
    ("OPS", "Operations", Decimal("120000000000"), 2),
    ("LOG", "Logistics", Decimal("85000000000"), 1),
    ("INT", "Intelligence", Decimal("60000000000"), 4),
    ("HR", "Personnel", Decimal("45000000000"), 2),
    ("CMD", "Command", Decimal("30000000000"), 3),
]

# title_ar, title_en, vendor, value, progress, status, classification
CONTRACTS = [
    (
        "توريد المركبات المدرّعة",
        "Armored Vehicle Supply",
        "Al-Rafidain Defense Co.",
        Decimal("90000000000"),
        65,
        Contract.Status.IN_PROGRESS,
        2,
    ),
    (
        "صيانة شبكة الاتصالات",
        "Comms Network Maintenance",
        "Tigris Systems",
        Decimal("25000000000"),
        100,
        Contract.Status.COMPLETED,
        1,
    ),
    (
        "نظام المراقبة المشفّر",
        "Encrypted Surveillance System",
        "Zagros Secure",
        Decimal("55000000000"),
        30,
        Contract.Status.UNDER_REVIEW,
        4,
    ),
    (
        "تطوير مركز القيادة",
        "Command Center Upgrade",
        "Mesopotamia Build",
        Decimal("40000000000"),
        10,
        Contract.Status.SIGNED,
        3,
    ),
    (
        "خدمات الدعم اللوجستي",
        "Logistics Support Services",
        "Babel Logistics",
        Decimal("18000000000"),
        80,
        Contract.Status.IN_PROGRESS,
        2,
    ),
]


class Command(BaseCommand):
    help = "Seed the finance budget, expenditures, and contracts."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        owner = User.objects.filter(username="admin").first() or User.objects.first()

        Budget.objects.update_or_create(
            fiscal_year=FISCAL_YEAR,
            defaults={"total_amount": TOTAL_AMOUNT, "currency": "IQD"},
        )

        for department_code, category, amount, clazz in EXPENDITURES:
            Expenditure.objects.update_or_create(
                department_code=department_code,
                category=category,
                defaults={"amount": amount, "classification": clazz},
            )

        for title_ar, title_en, vendor, value, progress, status, clazz in CONTRACTS:
            Contract.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "vendor": vendor,
                    "value": value,
                    "progress": progress,
                    "status": status,
                    "classification": clazz,
                    "owner": owner,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded budget {FISCAL_YEAR}, {len(EXPENDITURES)} expenditures, "
                f"{len(CONTRACTS)} contracts."
            )
        )
