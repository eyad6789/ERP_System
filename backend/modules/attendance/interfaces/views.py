from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import AttendanceRecord
from .serializers import (
    AttendanceRecordDetailSerializer,
    AttendanceRecordListSerializer,
    AttendanceRecordWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"employee", "date", "status", "classification"})


class AttendanceRecordListView(APIView):
    """Clearance-filtered attendance register. Records above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates records,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "attendance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="attendance", result="GRANTED")
        records = services.visible_records(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            records = services.filter_by_query(records, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                records = records.order_by(ordering)

        return Response(AttendanceRecordListSerializer(records, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AttendanceRecordWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_attendance"
        )
        record = serializer.save()
        iam.record_audit(
            request,
            action="create_attendance",
            target=f"AttendanceRecord:{record.pk}",
            result="GRANTED",
        )
        return Response(AttendanceRecordDetailSerializer(record).data, status=201)


class AttendanceRecordDetailView(APIView):
    """Attendance record detail. The object-level clearance check (IDOR defense)
    withholds a record whose classification exceeds the viewer's clearance and
    audits it. Also edits and deletes records after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "attendance"

    def get(self, request: Request, pk: int) -> Response:
        record = get_object_or_404(AttendanceRecord, pk=pk)
        enforce_object_clearance(request, record, action="view_attendance")
        return Response(AttendanceRecordDetailSerializer(record).data)

    def patch(self, request: Request, pk: int) -> Response:
        record = get_object_or_404(AttendanceRecord, pk=pk)
        enforce_object_clearance(request, record, action="view_attendance")
        serializer = AttendanceRecordWriteSerializer(record, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_attendance",
            )
        record = serializer.save()
        iam.record_audit(
            request,
            action="update_attendance",
            target=f"AttendanceRecord:{record.pk}",
            result="GRANTED",
        )
        return Response(AttendanceRecordDetailSerializer(record).data)

    def delete(self, request: Request, pk: int) -> Response:
        record = get_object_or_404(AttendanceRecord, pk=pk)
        enforce_object_clearance(request, record, action="view_attendance")
        record_pk = record.pk
        record.delete()
        iam.record_audit(
            request,
            action="delete_attendance",
            target=f"AttendanceRecord:{record_pk}",
            result="GRANTED",
        )
        return Response(status=204)
