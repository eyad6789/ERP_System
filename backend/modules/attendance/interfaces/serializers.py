from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import AttendanceRecord


class AttendanceRecordListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "date",
            "status",
            "check_in",
            "check_out",
            "classification",
        ]


class AttendanceRecordDetailSerializer(AttendanceRecordListSerializer):
    class Meta(AttendanceRecordListSerializer.Meta):
        fields = AttendanceRecordListSerializer.Meta.fields + ["updated_at"]


class AttendanceRecordWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = AttendanceRecord
        fields = [
            "employee",
            "date",
            "status",
            "check_in",
            "check_out",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
