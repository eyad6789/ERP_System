from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Contract
from .serializers import (
    ContractSerializer,
    ContractWriteSerializer,
    StatusUpdateSerializer,
)


class BudgetSummaryView(APIView):
    """Budget headline + clearance-filtered spend aggregates. Expenditures above
    the viewer's clearance are excluded, so totals only reflect cleared spend."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="finance", result="GRANTED")
        return Response(services.budget_summary(request.user))


class ContractListView(APIView):
    """Classified contract list (GET, top-level array) and create (POST).

    Over-clearance contracts appear in the list but with their title/vendor/value
    withheld server-side (locked). Create is rejected (403) when the requested
    classification exceeds the caller's clearance.
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        return Response(
            services.list_contracts(
                request.user,
                query=request.query_params.get("q", ""),
                ordering=request.query_params.get("ordering", ""),
            )
        )

    def post(self, request: Request) -> Response:
        serializer = ContractWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # A user may not create a row classified ABOVE their own clearance.
        if data["classification"] > getattr(request.user, "clearance", 0):
            raise PermissionDenied()
        contract = services.create_contract(data, owner=request.user)
        iam.record_audit(
            request,
            action="create_contract",
            target=f"Contract:{contract.pk}",
            result="GRANTED",
        )
        return Response(ContractSerializer(contract).data, status=201)


class ContractDetailView(APIView):
    """Full contract read (GET), partial update (PATCH) and delete (DELETE).

    Every verb runs the object-level clearance check first (403 + DENIED for
    over-clearance); sensitive fields are never serialized in that case.
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(Contract, pk=pk)
        # Raises 403 + writes a DENIED audit row when over-clearance.
        enforce_object_clearance(request, contract, action="view_contract")
        return Response(services.serialize_contract(contract))

    def patch(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(Contract, pk=pk)
        # Clearance check first (IDOR defense): 403 + DENIED when over-clearance.
        enforce_object_clearance(request, contract, action="view_contract")
        serializer = ContractWriteSerializer(contract, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        new_class = data.get("classification")
        # A user may not raise a row's classification ABOVE their own clearance.
        if new_class is not None and new_class > getattr(request.user, "clearance", 0):
            raise PermissionDenied()
        contract = services.update_contract(contract, data)
        iam.record_audit(
            request,
            action="update_contract",
            target=f"Contract:{contract.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_contract(contract))

    def delete(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(Contract, pk=pk)
        # Clearance check first (IDOR defense): 403 + DENIED when over-clearance.
        enforce_object_clearance(request, contract, action="view_contract")
        services.delete_contract(contract)
        iam.record_audit(
            request,
            action="delete_contract",
            target=f"Contract:{pk}",
            result="GRANTED",
        )
        return Response(status=204)


class ContractStatusView(APIView):
    """Workflow state change: move a contract between Status values. The clearance
    check runs first (over-clearance is 403 + DENIED), then the change is audited.
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def post(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(Contract, pk=pk)
        enforce_object_clearance(request, contract, action="view_contract")
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        status = serializer.validated_data["status"]
        if status not in Contract.Status.values:
            return Response({"detail": "Invalid status."}, status=400)
        services.advance_contract(contract, status)
        iam.record_audit(
            request,
            action="advance_contract",
            target=f"Contract:{contract.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_contract(contract))


class ContractExportView(APIView):
    """Permission-checked, audited export: only contracts the caller is cleared
    for are emitted, and the export action itself is logged."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="export_finance", target="contracts", result="GRANTED")
        return Response({"format": "csv", "rows": services.export_rows(request.user)})
