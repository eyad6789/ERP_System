"""Seed classified support tickets across priorities, statuses and
classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.helpdesk.infrastructure.models import Ticket

# title_ar, title_en, requester, priority, status, classification
TICKETS = [
    (
        "تعطّل بوابة الاتصالات المشفّرة",
        "Encrypted Comms Gateway Outage",
        "ops.command",
        Ticket.Priority.HIGH,
        Ticket.Status.IN_PROGRESS,
        4,
    ),
    (
        "طلب وصول إلى الأرشيف السرّي",
        "Classified Archive Access Request",
        "analyst.k",
        Ticket.Priority.HIGH,
        Ticket.Status.OPEN,
        3,
    ),
    (
        "بطء في خادم اللوجستيات",
        "Logistics Server Slowness",
        "logistics.team",
        Ticket.Priority.MEDIUM,
        Ticket.Status.OPEN,
        2,
    ),
    (
        "إعادة تعيين كلمة المرور",
        "Password Reset",
        "field.user",
        Ticket.Priority.LOW,
        Ticket.Status.RESOLVED,
        2,
    ),
    (
        "تحديث برمجية المحطة الطرفية",
        "Workstation Software Update",
        "support.desk",
        Ticket.Priority.LOW,
        Ticket.Status.CLOSED,
        1,
    ),
    (
        "طلب طابعة جديدة للاستقبال",
        "New Printer Request for Reception",
        "front.desk",
        Ticket.Priority.MEDIUM,
        Ticket.Status.OPEN,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified support tickets with priorities and statuses."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, requester, priority, status, clazz in TICKETS:
            _, made = Ticket.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "requester": requester,
                    "priority": priority,
                    "status": status,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(TICKETS)} tickets ({created} new)."))
