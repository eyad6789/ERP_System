"""Payslip use-cases. Clearance filtering happens HERE (server-side), never in the
UI — payslips above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring personnel).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Q, QuerySet, Sum
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Payslip


def visible_payslips(user: Any) -> QuerySet[Payslip]:
    """Payslip queryset limited to records at or below the user's clearance."""
    return Payslip.objects.filter(classification__lte=user.clearance)


def filter_by_query(payslips: QuerySet[Payslip], query: str) -> QuerySet[Payslip]:
    """Case-insensitive contains filter over the payslip's text fields."""
    return payslips.filter(Q(employee__icontains=query) | Q(period__icontains=query))


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"Payslip:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting payslip counts (over-clearance rows are excluded)."""
    visible = visible_payslips(user)
    total_net = visible.aggregate(value=Sum("net"))["value"] or Decimal("0")
    return {
        "key": "payroll",
        "total": visible.count(),
        "total_net": str(total_net),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over payslip text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_payslips(user).filter(
        Q(employee__icontains=query) | Q(period__icontains=query)
    )[:limit]
    return [
        {
            "id": payslip.id,
            "kind": "payslip",
            "label_ar": payslip.employee,
            "label_en": payslip.employee,
            "detail": f"{payslip.period} · {payslip.net}",
        }
        for payslip in matches
    ]


def serialize_detail(payslip: Payslip) -> dict[str, Any]:
    """Full payslip payload (only called after the clearance check passes)."""
    return {
        "id": payslip.id,
        "employee": payslip.employee,
        "period": payslip.period,
        "base": str(payslip.base),
        "allowances": str(payslip.allowances),
        "deductions": str(payslip.deductions),
        "net": str(payslip.net),
        "classification": payslip.classification,
        "updated_at": payslip.updated_at.isoformat(),
    }
