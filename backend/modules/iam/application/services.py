"""IAM use-cases. The only place auth, audit, and permission payloads are built."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import authenticate as dj_authenticate

from ..domain import policy
from ..infrastructure.models import AuditEvent, User


def verify_mfa(user: User, code: str | None) -> bool:
    """MFA verification hook.

    Demo build: a stub that accepts (returns True) so the flow is wired without
    faking a real factor. Production swaps in TOTP/WebAuthn here — callers and
    the audit trail do not change.
    """
    return True


def authenticate(username: str, password: str, mfa_code: str | None = None) -> User | None:
    """Authenticate credentials + MFA. Returns the user or None (deny-by-default)."""
    user = dj_authenticate(username=username, password=password)
    if user is None or not isinstance(user, User):
        return None
    if not user.is_active:
        return None
    if not verify_mfa(user, mfa_code):
        return None
    return user


def build_permission_payload(user: User) -> dict[str, Any]:
    """The exact contract the React app renders from (GET /me)."""
    role = user.role
    return {
        "username": user.username,
        "full_name_ar": user.full_name_ar,
        "full_name_en": user.full_name_en,
        "department": user.department,
        "clearance": user.clearance,
        "modules": user.allowed_modules,
        "role": (
            {"code": role.code, "name_ar": role.name_ar, "name_en": role.name_en} if role else None
        ),
    }


def _client_ip(request: Any) -> str | None:
    if request is None:
        return None
    return request.META.get("REMOTE_ADDR")


def record_audit(
    request: Any,
    *,
    action: str,
    target: str = "",
    result: str = AuditEvent.Result.GRANTED,
    actor: User | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    """Append one audit row. Never raises into the caller's happy path on a
    best-effort field (ip/user-agent); the row itself is always written.
    """
    if actor is None and request is not None:
        candidate = getattr(request, "user", None)
        if isinstance(candidate, User) and candidate.is_authenticated:
            actor = candidate

    target_type, _, target_id = target.partition(":")
    user_agent = ""
    request_id = ""
    if request is not None:
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:256]
        request_id = request.META.get("HTTP_X_REQUEST_ID", "")[:64]

    return AuditEvent.objects.create(
        actor=actor,
        actor_label=(actor.username if actor else "anonymous"),
        action=action,
        target_type=target_type[:64],
        target_id=target_id[:64],
        result=result,
        ip=_client_ip(request),
        user_agent=user_agent,
        request_id=request_id,
        metadata=metadata or {},
    )


# Re-export the pure policy fns so callers depend only on the application layer.
can_access_module = policy.can_access_module
can_read_sensitivity = policy.can_read_sensitivity
