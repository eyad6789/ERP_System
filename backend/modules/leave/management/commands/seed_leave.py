"""Seed classified leave requests across types, statuses, and classifications.
Idempotent."""

from __future__ import annotations

from datetime import date
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.leave.infrastructure.models import LeaveRequest

# employee, leave_type, start_date, end_date, status, reason, classification
REQUESTS = [
    (
        "العميد خالد الراشد",
        LeaveRequest.LeaveType.ANNUAL,
        date(2026, 6, 1),
        date(2026, 6, 10),
        LeaveRequest.Status.APPROVED,
        "Annual leave abroad",
        4,
    ),
    (
        "النقيب سارة العتيبي",
        LeaveRequest.LeaveType.EMERGENCY,
        date(2026, 5, 20),
        date(2026, 5, 22),
        LeaveRequest.Status.PENDING,
        "Family emergency",
        3,
    ),
    (
        "الملازم أحمد الفهد",
        LeaveRequest.LeaveType.SICK,
        date(2026, 5, 18),
        date(2026, 5, 21),
        LeaveRequest.Status.APPROVED,
        "Medical recovery",
        2,
    ),
    (
        "الرقيب نورة القحطاني",
        LeaveRequest.LeaveType.ANNUAL,
        date(2026, 7, 1),
        date(2026, 7, 14),
        LeaveRequest.Status.PENDING,
        "",
        2,
    ),
    (
        "الجندي ماجد الشمري",
        LeaveRequest.LeaveType.SICK,
        date(2026, 5, 12),
        date(2026, 5, 13),
        LeaveRequest.Status.REJECTED,
        "Incomplete documentation",
        1,
    ),
    (
        "العريف ليلى الدوسري",
        LeaveRequest.LeaveType.EMERGENCY,
        date(2026, 5, 25),
        date(2026, 5, 26),
        LeaveRequest.Status.PENDING,
        "Urgent personal matter",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified leave requests with types, statuses, and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for employee, leave_type, start, end, status, reason, clazz in REQUESTS:
            _, made = LeaveRequest.objects.update_or_create(
                employee=employee,
                start_date=start,
                defaults={
                    "leave_type": leave_type,
                    "end_date": end,
                    "status": status,
                    "reason": reason,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(REQUESTS)} leave requests ({created} new).")
        )
