"""Seed classified applicants across stages and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.recruitment.infrastructure.models import Applicant

# name, position, email, stage, classification
APPLICANTS = [
    (
        "عبدالله الراشد",
        "Intelligence Analyst",
        "a.alrashed@example.gov",
        Applicant.Stage.INTERVIEW,
        4,
    ),
    (
        "فاطمة الزهراني",
        "Cryptography Engineer",
        "f.alzahrani@example.gov",
        Applicant.Stage.OFFER,
        4,
    ),
    (
        "خالد المطيري",
        "Field Operations Officer",
        "k.almutairi@example.gov",
        Applicant.Stage.SCREENING,
        3,
    ),
    (
        "نورة العتيبي",
        "Logistics Coordinator",
        "n.alotaibi@example.gov",
        Applicant.Stage.APPLIED,
        2,
    ),
    (
        "سعد القحطاني",
        "Systems Administrator",
        "s.alqahtani@example.gov",
        Applicant.Stage.HIRED,
        2,
    ),
    (
        "ريم الدوسري",
        "Front Desk Receptionist",
        "r.aldosari@example.com",
        Applicant.Stage.REJECTED,
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified applicants with stages and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for name, position, email, stage, clazz in APPLICANTS:
            _, made = Applicant.objects.update_or_create(
                name=name,
                position=position,
                defaults={
                    "email": email,
                    "stage": stage,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(APPLICANTS)} applicants ({created} new).")
        )
