from __future__ import annotations

from rest_framework import serializers


class WorkspaceWriteSerializer(serializers.Serializer):
    """Validation for a PATCH. Every editable field is optional (partial updates).
    ``key`` and ``owner_department`` are intentionally absent — they are immutable.
    Authorization (can_edit) is enforced in the view, not here."""

    name_ar = serializers.CharField(max_length=128, required=False)
    name_en = serializers.CharField(max_length=128, required=False)
    description_ar = serializers.CharField(required=False, allow_blank=True)
    description_en = serializers.CharField(required=False, allow_blank=True)
    mission_ar = serializers.CharField(max_length=255, required=False, allow_blank=True)
    mission_en = serializers.CharField(max_length=255, required=False, allow_blank=True)
    accent_color = serializers.CharField(max_length=16, required=False)
    head_name = serializers.CharField(max_length=128, required=False, allow_blank=True)
    featured = serializers.ListField(child=serializers.CharField(), required=False)
