from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Asset


class AssetListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id",
            "name_ar",
            "name_en",
            "asset_type",
            "location",
            "condition",
            "classification",
        ]


class AssetDetailSerializer(AssetListSerializer):
    class Meta(AssetListSerializer.Meta):
        fields = AssetListSerializer.Meta.fields + ["updated_at"]
