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


class DashboardSummaryView(APIView):
    """Aggregated KPIs + charts for the dashboard. Requires the `dashboard` module.

    The payload only contains data the caller is cleared to see (e.g. the recent
    audit feed is omitted unless the role grants the `audit` module).
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "dashboard"

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)
        set_rls_context(user.clearance, user.department)
        iam.record_audit(request, action="open_module", target="dashboard", result="GRANTED")
        return Response(iam.build_dashboard_summary(user))
