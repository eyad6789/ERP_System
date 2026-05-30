"""Seed classified events across types and classifications. Idempotent."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from modules.events.infrastructure.models import Event

_NOW = timezone.now().replace(minute=0, second=0, microsecond=0)

# title_ar, title_en, start_offset_days, duration_hours, event_type, location, classification
EVENTS = [
    (
        "إحاطة العمليات السرّية",
        "Covert Operations Briefing",
        1,
        2,
        Event.EventType.OPERATION,
        "Operations Wing",
        4,
    ),
    (
        "موعد تسليم التقرير الاستخباراتي",
        "Intelligence Report Deadline",
        3,
        1,
        Event.EventType.DEADLINE,
        "HQ",
        4,
    ),
    (
        "اجتماع مجلس الإدارة",
        "Board Meeting",
        2,
        3,
        Event.EventType.MEETING,
        "Boardroom A",
        3,
    ),
    (
        "مراجعة الميزانية الفصلية",
        "Quarterly Budget Review",
        5,
        2,
        Event.EventType.MEETING,
        "Finance Suite",
        2,
    ),
    (
        "موعد تسليم طلبات التوريد",
        "Procurement Submission Deadline",
        7,
        1,
        Event.EventType.DEADLINE,
        "Supply Office",
        2,
    ),
    (
        "عطلة اليوم الوطني",
        "National Day Holiday",
        10,
        24,
        Event.EventType.HOLIDAY,
        "",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified events with types and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, start_days, hours, event_type, location, clazz in EVENTS:
            start_at = _NOW + timedelta(days=start_days)
            _, made = Event.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "start_at": start_at,
                    "end_at": start_at + timedelta(hours=hours),
                    "event_type": event_type,
                    "location": location,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(EVENTS)} events ({created} new)."))
