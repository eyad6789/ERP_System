"""Seed classified documents + version history (mirrors the prototype). Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.documents.infrastructure.models import Document, DocumentVersion
from modules.iam.infrastructure.models import User

# title_ar, title_en, classification, version, body_en
DOCS = [
    (
        "الخطة الاستراتيجية 2030",
        "Strategic Plan 2030",
        4,
        3,
        "Top-secret long-range strategy. Distribution restricted to clearance 4.",
    ),
    (
        "بروتوكول الاتصالات المشفّرة",
        "Encrypted Comms Protocol",
        4,
        2,
        "Key-exchange and channel hardening procedures.",
    ),
    (
        "تقرير الاستخبارات الفصلي",
        "Quarterly Intelligence Report",
        3,
        4,
        "Secret assessment of regional activity for the quarter.",
    ),
    (
        "خطة العمليات الميدانية",
        "Field Operations Plan",
        3,
        2,
        "Secret operational tasking and coordination plan.",
    ),
    (
        "دليل إجراءات اللوجستيات",
        "Logistics Procedures Manual",
        2,
        5,
        "Restricted standard operating procedures for logistics.",
    ),
    (
        "سياسة الموارد البشرية",
        "HR Policy Handbook",
        2,
        6,
        "Restricted personnel policies and entitlements.",
    ),
    (
        "تقرير جاهزية الأصول",
        "Asset Readiness Report",
        2,
        1,
        "Restricted snapshot of fleet and equipment readiness.",
    ),
    (
        "النشرة الإعلامية العامة",
        "Public Bulletin",
        1,
        1,
        "Public information bulletin for general circulation.",
    ),
]


class Command(BaseCommand):
    help = "Seed classified documents and version history."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        owner = User.objects.filter(username="admin").first() or User.objects.first()
        created = 0
        for title_ar, title_en, clazz, version, body in DOCS:
            doc, made = Document.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "classification": clazz,
                    "version": version,
                    "body": body,
                    "owner": owner,
                },
            )
            created += int(made)
            for n in range(1, version + 1):
                DocumentVersion.objects.update_or_create(
                    document=doc,
                    number=n,
                    defaults={
                        "note_ar": f"تحديث النسخة {n}",
                        "note_en": f"Revision {n}",
                        "author": owner,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(DOCS)} documents ({created} new) with versions.")
        )
