from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import LeaveRequest


class LeaveRequestListSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "leave_type",
            "start_date",
            "end_date",
            "status",
            "reason",
            "classification",
        ]


class LeaveRequestDetailSerializer(LeaveRequestListSerializer):
    class Meta(LeaveRequestListSerializer.Meta):
        fields = LeaveRequestListSerializer.Meta.fields + ["updated_at"]


class LeaveRequestWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = LeaveRequest
        fields = [
            "employee",
            "leave_type",
            "start_date",
            "end_date",
            "status",
            "reason",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value


class LeaveStatusSerializer(serializers.Serializer):
    """Workflow transition payload for POST /<pk>/status (approve/reject)."""

    status = serializers.ChoiceField(
        choices=[LeaveRequest.Status.APPROVED, LeaveRequest.Status.REJECTED]
    )
