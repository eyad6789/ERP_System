"""Seed classified risks across statuses and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.risk.infrastructure.models import Risk

# title_ar, title_en, likelihood, impact, status, mitigation, classification
RISKS = [
    (
        "اختراق شبكة العمليات السرية",
        "Covert Network Breach",
        5,
        5,
        Risk.Status.MITIGATING,
        "Segment the network and rotate credentials weekly.",
        4,
    ),
    (
        "تسريب بيانات الاستخبارات",
        "Intelligence Data Leak",
        4,
        5,
        Risk.Status.OPEN,
        "Enforce DLP controls on all classified endpoints.",
        4,
    ),
    (
        "تعطل مركز البيانات الإقليمي",
        "Regional Data Center Outage",
        3,
        4,
        Risk.Status.MITIGATING,
        "Provision a hot standby site with automatic failover.",
        3,
    ),
    (
        "نقص قطع الغيار اللوجستية",
        "Logistics Spare Parts Shortage",
        3,
        3,
        Risk.Status.OPEN,
        "Diversify suppliers and raise safety stock levels.",
        2,
    ),
    (
        "تأخر صيانة المركبات",
        "Vehicle Maintenance Backlog",
        2,
        2,
        Risk.Status.CLOSED,
        "Completed scheduled overhaul of the motor pool.",
        2,
    ),
    (
        "انقطاع التيار في المكاتب العامة",
        "Public Office Power Disruption",
        2,
        1,
        Risk.Status.OPEN,
        "Install uninterruptible power supplies at reception.",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified risks with statuses and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, likelihood, impact, status, mitigation, clazz in RISKS:
            _, made = Risk.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "likelihood": likelihood,
                    "impact": impact,
                    "status": status,
                    "mitigation": mitigation,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(RISKS)} risks ({created} new)."))
