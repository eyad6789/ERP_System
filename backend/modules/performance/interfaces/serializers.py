from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import PerformanceReview


class PerformanceReviewListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "employee",
            "period",
            "score",
            "rating",
            "classification",
        ]


class PerformanceReviewDetailSerializer(PerformanceReviewListSerializer):
    class Meta(PerformanceReviewListSerializer.Meta):
        fields = PerformanceReviewListSerializer.Meta.fields + ["notes", "updated_at"]


class PerformanceReviewWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = PerformanceReview
        fields = [
            "employee",
            "period",
            "score",
            "rating",
            "notes",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value

    def validate_score(self, value: int) -> int:
        if not 0 <= value <= 100:
            raise serializers.ValidationError("score must be between 0 and 100.")
        return value
