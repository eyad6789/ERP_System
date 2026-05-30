from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import Ticket


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=16)


class TicketWriteSerializer(serializers.ModelSerializer):
    """Write serializer for ticket create/update. `classification` must be an int
    in 1-4; the over-clearance guard (403) lives in the view, not here, since it
    depends on the request user."""

    classification = serializers.IntegerField(min_value=1, max_value=4)

    class Meta:
        model = Ticket
        fields = [
            "title_ar",
            "title_en",
            "requester",
            "priority",
            "status",
            "classification",
        ]
