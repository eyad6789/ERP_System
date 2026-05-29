from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Risk


class RiskListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Risk
        fields = [
            "id",
            "title_ar",
            "title_en",
            "likelihood",
            "impact",
            "score",
            "status",
            "classification",
        ]


class RiskDetailSerializer(RiskListSerializer):
    class Meta(RiskListSerializer.Meta):
        fields = RiskListSerializer.Meta.fields + ["mitigation", "updated_at"]


class RiskWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user. ``score`` is derived on save,
    so it is read-only and never accepted from the client."""

    class Meta:
        model = Risk
        fields = [
            "title_ar",
            "title_en",
            "likelihood",
            "impact",
            "status",
            "mitigation",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value

    def validate_likelihood(self, value: int) -> int:
        if not 1 <= value <= 5:
            raise serializers.ValidationError("likelihood must be an integer 1-5.")
        return value

    def validate_impact(self, value: int) -> int:
        if not 1 <= value <= 5:
            raise serializers.ValidationError("impact must be an integer 1-5.")
        return value
