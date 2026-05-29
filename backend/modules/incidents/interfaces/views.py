from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Incident
from .serializers import StatusUpdateSerializer


class IncidentListView(APIView):
    """Clearance-filtered incident list. Records above the viewer's clearance are
    excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "incidents"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="incidents", result="GRANTED")
        incidents = services.visible_incidents(request.user)
        return Response([services.serialize_incident(i) for i in incidents])


class IncidentDetailView(APIView):
    """Incident detail. The object-level clearance check (IDOR defense) withholds
    a record whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "incidents"

    def get(self, request: Request, pk: int) -> Response:
        incident = get_object_or_404(Incident, pk=pk)
        enforce_object_clearance(request, incident, action="view_incident")
        return Response(services.serialize_incident(incident))


class IncidentStatusView(APIView):
    """Escalate/close an incident. The clearance check runs first (IDOR defense);
    a successful state change is audited GRANTED."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "incidents"

    def post(self, request: Request, pk: int) -> Response:
        incident = get_object_or_404(Incident, pk=pk)
        enforce_object_clearance(request, incident, action="view_incident")
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        status = serializer.validated_data["status"]
        if not services.is_valid_status(status):
            return Response({"detail": "Invalid status."}, status=400)
        services.update_status(incident, status)
        iam.record_audit(
            request,
            action="update_incident_status",
            target=f"Incident:{incident.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_incident(incident))
