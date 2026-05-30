"""Seed classified payslips across classifications. Idempotent. `net` is derived
on save (base + allowances - deductions)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.payroll.infrastructure.models import Payslip

# employee, period, base, allowances, deductions, classification
PAYSLIPS = [
    ("Director General", "2026-05", "28000.00", "6000.00", "3200.00", 4),
    ("Chief of Operations", "2026-05", "22000.00", "4500.00", "2600.00", 4),
    ("Field Commander", "2026-05", "16000.00", "3000.00", "1800.00", 3),
    ("Logistics Lead", "2026-05", "11000.00", "1500.00", "1200.00", 2),
    ("Archive Clerk", "2026-05", "7000.00", "800.00", "650.00", 2),
    ("Transport Driver", "2026-05", "5200.00", "400.00", "380.00", 1),
]


class Command(BaseCommand):
    help = "Seed classified payslips across classifications (net derived on save)."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for employee, period, base, allowances, deductions, clazz in PAYSLIPS:
            _, made = Payslip.objects.update_or_create(
                employee=employee,
                period=period,
                defaults={
                    "base": base,
                    "allowances": allowances,
                    "deductions": deductions,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(PAYSLIPS)} payslips ({created} new)."))
