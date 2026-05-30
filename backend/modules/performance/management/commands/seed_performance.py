"""Seed performance reviews across ratings and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.performance.infrastructure.models import PerformanceReview

# employee, period, score, rating, notes, classification
REVIEWS = [
    (
        "العميد سالم الحربي",
        "2025-H2",
        94,
        PerformanceReview.Rating.OUTSTANDING,
        "أداء استثنائي في قيادة العمليات الحساسة.",
        4,
    ),
    (
        "المقدم نورة القحطاني",
        "2025-H2",
        88,
        PerformanceReview.Rating.OUTSTANDING,
        "Led classified intelligence reviews with distinction.",
        4,
    ),
    (
        "الرائد خالد المطيري",
        "2025-H1",
        76,
        PerformanceReview.Rating.GOOD,
        "أداء جيد مع فرص للتحسين في إدارة الفريق.",
        3,
    ),
    (
        "النقيب ريم الدوسري",
        "2025-H1",
        81,
        PerformanceReview.Rating.GOOD,
        "Solid logistics coordination across units.",
        2,
    ),
    (
        "الموظف فهد العتيبي",
        "2024-H2",
        58,
        PerformanceReview.Rating.NEEDS_IMPROVEMENT,
        "يحتاج إلى تطوير مهارات التوثيق الإداري.",
        2,
    ),
    (
        "الموظفة هند الشمري",
        "2024-H2",
        67,
        PerformanceReview.Rating.NEEDS_IMPROVEMENT,
        "Improving steadily; punctuality flagged for follow-up.",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed performance reviews with ratings and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for employee, period, score, rating, notes, clazz in REVIEWS:
            _, made = PerformanceReview.objects.update_or_create(
                employee=employee,
                period=period,
                defaults={
                    "score": score,
                    "rating": rating,
                    "notes": notes,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(REVIEWS)} performance reviews ({created} new).")
        )
