from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Document


class DocumentWriteSerializer(serializers.ModelSerializer):
    """Write serializer for document create/update.

    Only the caller-supplied fields are writable; classification must be an
    integer in the 1-4 range (the clearance gate is enforced in the view).
    """

    class Meta:
        model = Document
        fields = ["title_ar", "title_en", "body", "classification"]

    def validate_classification(self, value: int) -> int:
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 4:
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
