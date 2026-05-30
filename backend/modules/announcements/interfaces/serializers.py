from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Announcement


class AnnouncementListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = [
            "id",
            "title_ar",
            "title_en",
            "body",
            "audience",
            "published_date",
            "classification",
        ]


class AnnouncementDetailSerializer(AnnouncementListSerializer):
    class Meta(AnnouncementListSerializer.Meta):
        fields = AnnouncementListSerializer.Meta.fields + ["updated_at"]


class AnnouncementWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = Announcement
        fields = [
            "title_ar",
            "title_en",
            "body",
            "audience",
            "published_date",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
