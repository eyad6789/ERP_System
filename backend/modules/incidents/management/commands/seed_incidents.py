"""Seed incident reports with a spread of severity/status/classification. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.incidents.infrastructure.models import Incident

# title_ar, title_en, severity, status, reported_date, classification
INCIDENTS = [
    (
        "اختراق محتمل لقاعدة البيانات",
        "Suspected Database Breach",
        "critical",
        "active",
        "2026-05-20",
        4,
    ),
    (
        "انقطاع الاتصالات الميدانية",
        "Field Communications Outage",
        "high",
        "open",
        "2026-05-22",
        3,
    ),
    (
        "محاولة دخول غير مصرّح به",
        "Unauthorized Access Attempt",
        "high",
        "open",
        "2026-05-25",
        2,
    ),
    (
        "عطل في نظام الإنذار العام",
        "Public Alarm System Fault",
        "medium",
        "closed",
        "2026-05-10",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed incident reports with varied severity, status, and classification."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, severity, status, reported_date, clazz in INCIDENTS:
            _, made = Incident.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "severity": severity,
                    "status": status,
                    "reported_date": reported_date,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(INCIDENTS)} incidents ({created} new)."))
