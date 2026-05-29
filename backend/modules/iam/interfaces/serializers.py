from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import AuditEvent


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)
    mfa_code = serializers.CharField(required=False, allow_blank=True)


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "ts",
            "actor_label",
            "action",
            "target_type",
            "target_id",
            "result",
            "ip",
        ]
