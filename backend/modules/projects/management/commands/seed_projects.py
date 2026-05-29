"""Seed classified projects across statuses and classifications. Idempotent."""

from __future__ import annotations

from datetime import date
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.projects.infrastructure.models import Project

# name_ar, name_en, status, progress, start_date, end_date, classification, lead
PROJECTS = [
    (
        "تحديث الشبكة الآمنة",
        "Secure Network Overhaul",
        Project.Status.ACTIVE,
        60,
        date(2026, 1, 15),
        date(2026, 9, 30),
        4,
        "Col. Hadid",
    ),
    (
        "منصة الاستخبارات الموحدة",
        "Unified Intelligence Platform",
        Project.Status.PLANNING,
        10,
        date(2026, 4, 1),
        None,
        4,
        "Maj. Saleh",
    ),
    (
        "تطوير مركز العمليات",
        "Operations Center Upgrade",
        Project.Status.ON_HOLD,
        35,
        date(2025, 11, 1),
        date(2026, 6, 30),
        3,
        "Eng. Noor",
    ),
    (
        "بوابة الخدمات اللوجستية",
        "Logistics Services Portal",
        Project.Status.ACTIVE,
        80,
        date(2026, 2, 10),
        date(2026, 7, 15),
        2,
        "Eng. Karim",
    ),
    (
        "نظام إدارة الأرشيف",
        "Archive Management System",
        Project.Status.DONE,
        100,
        date(2025, 6, 1),
        date(2026, 1, 20),
        2,
        "Ms. Lina",
    ),
    (
        "تجديد البوابة العامة",
        "Public Gateway Refresh",
        Project.Status.PLANNING,
        5,
        date(2026, 5, 1),
        None,
        1,
        "Mr. Omar",
    ),
]


class Command(BaseCommand):
    help = "Seed classified projects with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for name_ar, name_en, status, progress, start, end, clazz, lead in PROJECTS:
            _, made = Project.objects.update_or_create(
                name_en=name_en,
                defaults={
                    "name_ar": name_ar,
                    "status": status,
                    "progress": progress,
                    "start_date": start,
                    "end_date": end,
                    "classification": clazz,
                    "lead": lead,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(PROJECTS)} projects ({created} new)."))
