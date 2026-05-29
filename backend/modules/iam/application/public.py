"""Public interface of the IAM module.

Other modules and `core` import from HERE only — never from iam.infrastructure
or iam.interfaces. This is the module's contract.
"""

from __future__ import annotations

from .dashboard import build_dashboard_summary
from .services import (
    authenticate,
    build_permission_payload,
    can_access_module,
    can_read_sensitivity,
    record_audit,
    verify_mfa,
)

__all__ = [
    "authenticate",
    "build_dashboard_summary",
    "build_permission_payload",
    "can_access_module",
    "can_read_sensitivity",
    "record_audit",
    "verify_mfa",
]
