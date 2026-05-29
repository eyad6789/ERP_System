from __future__ import annotations

from rest_framework import serializers


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=16)
