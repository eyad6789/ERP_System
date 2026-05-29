from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Incident


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=16)


class IncidentWriteSerializer(serializers.ModelSerializer):
    """Write serializer for incident create/update. `classification` must be an
    int in 1-4; the over-clearance guard (403) lives in the view, not here."""

    classification = serializers.IntegerField(min_value=1, max_value=4)

    class Meta:
        model = Incident
        fields = [
            "title_ar",
            "title_en",
            "severity",
            "status",
            "reported_date",
            "classification",
        ]
