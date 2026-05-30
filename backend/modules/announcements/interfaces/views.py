from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Announcement
from .serializers import (
    AnnouncementDetailSerializer,
    AnnouncementListSerializer,
    AnnouncementWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "audience", "published_date", "classification"})


class AnnouncementListView(APIView):
    """Clearance-filtered announcement board. Announcements above the viewer's
    clearance are excluded server-side (not merely hidden in the UI). Also creates
    announcements, never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "announcements"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="announcements", result="GRANTED")
        announcements = services.visible_announcements(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            announcements = services.filter_by_query(announcements, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                announcements = announcements.order_by(ordering)

        return Response(AnnouncementListSerializer(announcements, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AnnouncementWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request,
            serializer.validated_data["classification"],
            action="create_announcement",
        )
        announcement = serializer.save()
        iam.record_audit(
            request,
            action="create_announcement",
            target=f"Announcement:{announcement.pk}",
            result="GRANTED",
        )
        return Response(AnnouncementDetailSerializer(announcement).data, status=201)


class AnnouncementDetailView(APIView):
    """Announcement detail. The object-level clearance check (IDOR defense)
    withholds an announcement whose classification exceeds the viewer's clearance
    and audits it. Also edits and deletes announcements after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "announcements"

    def get(self, request: Request, pk: int) -> Response:
        announcement = get_object_or_404(Announcement, pk=pk)
        enforce_object_clearance(request, announcement, action="view_announcement")
        return Response(AnnouncementDetailSerializer(announcement).data)

    def patch(self, request: Request, pk: int) -> Response:
        announcement = get_object_or_404(Announcement, pk=pk)
        enforce_object_clearance(request, announcement, action="view_announcement")
        serializer = AnnouncementWriteSerializer(announcement, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_announcement",
            )
        announcement = serializer.save()
        iam.record_audit(
            request,
            action="update_announcement",
            target=f"Announcement:{announcement.pk}",
            result="GRANTED",
        )
        return Response(AnnouncementDetailSerializer(announcement).data)

    def delete(self, request: Request, pk: int) -> Response:
        announcement = get_object_or_404(Announcement, pk=pk)
        enforce_object_clearance(request, announcement, action="view_announcement")
        announcement_pk = announcement.pk
        announcement.delete()
        iam.record_audit(
            request,
            action="delete_announcement",
            target=f"Announcement:{announcement_pk}",
            result="GRANTED",
        )
        return Response(status=204)
