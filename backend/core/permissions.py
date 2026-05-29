"""Cross-cutting authorization helpers used by every module's interfaces layer.

The object-level clearance check is the primary IDOR defense: even when a caller
supplies a valid object id, the row is withheld server-side if its classification
exceeds the user's clearance, and the denial is written to the audit log.
"""

from __future__ import annotations

from typing import Any, Protocol

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class Classified(Protocol):
    classification: int


def enforce_object_clearance(
    request: Request,
    obj: Classified,
    *,
    action: str = "view_object",
) -> None:
    """Raise PermissionDenied (safe 403) + write a DENIED audit row when the
    object's classification exceeds the user's clearance.

    Imports the iam audit interface lazily to keep the module dependency one-way
    (core never imports iam at module load time).
    """
    from modules.iam.application import public as iam

    user = request.user
    user_clearance = getattr(user, "clearance", 0)
    obj_classification = getattr(obj, "classification", 0)
    target = f"{obj.__class__.__name__}:{getattr(obj, 'pk', '?')}"

    if not iam.can_read_sensitivity(user_clearance, obj_classification):
        iam.record_audit(request, action=action, target=target, result="DENIED")
        raise PermissionDenied()

    iam.record_audit(request, action=action, target=target, result="GRANTED")


class HasModuleAccess(BasePermission):
    """Role-level gate: the user's role must include `module` in its allow-list.

    Set `required_module` on the view. Denials are audited.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        from modules.iam.application import public as iam

        module: str | None = getattr(view, "required_module", None)
        if module is None:
            return True
        user = request.user
        modules: list[str] = getattr(user, "allowed_modules", []) or []
        granted = iam.can_access_module(modules, module)
        if not granted:
            iam.record_audit(request, action="open_module", target=module, result="DENIED")
        return granted

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        return True
