from __future__ import annotations

from typing import cast

from django.contrib.auth import login as dj_login
from django.contrib.auth import logout as dj_logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.db.rls import set_rls_context
from core.permissions import HasModuleAccess

from ..application import public as iam
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


class AuditListView(ListAPIView):
    """Read-only audit log. Requires the `audit` module on the user's role."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "audit"
    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.all()

    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        iam.record_audit(
            request, action="open_module", target="audit", result=AuditEvent.Result.GRANTED
        )
        return super().list(request, *args, **kwargs)
