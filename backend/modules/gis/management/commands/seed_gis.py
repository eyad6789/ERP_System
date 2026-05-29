"""Seed GIS sites across Iraq with mixed types and classifications. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.gis.infrastructure.models import Site

# name_ar, name_en, site_type, lat, lng, classification, info_en
SITES = [
    (
        "القيادة المركزية - بغداد",
        "Central Command - Baghdad",
        Site.SiteType.FACILITY,
        33.31,
        44.36,
        4,
        "Top-secret central command headquarters.",
    ),
    (
        "ميناء البصرة اللوجستي",
        "Basra Logistics Port",
        Site.SiteType.FACILITY,
        30.51,
        47.78,
        2,
        "Restricted southern logistics and supply port.",
    ),
    (
        "وحدة الموصل الميدانية",
        "Mosul Field Unit",
        Site.SiteType.UNIT,
        36.34,
        43.13,
        3,
        "Secret forward field unit in the north.",
    ),
    (
        "مركز أربيل الإقليمي",
        "Erbil Regional Center",
        Site.SiteType.FACILITY,
        36.19,
        44.01,
        2,
        "Restricted regional coordination center.",
    ),
    (
        "محطة النجف العامة",
        "Najaf Public Station",
        Site.SiteType.ASSET,
        31.99,
        44.33,
        1,
        "Public information and service station.",
    ),
    (
        "أصل كركوك الاستراتيجي",
        "Kirkuk Strategic Asset",
        Site.SiteType.ASSET,
        35.47,
        44.39,
        4,
        "Top-secret strategic energy asset.",
    ),
    (
        "وحدة الرمادي الميدانية",
        "Ramadi Field Unit",
        Site.SiteType.UNIT,
        33.42,
        43.30,
        3,
        "Secret western field unit.",
    ),
]


class Command(BaseCommand):
    help = "Seed GIS sites across Iraq with a spread of classifications."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for name_ar, name_en, site_type, lat, lng, clazz, info in SITES:
            _, made = Site.objects.update_or_create(
                name_en=name_en,
                defaults={
                    "name_ar": name_ar,
                    "site_type": site_type,
                    "lat": lat,
                    "lng": lng,
                    "classification": clazz,
                    "info_ar": info,
                    "info_en": info,
                },
            )
            created += int(made)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SITES)} sites ({created} new)."))
