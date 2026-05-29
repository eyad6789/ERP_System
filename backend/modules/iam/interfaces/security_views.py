"""Account-security suite: password change, MFA enrolment, and session control.

All endpoints require an authenticated user; every mutation is audited.
TOTP is computed by the pure ``application.totp`` helper (no new dependency).
"""

from __future__ import annotations

import base64
import secrets
from typing import cast

from django.contrib.auth import password_validation
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application import public as iam
from ..application import totp
from ..infrastructure.models import AuditEvent, User
from .serializers import MfaVerifySerializer, PasswordChangeSerializer


class PasswordChangeView(APIView):
    """POST {old_password, new_password} -> rotate the caller's password."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast("User", request.user)
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not user.check_password(data["old_password"]):
            iam.record_audit(
                request,
                action="change_password",
                target=f"User:{user.pk}",
                result=AuditEvent.Result.DENIED,
            )
            return Response(
                {"detail": "Old password is incorrect."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            password_validation.validate_password(data["new_password"], user)
        except ValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        iam.record_audit(
            request,
            action="change_password",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MfaSetupView(APIView):
    """POST -> provision (but do NOT enable) a TOTP secret for the caller."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast("User", request.user)
        secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii")
        user.mfa_secret = secret
        user.save(update_fields=["mfa_secret"])

        uri = f"otpauth://totp/ERP:{user.username}?secret={secret}&issuer=ERP"
        iam.record_audit(
            request,
            action="setup_mfa",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response({"secret": secret, "otpauth_uri": uri})


class MfaVerifyView(APIView):
    """POST {code} -> verify the TOTP and enable MFA on success."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast("User", request.user)
        serializer = MfaVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]

        if not user.mfa_secret or not totp.verify(user.mfa_secret, code, window=1):
            iam.record_audit(
                request,
                action="enable_mfa",
                target=f"User:{user.pk}",
                result=AuditEvent.Result.DENIED,
            )
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        user.mfa_enabled = True
        user.save(update_fields=["mfa_enabled"])
        iam.record_audit(
            request,
            action="enable_mfa",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response({"mfa_enabled": True})


class MfaDisableView(APIView):
    """POST -> clear the TOTP secret and disable MFA."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = cast("User", request.user)
        user.mfa_secret = ""  # nosec B105 - clearing the stored TOTP secret, not a credential
        user.mfa_enabled = False
        user.save(update_fields=["mfa_secret", "mfa_enabled"])
        iam.record_audit(
            request,
            action="disable_mfa",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response({"mfa_enabled": False})


class SessionListView(APIView):
    """GET -> the caller's active Django sessions (current one flagged)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = cast("User", request.user)
        current_key = request.session.session_key
        rows: list[dict[str, object]] = []
        for session in Session.objects.all():
            decoded = session.get_decoded()
            if decoded.get("_auth_user_id") != str(user.pk):
                continue
            rows.append(
                {
                    "key_tail": session.session_key[-8:],
                    "expires": session.expire_date.isoformat(),
                    "current": session.session_key == current_key,
                }
            )
        return Response(rows)


class SessionDetailView(APIView):
    """DELETE -> revoke one of the caller's sessions by key."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, key: str) -> Response:
        user = cast("User", request.user)
        try:
            session = Session.objects.get(session_key=key)
        except Session.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if session.get_decoded().get("_auth_user_id") != str(user.pk):
            iam.record_audit(
                request,
                action="revoke_session",
                target=f"Session:{key[-8:]}",
                result=AuditEvent.Result.DENIED,
            )
            return Response(status=status.HTTP_404_NOT_FOUND)

        session.delete()
        iam.record_audit(
            request,
            action="revoke_session",
            target=f"Session:{key[-8:]}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
