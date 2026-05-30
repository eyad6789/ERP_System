from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import ContractRecord


class ContractListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractRecord
        fields = [
            "id",
            "title_ar",
            "title_en",
            "party",
            "value",
            "start_date",
            "end_date",
            "status",
            "classification",
        ]


class ContractDetailSerializer(ContractListSerializer):
    class Meta(ContractListSerializer.Meta):
        fields = ContractListSerializer.Meta.fields + ["updated_at"]


class ContractWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = ContractRecord
        fields = [
            "title_ar",
            "title_en",
            "party",
            "value",
            "start_date",
            "end_date",
            "status",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
