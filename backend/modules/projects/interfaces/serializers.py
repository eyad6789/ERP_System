from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Project


class ProjectListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name_ar",
            "name_en",
            "status",
            "progress",
            "start_date",
            "end_date",
            "classification",
            "lead",
        ]


class ProjectDetailSerializer(ProjectListSerializer):
    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + ["updated_at"]


class ProjectWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = Project
        fields = [
            "name_ar",
            "name_en",
            "status",
            "progress",
            "start_date",
            "end_date",
            "classification",
            "lead",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value

    def validate_progress(self, value: int) -> int:
        if not 0 <= value <= 100:
            raise serializers.ValidationError("progress must be between 0 and 100.")
        return value
