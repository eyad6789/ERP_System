from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import LeaveRequest
from .serializers import (
    LeaveRequestDetailSerializer,
    LeaveRequestListSerializer,
    LeaveRequestWriteSerializer,
    LeaveStatusSerializer,
)

ORDERING_WHITELIST = frozenset({"employee", "leave_type", "start_date", "status", "classification"})


class LeaveRequestListView(APIView):
    """Clearance-filtered leave directory. Requests above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates requests, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "leave"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="leave", result="GRANTED")
        requests = services.visible_requests(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            requests = services.filter_by_query(requests, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                requests = requests.order_by(ordering)

        return Response(LeaveRequestListSerializer(requests, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = LeaveRequestWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_leave"
        )
        req = serializer.save()
        iam.record_audit(
            request, action="create_leave", target=f"LeaveRequest:{req.pk}", result="GRANTED"
        )
        return Response(LeaveRequestDetailSerializer(req).data, status=201)


class LeaveRequestDetailView(APIView):
    """Leave-request detail. The object-level clearance check (IDOR defense) withholds
    a request whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes requests after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "leave"

    def get(self, request: Request, pk: int) -> Response:
        req = get_object_or_404(LeaveRequest, pk=pk)
        enforce_object_clearance(request, req, action="view_leave")
        return Response(LeaveRequestDetailSerializer(req).data)

    def patch(self, request: Request, pk: int) -> Response:
        req = get_object_or_404(LeaveRequest, pk=pk)
        enforce_object_clearance(request, req, action="view_leave")
        serializer = LeaveRequestWriteSerializer(req, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_leave",
            )
        req = serializer.save()
        iam.record_audit(
            request, action="update_leave", target=f"LeaveRequest:{req.pk}", result="GRANTED"
        )
        return Response(LeaveRequestDetailSerializer(req).data)

    def delete(self, request: Request, pk: int) -> Response:
        req = get_object_or_404(LeaveRequest, pk=pk)
        enforce_object_clearance(request, req, action="view_leave")
        req_pk = req.pk
        req.delete()
        iam.record_audit(
            request, action="delete_leave", target=f"LeaveRequest:{req_pk}", result="GRANTED"
        )
        return Response(status=204)


class LeaveStatusView(APIView):
    """Approve/reject workflow transition. Honors the same IDOR clearance check
    before mutating the request status, and audits the transition."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "leave"

    def post(self, request: Request, pk: int) -> Response:
        req = get_object_or_404(LeaveRequest, pk=pk)
        enforce_object_clearance(request, req, action="view_leave")
        serializer = LeaveStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req.status = serializer.validated_data["status"]
        req.save(update_fields=["status", "updated_at"])
        iam.record_audit(
            request,
            action="status_leave",
            target=f"LeaveRequest:{req.pk}",
            result="GRANTED",
            metadata={"status": req.status},
        )
        return Response(LeaveRequestDetailSerializer(req).data)
