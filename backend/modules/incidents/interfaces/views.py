from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Incident
from .serializers import IncidentWriteSerializer, StatusUpdateSerializer


class IncidentListView(APIView):
    """Clearance-filtered incident list. Records above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Supports create (POST)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "incidents"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="incidents", result="GRANTED")
        incidents = services.visible_incidents(request.user)
        incidents = services.filter_incidents(
            incidents,
            query=request.query_params.get("q", ""),
            ordering=request.query_params.get("ordering", ""),
        )
        return Response([services.serialize_incident(i) for i in incidents])

    def post(self, request: Request) -> Response:
        serializer = IncidentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["classification"] > getattr(request.user, "clearance", 0):
            raise PermissionDenied()
        incident = services.create_incident(data)
        iam.record_audit(
            request,
            action="create_incident",
            target=f"Incident:{incident.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_incident(incident), status=201)


class IncidentDetailView(APIView):
    """Incident detail. The object-level clearance check (IDOR defense) withholds
    a record whose classification exceeds the viewer's clearance and audits it.
    Supports partial update (PATCH) and delete (DELETE)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "incidents"

    def get(self, request: Request, pk: int) -> Response:
        incident = get_object_or_404(Incident, pk=pk)
        enforce_object_clearance(request, incident, action="view_incident")
        return Response(services.serialize_incident(incident))

    def patch(self, request: Request, pk: int) -> Response:
        incident = get_object_or_404(Incident, pk=pk)
        enforce_object_clearance(request, incident, action="view_incident")
        serializer = IncidentWriteSerializer(incident, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "classification" in data and data["classification"] > getattr(
            request.user, "clearance", 0
        ):
            raise PermissionDenied()
        incident = services.update_incident(incident, data)
        iam.record_audit(
            request,
            action="update_incident",
            target=f"Incident:{incident.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_incident(incident))

    def delete(self, request: Request, pk: int) -> Response:
        incident = get_object_or_404(Incident, pk=pk)
        enforce_object_clearance(request, incident, action="view_incident")
        incident_pk = incident.pk
        services.delete_incident(incident)
        iam.record_audit(
            request,
            action="delete_incident",
            target=f"Incident:{incident_pk}",
            result="GRANTED",
        )
        return Response(status=204)


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
