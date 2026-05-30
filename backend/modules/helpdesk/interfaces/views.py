from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Ticket
from .serializers import StatusUpdateSerializer, TicketWriteSerializer


class TicketListView(APIView):
    """Clearance-filtered ticket list. Tickets above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Supports create (POST)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "helpdesk"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="helpdesk", result="GRANTED")
        tickets = services.visible_tickets(request.user)
        tickets = services.filter_tickets(
            tickets,
            query=request.query_params.get("q", ""),
            ordering=request.query_params.get("ordering", ""),
        )
        return Response([services.serialize_ticket(t) for t in tickets])

    def post(self, request: Request) -> Response:
        serializer = TicketWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_ticket"
        )
        ticket = services.create_ticket(serializer.validated_data)
        iam.record_audit(
            request, action="create_ticket", target=f"Ticket:{ticket.pk}", result="GRANTED"
        )
        return Response(services.serialize_ticket(ticket), status=201)


class TicketDetailView(APIView):
    """Ticket detail. The object-level clearance check (IDOR defense) withholds a
    ticket whose classification exceeds the viewer's clearance and audits it.
    Supports partial update (PATCH) and delete (DELETE)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "helpdesk"

    def get(self, request: Request, pk: int) -> Response:
        ticket = get_object_or_404(Ticket, pk=pk)
        enforce_object_clearance(request, ticket, action="view_ticket")
        return Response(services.serialize_ticket(ticket))

    def patch(self, request: Request, pk: int) -> Response:
        ticket = get_object_or_404(Ticket, pk=pk)
        enforce_object_clearance(request, ticket, action="view_ticket")
        serializer = TicketWriteSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_ticket",
            )
        ticket = services.update_ticket(ticket, serializer.validated_data)
        iam.record_audit(
            request, action="update_ticket", target=f"Ticket:{ticket.pk}", result="GRANTED"
        )
        return Response(services.serialize_ticket(ticket))

    def delete(self, request: Request, pk: int) -> Response:
        ticket = get_object_or_404(Ticket, pk=pk)
        enforce_object_clearance(request, ticket, action="view_ticket")
        ticket_pk = ticket.pk
        services.delete_ticket(ticket)
        iam.record_audit(
            request, action="delete_ticket", target=f"Ticket:{ticket_pk}", result="GRANTED"
        )
        return Response(status=204)


class TicketStatusView(APIView):
    """Advance a ticket through its workflow (open/in_progress/resolved/closed).
    The clearance check runs first (IDOR defense); a successful state change is
    audited GRANTED."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "helpdesk"

    def post(self, request: Request, pk: int) -> Response:
        ticket = get_object_or_404(Ticket, pk=pk)
        enforce_object_clearance(request, ticket, action="view_ticket")
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        status = serializer.validated_data["status"]
        if not services.is_valid_status(status):
            return Response({"detail": "Invalid status."}, status=400)
        services.update_status(ticket, status)
        iam.record_audit(
            request,
            action="update_ticket_status",
            target=f"Ticket:{ticket.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_ticket(ticket))
