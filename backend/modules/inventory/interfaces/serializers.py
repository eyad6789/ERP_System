from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import InventoryItem


class InventoryItemListSerializer(serializers.ModelSerializer):
    warehouse = serializers.CharField(source="warehouse.name_en", read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "sku",
            "name_ar",
            "name_en",
            "quantity",
            "unit",
            "warehouse",
            "classification",
        ]


class InventoryItemDetailSerializer(InventoryItemListSerializer):
    class Meta(InventoryItemListSerializer.Meta):
        fields = InventoryItemListSerializer.Meta.fields + ["updated_at"]


class InventoryItemWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = InventoryItem
        fields = [
            "sku",
            "name_ar",
            "name_en",
            "quantity",
            "unit",
            "warehouse",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
