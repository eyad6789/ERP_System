"""Seed the entire demo dataset in dependency order (idempotent).

Runs every module's seed command so the demo comes up fully populated with
realistic bilingual data across all modules. Each underlying seed uses
update_or_create / get_or_create, so re-running is safe. A failure in one module
is reported but does not abort the rest.

    python manage.py seed_all
"""

from __future__ import annotations

from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand

# Order matters: roles/users first, then the org (departments/people) that the
# HR-style modules reference, then everything else.
SEEDS = [
    "seed_demo",  # roles + users (must run first)
    "seed_personnel",  # departments + people
    "seed_gis",
    "seed_documents",
    "seed_finance",
    "seed_operations",
    "seed_assets",
    "seed_incidents",
    "seed_projects",
    "seed_procurement",
    "seed_inventory",
    "seed_fleet",
    "seed_risk",
    "seed_knowledge",
    "seed_attendance",
    "seed_leave",
    "seed_payroll",
    "seed_helpdesk",
    "seed_compliance",
    "seed_meetings",
    "seed_recruitment",
    "seed_performance",
    "seed_training",
    "seed_contracts",
    "seed_announcements",
    "seed_events",
    "seed_workspaces",
]


class Command(BaseCommand):
    help = "Seed all demo data (roles, users, and every module)."

    def handle(self, *args: Any, **options: Any) -> None:
        ok, failed = 0, []
        for name in SEEDS:
            self.stdout.write(self.style.NOTICE(f"→ {name}"))
            try:
                call_command(name, verbosity=0)
                ok += 1
            except Exception as exc:  # noqa: BLE001 - report and keep going
                failed.append(name)
                self.stdout.write(self.style.ERROR(f"  ✗ {name}: {exc}"))

        self.stdout.write(self.style.SUCCESS(f"All demo data seeded: {ok}/{len(SEEDS)} ok."))
        if failed:
            self.stdout.write(self.style.WARNING(f"Failed: {', '.join(failed)}"))
