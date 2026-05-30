from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import ContractRecord
from .serializers import (
    ContractDetailSerializer,
    ContractListSerializer,
    ContractWriteSerializer,
)

ORDERING_WHITELIST = frozenset(
    {"title_en", "party", "value", "start_date", "end_date", "status", "classification"}
)


class ContractListView(APIView):
    """Clearance-filtered contract register. Contracts above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates contracts,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "contracts"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="contracts", result="GRANTED")
        contracts = services.visible_contracts(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            contracts = services.filter_by_query(contracts, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                contracts = contracts.order_by(ordering)

        return Response(ContractListSerializer(contracts, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ContractWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_contract"
        )
        contract = serializer.save()
        iam.record_audit(
            request,
            action="create_contract",
            target=f"ContractRecord:{contract.pk}",
            result="GRANTED",
        )
        return Response(ContractDetailSerializer(contract).data, status=201)


class ContractDetailView(APIView):
    """Contract detail. The object-level clearance check (IDOR defense) withholds a
    contract whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes contracts after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "contracts"

    def get(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(ContractRecord, pk=pk)
        enforce_object_clearance(request, contract, action="view_contract")
        return Response(ContractDetailSerializer(contract).data)

    def patch(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(ContractRecord, pk=pk)
        enforce_object_clearance(request, contract, action="view_contract")
        serializer = ContractWriteSerializer(contract, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_contract",
            )
        contract = serializer.save()
        iam.record_audit(
            request,
            action="update_contract",
            target=f"ContractRecord:{contract.pk}",
            result="GRANTED",
        )
        return Response(ContractDetailSerializer(contract).data)

    def delete(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(ContractRecord, pk=pk)
        enforce_object_clearance(request, contract, action="view_contract")
        contract_pk = contract.pk
        contract.delete()
        iam.record_audit(
            request,
            action="delete_contract",
            target=f"ContractRecord:{contract_pk}",
            result="GRANTED",
        )
        return Response(status=204)
