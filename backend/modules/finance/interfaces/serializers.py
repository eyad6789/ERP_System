from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Budget, Contract


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ["id", "fiscal_year", "total_amount", "currency"]


class ContractSerializer(serializers.ModelSerializer):
    owner = serializers.CharField(source="owner.username", default=None, read_only=True)

    class Meta:
        model = Contract
        fields = [
            "id",
            "title_ar",
            "title_en",
            "vendor",
            "value",
            "progress",
            "status",
            "classification",
            "owner",
        ]


class ContractWriteSerializer(serializers.ModelSerializer):
    """Write serializer for contract create/update. ``classification`` must be an
    int in 1-4; the over-clearance guard (403) lives in the view, not here."""

    classification = serializers.IntegerField(min_value=1, max_value=4)

    class Meta:
        model = Contract
        fields = [
            "title_ar",
            "title_en",
            "vendor",
            "value",
            "progress",
            "status",
            "classification",
        ]


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=16)
