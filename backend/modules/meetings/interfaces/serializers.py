from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Meeting


class MeetingListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meeting
        fields = [
            "id",
            "title_ar",
            "title_en",
            "start_at",
            "end_at",
            "location",
            "status",
            "classification",
        ]


class MeetingDetailSerializer(MeetingListSerializer):
    class Meta(MeetingListSerializer.Meta):
        fields = MeetingListSerializer.Meta.fields + ["updated_at"]


class MeetingWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = Meeting
        fields = [
            "title_ar",
            "title_en",
            "start_at",
            "end_at",
            "location",
            "status",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
