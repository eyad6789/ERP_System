"""Seed operations board tasks across priorities, statuses and classifications.
Idempotent (update_or_create keyed on title_en).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.operations.infrastructure.models import Task

# title_ar, title_en, assignee, priority, status, classification, due_date
TASKS = [
    (
        "تأمين محيط القاعدة",
        "Secure Base Perimeter",
        "Capt. Huda",
        Task.Priority.HIGH,
        Task.Status.ACTIVE,
        4,
        date(2026, 6, 5),
    ),
    (
        "مراجعة سجلات الوصول",
        "Review Access Logs",
        "Sgt. Karim",
        Task.Priority.MEDIUM,
        Task.Status.OPEN,
        3,
        date(2026, 6, 12),
    ),
    (
        "جدولة صيانة المركبات",
        "Schedule Vehicle Maintenance",
        "Lt. Mona",
        Task.Priority.LOW,
        Task.Status.OPEN,
        2,
        date(2026, 6, 20),
    ),
    (
        "تحديث لوحة الحالة العامة",
        "Update Public Status Board",
        "Cpl. Yousef",
        Task.Priority.LOW,
        Task.Status.CLOSED,
        1,
        date(2026, 5, 25),
    ),
    (
        "تنسيق التدريب الميداني",
        "Coordinate Field Drill",
        "Maj. Salma",
        Task.Priority.HIGH,
        Task.Status.ACTIVE,
        3,
        date(2026, 6, 8),
    ),
]


class Command(BaseCommand):
    help = "Seed operations board tasks."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, assignee, priority, status, clazz, due in TASKS:
            _, made = Task.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "assignee": assignee,
                    "priority": priority,
                    "status": status,
                    "classification": clazz,
                    "due_date": due,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(TASKS)} operations tasks ({created} new).")
        )
