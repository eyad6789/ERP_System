"""Seed classified meetings across statuses and classifications. Idempotent
(update_or_create keyed on title_en)."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from modules.meetings.infrastructure.models import Meeting

_NOW = timezone.now().replace(minute=0, second=0, microsecond=0)

# title_ar, title_en, location, status, classification, start offset (hours), duration (hours)
MEETINGS = [
    (
        "إحاطة القيادة الاستراتيجية",
        "Strategic Command Briefing",
        "Secure Room A",
        Meeting.Status.SCHEDULED,
        4,
        24,
        2,
    ),
    (
        "مراجعة العمليات السرية",
        "Covert Operations Review",
        "Operations Wing",
        Meeting.Status.SCHEDULED,
        4,
        48,
        1,
    ),
    (
        "اجتماع تنسيق الميدان",
        "Field Coordination Meeting",
        "Briefing Hall 2",
        Meeting.Status.DONE,
        3,
        -72,
        2,
    ),
    (
        "لجنة الميزانية الفصلية",
        "Quarterly Budget Committee",
        "Conference Room 1",
        Meeting.Status.SCHEDULED,
        2,
        72,
        3,
    ),
    (
        "مراجعة اللوجستيات الأسبوعية",
        "Weekly Logistics Review",
        "Logistics Office",
        Meeting.Status.CANCELLED,
        2,
        -24,
        1,
    ),
    (
        "إحاطة الموظفين العامة",
        "General Staff Briefing",
        "Main Auditorium",
        Meeting.Status.SCHEDULED,
        1,
        96,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified meetings with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, location, status, clazz, start_offset, duration in MEETINGS:
            start_at = _NOW + timedelta(hours=start_offset)
            _, made = Meeting.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "start_at": start_at,
                    "end_at": start_at + timedelta(hours=duration),
                    "location": location,
                    "status": status,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(MEETINGS)} meetings ({created} new)."))
