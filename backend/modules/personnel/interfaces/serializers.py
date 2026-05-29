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


class PersonWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance is enforced in the view
    against the caller's clearance; here we only validate the value range."""

    class Meta:
        model = Person
        fields = [
            "name_ar",
            "name_en",
            "rank_ar",
            "rank_en",
            "classification",
            "status",
            "attendance",
            "joined_year",
            "contract_type",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
