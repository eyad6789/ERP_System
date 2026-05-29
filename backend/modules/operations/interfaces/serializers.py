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
