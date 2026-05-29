from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import PurchaseOrder
from .serializers import (
    PurchaseOrderDetailSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderWriteSerializer,
    VendorListSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "total", "status", "classification"})


class PurchaseOrderListView(APIView):
    """Clearance-filtered purchase-order list. Orders above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates orders,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "procurement"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="procurement", result="GRANTED")
        orders = services.visible_purchase_orders(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            orders = services.filter_by_query(orders, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                orders = orders.order_by(ordering)

        return Response(PurchaseOrderListSerializer(orders, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = PurchaseOrderWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request,
            serializer.validated_data["classification"],
            action="create_purchase_order",
        )
        order = serializer.save()
        iam.record_audit(
            request,
            action="create_purchase_order",
            target=f"PurchaseOrder:{order.pk}",
            result="GRANTED",
        )
        return Response(PurchaseOrderDetailSerializer(order).data, status=201)


class PurchaseOrderDetailView(APIView):
    """Purchase-order detail. The object-level clearance check (IDOR defense)
    withholds an order whose classification exceeds the viewer's clearance and
    audits it. Also edits and deletes orders after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "procurement"

    def get(self, request: Request, pk: int) -> Response:
        order = get_object_or_404(PurchaseOrder, pk=pk)
        enforce_object_clearance(request, order, action="view_purchase_order")
        return Response(PurchaseOrderDetailSerializer(order).data)

    def patch(self, request: Request, pk: int) -> Response:
        order = get_object_or_404(PurchaseOrder, pk=pk)
        enforce_object_clearance(request, order, action="view_purchase_order")
        serializer = PurchaseOrderWriteSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_purchase_order",
            )
        order = serializer.save()
        iam.record_audit(
            request,
            action="update_purchase_order",
            target=f"PurchaseOrder:{order.pk}",
            result="GRANTED",
        )
        return Response(PurchaseOrderDetailSerializer(order).data)

    def delete(self, request: Request, pk: int) -> Response:
        order = get_object_or_404(PurchaseOrder, pk=pk)
        enforce_object_clearance(request, order, action="view_purchase_order")
        order_pk = order.pk
        order.delete()
        iam.record_audit(
            request,
            action="delete_purchase_order",
            target=f"PurchaseOrder:{order_pk}",
            result="GRANTED",
        )
        return Response(status=204)


class VendorListView(APIView):
    """Clearance-filtered vendor directory. Vendors above the viewer's clearance
    are excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "procurement"

    def get(self, request: Request) -> Response:
        vendors = services.visible_vendors(request.user)
        return Response(VendorListSerializer(vendors, many=True).data)
