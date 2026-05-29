from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import AuditEvent, Role, User


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
            "user_agent",
            "request_id",
            "metadata",
        ]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name_ar", "name_en", "modules", "clearance"]


class RoleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["code", "name_ar", "name_en", "modules", "clearance"]


class RoleUpdateSerializer(serializers.Serializer):
    name_ar = serializers.CharField(required=False)
    name_en = serializers.CharField(required=False)
    modules = serializers.ListField(child=serializers.CharField(), required=False)
    clearance = serializers.IntegerField(required=False, min_value=1, max_value=4)


class AdminUserSerializer(serializers.ModelSerializer):
    role: serializers.PrimaryKeyRelatedField = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name_ar",
            "full_name_en",
            "role",
            "clearance",
            "department",
            "is_active",
            "mfa_enabled",
            "date_joined",
        ]


class AdminUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=False)
    clearance = serializers.IntegerField(min_value=1, max_value=4)
    department = serializers.CharField(max_length=64, required=False, allow_blank=True)
    full_name_ar = serializers.CharField(max_length=128, required=False, allow_blank=True)
    full_name_en = serializers.CharField(max_length=128, required=False, allow_blank=True)


class AdminUserUpdateSerializer(serializers.Serializer):
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=False)
    clearance = serializers.IntegerField(required=False, min_value=1, max_value=4)
    department = serializers.CharField(max_length=64, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)
    new_password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)


class MfaVerifySerializer(serializers.Serializer):
    code = serializers.CharField()
