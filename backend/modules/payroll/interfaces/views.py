from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Payslip
from .serializers import (
    PayslipDetailSerializer,
    PayslipListSerializer,
    PayslipWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"employee", "period", "base", "net", "classification"})


class PayslipListView(APIView):
    """Clearance-filtered payslip register. Payslips above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates payslips, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "payroll"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="payroll", result="GRANTED")
        payslips = services.visible_payslips(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            payslips = services.filter_by_query(payslips, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                payslips = payslips.order_by(ordering)

        return Response(PayslipListSerializer(payslips, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = PayslipWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_payslip"
        )
        payslip = serializer.save()
        iam.record_audit(
            request, action="create_payslip", target=f"Payslip:{payslip.pk}", result="GRANTED"
        )
        return Response(PayslipDetailSerializer(payslip).data, status=201)


class PayslipDetailView(APIView):
    """Payslip detail. The object-level clearance check (IDOR defense) withholds a
    payslip whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes payslips after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "payroll"

    def get(self, request: Request, pk: int) -> Response:
        payslip = get_object_or_404(Payslip, pk=pk)
        enforce_object_clearance(request, payslip, action="view_payslip")
        return Response(PayslipDetailSerializer(payslip).data)

    def patch(self, request: Request, pk: int) -> Response:
        payslip = get_object_or_404(Payslip, pk=pk)
        enforce_object_clearance(request, payslip, action="view_payslip")
        serializer = PayslipWriteSerializer(payslip, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_payslip",
            )
        payslip = serializer.save()
        iam.record_audit(
            request, action="update_payslip", target=f"Payslip:{payslip.pk}", result="GRANTED"
        )
        return Response(PayslipDetailSerializer(payslip).data)

    def delete(self, request: Request, pk: int) -> Response:
        payslip = get_object_or_404(Payslip, pk=pk)
        enforce_object_clearance(request, payslip, action="view_payslip")
        payslip_pk = payslip.pk
        payslip.delete()
        iam.record_audit(
            request, action="delete_payslip", target=f"Payslip:{payslip_pk}", result="GRANTED"
        )
        return Response(status=204)
