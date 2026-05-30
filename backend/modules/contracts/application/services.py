"""ContractRecord use-cases. Clearance filtering happens HERE (server-side), never
in the UI — contracts above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Q, QuerySet, Sum
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import ContractRecord


def visible_contracts(user: Any) -> QuerySet[ContractRecord]:
    """ContractRecord queryset limited to records at or below the user's clearance."""
    return ContractRecord.objects.filter(classification__lte=user.clearance)


def filter_by_query(contracts: QuerySet[ContractRecord], query: str) -> QuerySet[ContractRecord]:
    """Case-insensitive contains filter over the contract's text fields."""
    return contracts.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(party__icontains=query)
    )


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"ContractRecord:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting contract counts (over-clearance rows are excluded)."""
    visible = visible_contracts(user)
    total_value = visible.aggregate(value=Sum("value"))["value"] or Decimal("0")
    return {
        "key": "contracts",
        "total": visible.count(),
        "active": visible.filter(status=ContractRecord.Status.ACTIVE).count(),
        "total_value_visible": str(total_value),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over contract text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_contracts(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(party__icontains=query)
    )[:limit]
    return [
        {
            "id": contract.id,
            "kind": "contract",
            "label_ar": contract.title_ar,
            "label_en": contract.title_en,
            "detail": f"{contract.party} · {contract.value} · {contract.status}",
        }
        for contract in matches
    ]


def serialize_detail(contract: ContractRecord) -> dict[str, Any]:
    """Full contract payload (only called after the clearance check passes)."""
    return {
        "id": contract.id,
        "title_ar": contract.title_ar,
        "title_en": contract.title_en,
        "party": contract.party,
        "value": str(contract.value),
        "start_date": contract.start_date.isoformat(),
        "end_date": contract.end_date.isoformat(),
        "status": contract.status,
        "classification": contract.classification,
        "updated_at": contract.updated_at.isoformat(),
    }
