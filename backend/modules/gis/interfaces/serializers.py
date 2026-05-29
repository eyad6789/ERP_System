from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Site


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = [
            "id",
            "name_ar",
            "name_en",
            "site_type",
            "lat",
            "lng",
            "info_ar",
            "info_en",
            "classification",
        ]
