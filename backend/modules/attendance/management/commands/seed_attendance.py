"""Seed classified attendance records across statuses and classifications. Idempotent."""

from __future__ import annotations

import datetime
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.attendance.infrastructure.models import AttendanceRecord

# employee, date, status, check_in, check_out, classification
RECORDS = [
    (
        "العميد سالم القحطاني",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.PRESENT,
        "07:55",
        "16:10",
        4,
    ),
    (
        "النقيب ريم الدوسري",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.LATE,
        "08:40",
        "16:05",
        3,
    ),
    (
        "الرقيب ماجد العتيبي",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.LEAVE,
        "",
        "",
        3,
    ),
    (
        "الموظف خالد الشهري",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.ABSENT,
        "",
        "",
        2,
    ),
    (
        "الموظفة نورة الحربي",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.PRESENT,
        "08:00",
        "16:00",
        2,
    ),
    (
        "الموظف فهد المطيري",
        datetime.date(2026, 5, 25),
        AttendanceRecord.Status.PRESENT,
        "07:50",
        "15:55",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified attendance records with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for employee, date, status, check_in, check_out, clazz in RECORDS:
            _, made = AttendanceRecord.objects.update_or_create(
                employee=employee,
                date=date,
                defaults={
                    "status": status,
                    "check_in": check_in,
                    "check_out": check_out,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(RECORDS)} attendance records ({created} new).")
        )
