"""Seed the 4 demo roles + one user per role, mirroring the prototype ROLES map.

Idempotent: safe to run repeatedly. Demo passwords are intentionally simple and
printed once; this command is for the demo environment only.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.iam.domain.entities import ClearanceLevel
from modules.iam.infrastructure.models import Role, User

ALL_MODULES = [
    "dashboard",
    "personnel",
    "documents",
    "finance",
    "operations",
    "assets",
    "gis",
    "incidents",
    "audit",
    "projects",
    "procurement",
    "inventory",
    "fleet",
    "risk",
    "knowledge",
    "attendance",
    "leave",
    "payroll",
    "helpdesk",
    "compliance",
    "meetings",
    "recruitment",
    "performance",
    "training",
    "contracts",
    "announcements",
    "events",
]

ROLES: list[dict[str, Any]] = [
    {
        "code": "sysadmin",
        "name_ar": "مدير النظام",
        "name_en": "System Administrator",
        "modules": ALL_MODULES,
        "clearance": ClearanceLevel.TOP_SECRET,
    },
    {
        "code": "ops",
        "name_ar": "ضابط عمليات",
        "name_en": "Operations Officer",
        "modules": ALL_MODULES,
        "clearance": ClearanceLevel.SECRET,
    },
    {
        "code": "analyst",
        "name_ar": "محلل",
        "name_en": "Analyst",
        "modules": ["dashboard", "documents", "finance", "gis", "incidents"],
        "clearance": ClearanceLevel.RESTRICTED,
    },
    {
        "code": "hr",
        "name_ar": "موارد بشرية",
        "name_en": "Human Resources",
        "modules": ["dashboard", "personnel", "documents"],
        "clearance": ClearanceLevel.RESTRICTED,
    },
]

# one demo user per role (username -> role code), password is the username + "-demo-12345"
DEMO_USERS = [
    ("admin", "sysadmin", "Operations", "مدير", "Admin"),
    ("officer", "ops", "Operations", "ضابط", "Officer"),
    ("analyst", "analyst", "Intelligence", "محلل", "Analyst"),
    ("hr1", "hr", "HR", "موظف", "HR Staff"),
]


class Command(BaseCommand):
    help = "Seed demo roles and users."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        roles: dict[str, Role] = {}
        for spec in ROLES:
            role, _ = Role.objects.update_or_create(
                code=spec["code"],
                defaults={
                    "name_ar": spec["name_ar"],
                    "name_en": spec["name_en"],
                    "modules": spec["modules"],
                    "clearance": int(spec["clearance"]),
                },
            )
            roles[role.code] = role

        for username, role_code, dept, name_ar, name_en in DEMO_USERS:
            role = roles[role_code]
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "role": role,
                    "clearance": role.clearance,
                    "department": dept,
                    "full_name_ar": name_ar,
                    "full_name_en": name_en,
                    "is_staff": role_code == "sysadmin",
                    "is_superuser": role_code == "sysadmin",
                },
            )
            if created:
                user.set_password(f"{username}-demo-12345")
                user.save()

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {len(roles)} roles and {len(DEMO_USERS)} demo users.")
        )
