from __future__ import annotations

from typing import cast

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.db.rls import set_rls_context
from core.permissions import HasModuleAccess
from modules.iam.application import public as iam
from modules.iam.infrastructure.models import User

from . import services


class OverviewView(APIView):
    """Command-center overview: cross-module summary + alerts. Requires `dashboard`."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "dashboard"

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)
        set_rls_context(user.clearance, user.department)
        iam.record_audit(request, action="open_module", target="dashboard", result="GRANTED")
        return Response(services.command_overview(user))


class AlertsView(APIView):
    """Derived operational alerts for the authenticated user (role + clearance scoped)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)
        set_rls_context(user.clearance, user.department)
        overview = services.command_overview(user)
        return Response({"alerts": overview["alerts"]})


class SearchView(APIView):
    """Federated global search across the modules the user may access."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)
        set_rls_context(user.clearance, user.department)
        query = request.query_params.get("q", "")
        result = services.global_search(user, query)
        if result["query"]:
            iam.record_audit(
                request, action="search", target=f"q:{result['query'][:48]}", result="GRANTED"
            )
        return Response(result)
