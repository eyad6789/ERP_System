from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Payslip


class PayslipListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payslip
        fields = [
            "id",
            "employee",
            "period",
            "base",
            "allowances",
            "deductions",
            "net",
            "classification",
        ]


class PayslipDetailSerializer(PayslipListSerializer):
    class Meta(PayslipListSerializer.Meta):
        fields = PayslipListSerializer.Meta.fields + ["updated_at"]


class PayslipWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user. `net` is derived on save."""

    class Meta:
        model = Payslip
        fields = [
            "employee",
            "period",
            "base",
            "allowances",
            "deductions",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
