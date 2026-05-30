"""Seed the 8 Department Workspaces. Idempotent and edit-preserving: rows are
created with ``get_or_create`` keyed on ``key``, so re-running NEVER overwrites a
workspace a department has already customized."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.workspaces.infrastructure.models import Workspace

# key, owner_department, name_en, name_ar, accent_color, description_en,
# description_ar, mission_en, mission_ar, head_name, featured
WORKSPACES = [
    (
        "command",
        "Operations",
        "Command Center",
        "مركز القيادة",
        "#c9a227",
        "Unified situational awareness and cross-department command.",
        "وعي موقفي موحد وقيادة عبر الإدارات.",
        "Maintain a single operational picture across the ministry.",
        "الحفاظ على صورة عملياتية موحدة على مستوى الوزارة.",
        "Gen. Rashid",
        ["dashboard", "reports"],
    ),
    (
        "hr",
        "HR",
        "Human Resources",
        "الموارد البشرية",
        "#6fa8c7",
        "Personnel, recruitment, payroll and workforce development.",
        "شؤون الأفراد والتوظيف والرواتب وتطوير القوى العاملة.",
        "Develop and care for the ministry's people.",
        "تطوير ورعاية كوادر الوزارة.",
        "Ms. Huda",
        ["personnel", "attendance"],
    ),
    (
        "finance",
        "Finance",
        "Finance & Procurement",
        "المالية والمشتريات",
        "#5aa97f",
        "Budgets, accounting, procurement and contracts.",
        "الموازنات والمحاسبة والمشتريات والعقود.",
        "Safeguard public funds and ensure transparent spending.",
        "حماية المال العام وضمان الإنفاق الشفاف.",
        "Mr. Tariq",
        ["budgets", "procurement"],
    ),
    (
        "operations",
        "Operations",
        "Operations & Field",
        "العمليات والميدان",
        "#d6993f",
        "Field operations, logistics and resource deployment.",
        "العمليات الميدانية واللوجستيات ونشر الموارد.",
        "Execute and sustain field operations effectively.",
        "تنفيذ ودعم العمليات الميدانية بفعالية.",
        "Col. Faris",
        ["dispatch", "logistics"],
    ),
    (
        "records",
        "Records",
        "Records & Knowledge",
        "السجلات والمعرفة",
        "#9c958a",
        "Archives, document control and institutional knowledge.",
        "الأرشيف وضبط الوثائق والمعرفة المؤسسية.",
        "Preserve and make accessible the ministry's records.",
        "حفظ سجلات الوزارة وإتاحتها.",
        "Ms. Lina",
        ["documents", "archive"],
    ),
    (
        "service",
        "Service",
        "Service & Engagement",
        "الخدمة والتواصل",
        "#6fa8c7",
        "Citizen services, requests and public engagement.",
        "خدمات المواطنين والطلبات والتواصل العام.",
        "Deliver responsive services to citizens.",
        "تقديم خدمات سريعة الاستجابة للمواطنين.",
        "Mr. Salim",
        ["requests", "support"],
    ),
    (
        "governance",
        "Intelligence",
        "Governance & Security",
        "الحوكمة والأمن",
        "#cf6a5b",
        "Audit, compliance, risk and information security.",
        "التدقيق والامتثال وإدارة المخاطر وأمن المعلومات.",
        "Uphold governance, security and accountability.",
        "ترسيخ الحوكمة والأمن والمساءلة.",
        "Maj. Saleh",
        ["audit", "security"],
    ),
    (
        "platform",
        "IT",
        "Platform & Admin",
        "المنصة والإدارة",
        "#9c958a",
        "Platform administration, integrations and system health.",
        "إدارة المنصة والتكاملات وصحة الأنظمة.",
        "Keep the platform secure, available and well-administered.",
        "إبقاء المنصة آمنة ومتاحة ومُدارة جيداً.",
        "Eng. Noor",
        ["admin", "settings"],
    ),
]


class Command(BaseCommand):
    help = "Seed the 8 Department Workspaces (edit-preserving; keeps existing rows)."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for (
            key,
            owner_department,
            name_en,
            name_ar,
            accent_color,
            description_en,
            description_ar,
            mission_en,
            mission_ar,
            head_name,
            featured,
        ) in WORKSPACES:
            _, made = Workspace.objects.get_or_create(
                key=key,
                defaults={
                    "owner_department": owner_department,
                    "name_en": name_en,
                    "name_ar": name_ar,
                    "accent_color": accent_color,
                    "description_en": description_en,
                    "description_ar": description_ar,
                    "mission_en": mission_en,
                    "mission_ar": mission_ar,
                    "head_name": head_name,
                    "featured": featured,
                },
            )
            created += int(made)

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(WORKSPACES)} workspaces ({created} new).")
        )
