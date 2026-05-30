from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Applicant


class ApplicantListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Applicant
        fields = [
            "id",
            "name",
            "position",
            "email",
            "stage",
            "classification",
        ]


class ApplicantDetailSerializer(ApplicantListSerializer):
    class Meta(ApplicantListSerializer.Meta):
        fields = ApplicantListSerializer.Meta.fields + ["updated_at"]


class ApplicantWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = Applicant
        fields = [
            "name",
            "position",
            "email",
            "stage",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
