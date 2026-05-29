from __future__ import annotations

from typing import cast

from django.contrib.auth import login as dj_login
from django.contrib.auth import logout as dj_logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.db.rls import set_rls_context
from core.permissions import HasModuleAccess

from ..application import audit_query
from ..application import public as iam
from ..application.audit_query import AuditFilters
from ..infrastructure.models import AuditEvent, User
from .serializers import AuditEventSerializer, LoginSerializer


class LoginView(APIView):
    """Session login. Sets the session cookie; audits grant/deny."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = iam.authenticate(
            username=data["username"],
            password=data["password"],
            mfa_code=data.get("mfa_code") or None,
        )
        if user is None:
            iam.record_audit(
                request,
                action="login",
                target=f"username:{data['username']}",
                result=AuditEvent.Result.DENIED,
            )
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        dj_login(request, user)
        iam.record_audit(request, action="login", actor=user, result=AuditEvent.Result.GRANTED)
        return Response(iam.build_permission_payload(user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        iam.record_audit(request, action="logout", result=AuditEvent.Result.GRANTED)
        dj_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(ensure_csrf_cookie, name="get")
class MeView(APIView):
    """Return the authenticated user's permission payload (frontend contract).

    Also (re)issues the csrftoken cookie so the SPA can echo it on authenticated
    POSTs such as logout.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)  # IsAuthenticated guarantees a real user
        set_rls_context(user.clearance, user.department)
        return Response(iam.build_permission_payload(user))


class AuditListView(APIView):
    """Filtered, paginated read-only audit log.

    Requires the `audit` module on the user's role. Query params are parsed
    manually (no django-filter); all non-trivial query logic lives in
    `application.audit_query`.
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "audit"

    def _filters(self, request: Request) -> AuditFilters:
        params = request.query_params
        filters: AuditFilters = {}
        for key in ("q", "action", "result", "actor", "target_type", "date_from", "date_to"):
            value = params.get(key, "").strip()
            if value:
                filters[key] = value  # type: ignore[literal-required]
        return filters

    def get(self, request: Request) -> Response:
        iam.record_audit(
            request, action="open_module", target="audit", result=AuditEvent.Result.GRANTED
        )

        page = _int_param(request, "page", default=1)
        page_size = _int_param(request, "page_size", default=audit_query.DEFAULT_PAGE_SIZE)

        qs = audit_query.filtered_events(self._filters(request))
        rows, meta = audit_query.paginate(qs, page=page, page_size=page_size)

        return Response({"results": AuditEventSerializer(rows, many=True).data, **meta})


class AuditStatsView(APIView):
    """Aggregated audit metrics for the investigative dashboard.

    Requires the `audit` module on the user's role.
    """

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "audit"

    def get(self, request: Request) -> Response:
        iam.record_audit(
            request, action="open_module", target="audit", result=AuditEvent.Result.GRANTED
        )
        return Response(audit_query.build_audit_stats())


def _int_param(request: Request, key: str, *, default: int) -> int:
    """Parse a positive integer query param, falling back to `default`."""
    raw = request.query_params.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default
