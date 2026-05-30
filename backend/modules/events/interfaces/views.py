from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Event
from .serializers import EventDetailSerializer, EventListSerializer, EventWriteSerializer

ORDERING_WHITELIST = frozenset({"title_en", "start_at", "event_type", "classification"})


class EventListView(APIView):
    """Clearance-filtered event calendar. Events above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates events, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "events"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="events", result="GRANTED")
        events = services.visible_events(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            events = services.filter_by_query(events, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                events = events.order_by(ordering)

        return Response(EventListSerializer(events, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = EventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_event"
        )
        event = serializer.save()
        iam.record_audit(
            request, action="create_event", target=f"Event:{event.pk}", result="GRANTED"
        )
        return Response(EventDetailSerializer(event).data, status=201)


class EventDetailView(APIView):
    """Event detail. The object-level clearance check (IDOR defense) withholds an
    event whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes events after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "events"

    def get(self, request: Request, pk: int) -> Response:
        event = get_object_or_404(Event, pk=pk)
        enforce_object_clearance(request, event, action="view_event")
        return Response(EventDetailSerializer(event).data)

    def patch(self, request: Request, pk: int) -> Response:
        event = get_object_or_404(Event, pk=pk)
        enforce_object_clearance(request, event, action="view_event")
        serializer = EventWriteSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_event",
            )
        event = serializer.save()
        iam.record_audit(
            request, action="update_event", target=f"Event:{event.pk}", result="GRANTED"
        )
        return Response(EventDetailSerializer(event).data)

    def delete(self, request: Request, pk: int) -> Response:
        event = get_object_or_404(Event, pk=pk)
        enforce_object_clearance(request, event, action="view_event")
        event_pk = event.pk
        event.delete()
        iam.record_audit(
            request, action="delete_event", target=f"Event:{event_pk}", result="GRANTED"
        )
        return Response(status=204)
