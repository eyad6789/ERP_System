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
