"""GIS ORM models: Site (a classified geographic location with coordinates).

Sites above the viewer's clearance are excluded server-side from every query
(the FILTER pattern), so an uncleared caller never learns they exist.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Site(models.Model):
    class SiteType(models.TextChoices):
        FACILITY = "facility", "Facility"
        UNIT = "unit", "Unit"
        ASSET = "asset", "Asset"

    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    site_type = models.CharField(max_length=20, choices=SiteType.choices)
    lat = models.FloatField()
    lng = models.FloatField()
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    info_ar = models.CharField(max_length=300, blank=True)
    info_en = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "gis_site"
        ordering = ["-classification", "name_en"]

    def __str__(self) -> str:
        return self.name_en
