from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Risk
from .serializers import RiskDetailSerializer, RiskListSerializer, RiskWriteSerializer

ORDERING_WHITELIST = frozenset(
    {"title_en", "likelihood", "impact", "score", "status", "classification"}
)


class RiskListView(APIView):
    """Clearance-filtered risk register. Risks above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates risks, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "risk"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="risk", result="GRANTED")
        risks = services.visible_risks(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            risks = services.filter_by_query(risks, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                risks = risks.order_by(ordering)

        return Response(RiskListSerializer(risks, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = RiskWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_risk"
        )
        risk = services.create_risk(serializer.validated_data)
        iam.record_audit(request, action="create_risk", target=f"Risk:{risk.pk}", result="GRANTED")
        return Response(RiskDetailSerializer(risk).data, status=201)


class RiskDetailView(APIView):
    """Risk detail. The object-level clearance check (IDOR defense) withholds a
    risk whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes risks after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "risk"

    def get(self, request: Request, pk: int) -> Response:
        risk = get_object_or_404(Risk, pk=pk)
        enforce_object_clearance(request, risk, action="view_risk")
        return Response(RiskDetailSerializer(risk).data)

    def patch(self, request: Request, pk: int) -> Response:
        risk = get_object_or_404(Risk, pk=pk)
        enforce_object_clearance(request, risk, action="view_risk")
        serializer = RiskWriteSerializer(risk, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_risk",
            )
        risk = services.update_risk(risk, serializer.validated_data)
        iam.record_audit(request, action="update_risk", target=f"Risk:{risk.pk}", result="GRANTED")
        return Response(RiskDetailSerializer(risk).data)

    def delete(self, request: Request, pk: int) -> Response:
        risk = get_object_or_404(Risk, pk=pk)
        enforce_object_clearance(request, risk, action="view_risk")
        risk_pk = risk.pk
        services.delete_risk(risk)
        iam.record_audit(request, action="delete_risk", target=f"Risk:{risk_pk}", result="GRANTED")
        return Response(status=204)
