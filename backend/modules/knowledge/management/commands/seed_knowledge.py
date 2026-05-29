"""Seed classified knowledge-base articles across categories and classifications.
Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.knowledge.infrastructure.models import Article

# title_ar, title_en, body, category, classification
ARTICLES = [
    (
        "بروتوكول الاستجابة للطوارئ",
        "Emergency Response Protocol",
        "Step-by-step procedures for facility-wide emergency coordination and escalation.",
        "Operations",
        4,
    ),
    (
        "دليل تصنيف البيانات",
        "Data Classification Guide",
        "Definitions and handling rules for each clearance level across all modules.",
        "Security",
        4,
    ),
    (
        "إجراءات إدارة الأصول الميدانية",
        "Field Asset Management Procedures",
        "How to register, transfer, and decommission field assets in the inventory.",
        "Operations",
        3,
    ),
    (
        "سياسة الموارد البشرية",
        "Human Resources Policy",
        "Onboarding, leave, and conduct policy applicable to all personnel.",
        "HR",
        2,
    ),
    (
        "دليل بدء استخدام النظام",
        "System Onboarding Guide",
        "First-login walkthrough covering navigation, modules, and support channels.",
        "IT",
        2,
    ),
    (
        "الأسئلة الشائعة العامة",
        "General FAQ",
        "Frequently asked questions about access, accounts, and common workflows.",
        "General",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified knowledge-base articles with categories and classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, body, category, clazz in ARTICLES:
            _, made = Article.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "body": body,
                    "category": category,
                    "classification": clazz,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(ARTICLES)} articles ({created} new)."))
