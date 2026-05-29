"""Seed departments + personnel (mirrors the prototype roster). Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.personnel.infrastructure.models import Department, Person

DEPARTMENTS = [
    ("OPS", "العمليات", "Operations", None),
    ("INT", "الاستخبارات", "Intelligence", "OPS"),
    ("LOG", "اللوجستيات", "Logistics", "OPS"),
    ("IT", "تقنية المعلومات", "IT", None),
    ("HR", "الموارد البشرية", "Human Resources", None),
]

# name_ar, name_en, rank_ar, rank_en, dept, classification, status, attendance, year, contract
PEOPLE = [
    ("عمر الحربي", "Omar Al-Harbi", "عقيد", "Colonel", "OPS", 4, "active", 98, 2009, "permanent"),
    (
        "ليلى ناصر",
        "Layla Nasser",
        "مقدم",
        "Lt. Colonel",
        "INT",
        3,
        "mission",
        95,
        2012,
        "permanent",
    ),
    ("سامي خالد", "Sami Khaled", "رائد", "Major", "INT", 3, "active", 92, 2014, "permanent"),
    ("هدى مراد", "Huda Murad", "نقيب", "Captain", "OPS", 2, "active", 90, 2016, "permanent"),
    ("بلال يوسف", "Bilal Yousef", "نقيب", "Captain", "LOG", 2, "leave", 88, 2017, "permanent"),
    (
        "ريم العتيبي",
        "Reem Al-Otaibi",
        "ملازم",
        "Lieutenant",
        "IT",
        2,
        "active",
        96,
        2019,
        "contract",
    ),
    ("ماجد فهد", "Majed Fahad", "ملازم", "Lieutenant", "LOG", 2, "active", 91, 2020, "contract"),
    ("نورة سالم", "Noura Salem", "موظف", "Staff", "HR", 2, "active", 99, 2018, "permanent"),
    ("طارق وليد", "Tariq Walid", "فني", "Technician", "IT", 1, "active", 94, 2021, "contract"),
    ("أمل حسن", "Amal Hassan", "موظف", "Staff", "HR", 1, "active", 97, 2022, "contract"),
]


class Command(BaseCommand):
    help = "Seed departments and personnel."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        depts: dict[str, Department] = {}
        # First pass: create without parents.
        for code, ar, en, _parent in DEPARTMENTS:
            depts[code], _ = Department.objects.update_or_create(
                code=code, defaults={"name_ar": ar, "name_en": en}
            )
        # Second pass: wire parents.
        for code, _ar, _en, parent in DEPARTMENTS:
            if parent:
                depts[code].parent = depts[parent]
                depts[code].save(update_fields=["parent"])

        for ar, en, rank_ar, rank_en, dept, clazz, status, att, year, contract in PEOPLE:
            Person.objects.update_or_create(
                name_en=en,
                defaults={
                    "name_ar": ar,
                    "rank_ar": rank_ar,
                    "rank_en": rank_en,
                    "department": depts[dept],
                    "classification": clazz,
                    "status": status,
                    "attendance": att,
                    "joined_year": year,
                    "contract_type": contract,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(DEPARTMENTS)} departments and {len(PEOPLE)} people.")
        )
