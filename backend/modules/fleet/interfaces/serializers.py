from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Vehicle


class VehicleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            "id",
            "plate",
            "vtype",
            "make",
            "status",
            "odometer",
            "classification",
        ]


class VehicleDetailSerializer(VehicleListSerializer):
    class Meta(VehicleListSerializer.Meta):
        fields = VehicleListSerializer.Meta.fields + ["updated_at"]


class VehicleWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = Vehicle
        fields = [
            "plate",
            "vtype",
            "make",
            "status",
            "odometer",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
