"""Seed classified training courses across statuses and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.training.infrastructure.models import TrainingCourse

# title_ar, title_en, category, hours, status, classification
COURSES = [
    (
        "عمليات الأمن السيبراني المتقدمة",
        "Advanced Cyber Operations",
        "Security",
        40,
        TrainingCourse.Status.UPCOMING,
        4,
    ),
    (
        "التعامل مع الاتصالات المشفّرة",
        "Encrypted Communications Handling",
        "Communications",
        24,
        TrainingCourse.Status.ONGOING,
        4,
    ),
    (
        "تكتيكات الاستطلاع الميداني",
        "Field Reconnaissance Tactics",
        "Operations",
        32,
        TrainingCourse.Status.ONGOING,
        3,
    ),
    (
        "إدارة سلاسل الإمداد",
        "Supply Chain Management",
        "Logistics",
        16,
        TrainingCourse.Status.COMPLETED,
        2,
    ),
    (
        "أساسيات الإسعافات الأولية",
        "First Aid Fundamentals",
        "Safety",
        8,
        TrainingCourse.Status.COMPLETED,
        2,
    ),
    (
        "توجيه الموظفين الجدد",
        "New Staff Orientation",
        "Onboarding",
        4,
        TrainingCourse.Status.UPCOMING,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified training courses with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, category, hours, status, clazz in COURSES:
            _, made = TrainingCourse.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "category": category,
                    "hours": hours,
                    "status": status,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(COURSES)} courses ({created} new)."))
