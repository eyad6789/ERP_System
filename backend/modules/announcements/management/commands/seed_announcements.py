"""Seed classified announcements across audiences and classifications. Idempotent."""

from __future__ import annotations

from datetime import date
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.announcements.infrastructure.models import Announcement

# title_ar, title_en, body, audience, published_date, classification
ANNOUNCEMENTS = [
    (
        "إعادة هيكلة العمليات السرية",
        "Covert Operations Restructuring",
        "تفاصيل إعادة تنظيم الوحدات الميدانية فائقة السرية.",
        "Command Staff",
        date(2026, 1, 12),
        4,
    ),
    (
        "تحديث بروتوكول التشفير",
        "Encryption Protocol Update",
        "Rotation of classified comms keys is mandatory this quarter.",
        "Operations Wing",
        date(2026, 2, 3),
        4,
    ),
    (
        "جدول التدريب الميداني",
        "Field Training Schedule",
        "Restricted briefing on the upcoming reconnaissance exercise.",
        "Field Teams",
        date(2026, 2, 20),
        3,
    ),
    (
        "صيانة مولّدات الطاقة",
        "Power Generator Maintenance",
        "Scheduled maintenance window for backup generators next week.",
        "Facilities",
        date(2026, 3, 5),
        2,
    ),
    (
        "تحديث سياسة الأرشفة",
        "Archiving Policy Update",
        "Internal records retention policy has been revised.",
        "All Staff",
        date(2026, 3, 18),
        2,
    ),
    (
        "حفل تكريم الموظفين",
        "Staff Recognition Ceremony",
        "Public announcement of the annual staff recognition event.",
        "All Staff",
        date(2026, 4, 1),
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified announcements with audiences and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, body, audience, published_date, clazz in ANNOUNCEMENTS:
            _, made = Announcement.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "body": body,
                    "audience": audience,
                    "published_date": published_date,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(ANNOUNCEMENTS)} announcements ({created} new).")
        )
