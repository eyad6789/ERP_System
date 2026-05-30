from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Meeting
from .serializers import (
    MeetingDetailSerializer,
    MeetingListSerializer,
    MeetingWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "start_at", "location", "status", "classification"})


class MeetingListView(APIView):
    """Clearance-filtered meeting directory. Meetings above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates meetings,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "meetings"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="meetings", result="GRANTED")
        meetings = services.visible_meetings(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            meetings = services.filter_by_query(meetings, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                meetings = meetings.order_by(ordering)

        return Response(MeetingListSerializer(meetings, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = MeetingWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_meeting"
        )
        meeting = serializer.save()
        iam.record_audit(
            request, action="create_meeting", target=f"Meeting:{meeting.pk}", result="GRANTED"
        )
        return Response(MeetingDetailSerializer(meeting).data, status=201)


class MeetingDetailView(APIView):
    """Meeting detail. The object-level clearance check (IDOR defense) withholds a
    meeting whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes meetings after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "meetings"

    def get(self, request: Request, pk: int) -> Response:
        meeting = get_object_or_404(Meeting, pk=pk)
        enforce_object_clearance(request, meeting, action="view_meeting")
        return Response(MeetingDetailSerializer(meeting).data)

    def patch(self, request: Request, pk: int) -> Response:
        meeting = get_object_or_404(Meeting, pk=pk)
        enforce_object_clearance(request, meeting, action="view_meeting")
        serializer = MeetingWriteSerializer(meeting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_meeting",
            )
        meeting = serializer.save()
        iam.record_audit(
            request, action="update_meeting", target=f"Meeting:{meeting.pk}", result="GRANTED"
        )
        return Response(MeetingDetailSerializer(meeting).data)

    def delete(self, request: Request, pk: int) -> Response:
        meeting = get_object_or_404(Meeting, pk=pk)
        enforce_object_clearance(request, meeting, action="view_meeting")
        meeting_pk = meeting.pk
        meeting.delete()
        iam.record_audit(
            request, action="delete_meeting", target=f"Meeting:{meeting_pk}", result="GRANTED"
        )
        return Response(status=204)
