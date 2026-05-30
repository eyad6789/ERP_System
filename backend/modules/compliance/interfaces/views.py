from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import ComplianceItem
from .serializers import (
    ComplianceItemDetailSerializer,
    ComplianceItemListSerializer,
    ComplianceItemWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "standard", "status", "classification"})


class ComplianceItemListView(APIView):
    """Clearance-filtered compliance register. Items above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates items, never above
    the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "compliance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="compliance", result="GRANTED")
        items = services.visible_items(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            items = services.filter_by_query(items, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                items = items.order_by(ordering)

        return Response(ComplianceItemListSerializer(items, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ComplianceItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_compliance"
        )
        item = serializer.save()
        iam.record_audit(
            request,
            action="create_compliance",
            target=f"ComplianceItem:{item.pk}",
            result="GRANTED",
        )
        return Response(ComplianceItemDetailSerializer(item).data, status=201)


class ComplianceItemDetailView(APIView):
    """Compliance item detail. The object-level clearance check (IDOR defense) withholds
    an item whose classification exceeds the viewer's clearance and audits it. Also edits
    and deletes items after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "compliance"

    def get(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(ComplianceItem, pk=pk)
        enforce_object_clearance(request, item, action="view_compliance")
        return Response(ComplianceItemDetailSerializer(item).data)

    def patch(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(ComplianceItem, pk=pk)
        enforce_object_clearance(request, item, action="view_compliance")
        serializer = ComplianceItemWriteSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_compliance",
            )
        item = serializer.save()
        iam.record_audit(
            request,
            action="update_compliance",
            target=f"ComplianceItem:{item.pk}",
            result="GRANTED",
        )
        return Response(ComplianceItemDetailSerializer(item).data)

    def delete(self, request: Request, pk: int) -> Response:
        item = get_object_or_404(ComplianceItem, pk=pk)
        enforce_object_clearance(request, item, action="view_compliance")
        item_pk = item.pk
        item.delete()
        iam.record_audit(
            request,
            action="delete_compliance",
            target=f"ComplianceItem:{item_pk}",
            result="GRANTED",
        )
        return Response(status=204)
