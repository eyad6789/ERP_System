from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Contract


class BudgetSummaryView(APIView):
    """Budget headline + clearance-filtered spend aggregates. Expenditures above
    the viewer's clearance are excluded, so totals only reflect cleared spend."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="finance", result="GRANTED")
        return Response(services.budget_summary(request.user))


class ContractListView(APIView):
    """Classified contract list. Over-clearance contracts appear but with their
    title/vendor/value withheld server-side (locked)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        return Response(services.list_contracts(request.user))


class ContractDetailView(APIView):
    """Full contract read. Denied (403) + audited for over-clearance; sensitive
    fields are never serialized in that case."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request, pk: int) -> Response:
        contract = get_object_or_404(Contract, pk=pk)
        # Raises 403 + writes a DENIED audit row when over-clearance.
        enforce_object_clearance(request, contract, action="view_contract")
        return Response(services.serialize_contract(contract))


class ContractExportView(APIView):
    """Permission-checked, audited export: only contracts the caller is cleared
    for are emitted, and the export action itself is logged."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "finance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="export_finance", target="contracts", result="GRANTED")
        return Response({"format": "csv", "rows": services.export_rows(request.user)})
