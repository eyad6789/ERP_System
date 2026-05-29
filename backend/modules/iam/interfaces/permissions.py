"""IAM-specific DRF permission classes."""

from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsSysadmin(BasePermission):
    """Allow only superusers or users whose role code is ``sysadmin``.

    Pairs with ``IsAuthenticated`` (which guarantees a real user); this class
    only inspects the already-authenticated principal.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if getattr(user, "is_superuser", False):
            return True
        role = getattr(user, "role", None)
        return bool(role and role.code == "sysadmin")
