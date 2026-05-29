from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "title_ar",
            "title_en",
            "assignee",
            "priority",
            "due_date",
            "status",
            "classification",
            "updated_at",
        ]


class TaskWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Enforces classification in 1..4."""

    class Meta:
        model = Task
        fields = [
            "title_ar",
            "title_en",
            "assignee",
            "priority",
            "due_date",
            "status",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 4:
            raise serializers.ValidationError("Classification must be an integer 1-4.")
        return value
