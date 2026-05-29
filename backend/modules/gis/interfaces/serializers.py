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


class SiteWriteSerializer(serializers.ModelSerializer):
    """Write payload for create/update. Classification is constrained to a valid
    clearance band (1-4); the caller's own clearance ceiling is enforced in the
    view, not here."""

    class Meta:
        model = Site
        fields = [
            "name_ar",
            "name_en",
            "site_type",
            "lat",
            "lng",
            "info_ar",
            "info_en",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if not 1 <= value <= 4:
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
