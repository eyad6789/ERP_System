"""Seed the entire demo dataset in dependency order (idempotent).

Runs every module's seed command so the demo comes up fully populated with
realistic bilingual data across all modules.
"""
from __future__ import annotations

from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand

SEEDS = [
    "seed_demo",  # roles + users (must run first)
    "seed_personnel",
    "seed_documents",
    "seed_finance",
    "seed_gis",
    "seed_operations",
    "seed_assets",
    "seed_incidents",
]


class Command(BaseCommand):
    help = "Seed all demo data (roles, users, and every module)."

    def handle(self, *args: Any, **options: Any) -> None:
        for name in SEEDS:
            self.stdout.write(self.style.NOTICE(f"→ {name}"))
            call_command(name)
        self.stdout.write(self.style.SUCCESS("All demo data seeded."))
