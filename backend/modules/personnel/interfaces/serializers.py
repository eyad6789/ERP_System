from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Person


class PersonListSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source="department.code", default="", read_only=True)
    department_name_ar = serializers.CharField(
        source="department.name_ar", default="", read_only=True
    )
    department_name_en = serializers.CharField(
        source="department.name_en", default="", read_only=True
    )

    class Meta:
        model = Person
        fields = [
            "id",
            "name_ar",
            "name_en",
            "rank_ar",
            "rank_en",
            "department_code",
            "department_name_ar",
            "department_name_en",
            "classification",
            "status",
        ]


class PersonDetailSerializer(PersonListSerializer):
    class Meta(PersonListSerializer.Meta):
        fields = PersonListSerializer.Meta.fields + [
            "attendance",
            "joined_year",
            "contract_type",
        ]
