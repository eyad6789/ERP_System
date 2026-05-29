"""Procurement use-cases. Clearance filtering happens HERE (server-side), never in
the UI — purchase orders above the viewer's clearance are excluded from every
query (FILTER pattern, mirroring assets).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Q, QuerySet, Sum
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import PurchaseOrder, Vendor


def visible_purchase_orders(user: Any) -> QuerySet[PurchaseOrder]:
    """Purchase-order queryset limited to records at or below the user's clearance."""
    return PurchaseOrder.objects.select_related("vendor").filter(classification__lte=user.clearance)


def visible_vendors(user: Any) -> QuerySet[Vendor]:
    """Vendor queryset limited to records at or below the user's clearance."""
    return Vendor.objects.filter(classification__lte=user.clearance)


def filter_by_query(orders: QuerySet[PurchaseOrder], query: str) -> QuerySet[PurchaseOrder]:
    """Case-insensitive contains filter over the order's text fields and vendor name."""
    return orders.filter(
        Q(title_ar__icontains=query)
        | Q(title_en__icontains=query)
        | Q(vendor__name_ar__icontains=query)
        | Q(vendor__name_en__icontains=query)
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
            target=f"PurchaseOrder:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting purchase-order counts (over-clearance rows are excluded)."""
    visible = visible_purchase_orders(user)
    total_value = visible.aggregate(total=Sum("total"))["total"] or Decimal("0")
    return {
        "key": "procurement",
        "total": visible.count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in PurchaseOrder.Status.values
        ],
        "vendors": visible_vendors(user).count(),
        "total_value_visible": str(total_value),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over order text and vendor name, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = filter_by_query(visible_purchase_orders(user), query)[:limit]
    return [
        {
            "id": order.id,
            "kind": "purchase_order",
            "label_ar": order.title_ar,
            "label_en": order.title_en,
            "detail": f"{order.vendor.name_en} · {order.get_status_display()}",
        }
        for order in matches
    ]


def serialize_detail(order: PurchaseOrder) -> dict[str, Any]:
    """Full purchase-order payload (only called after the clearance check passes)."""
    return {
        "id": order.id,
        "vendor": order.vendor_id,
        "vendor_name_ar": order.vendor.name_ar,
        "vendor_name_en": order.vendor.name_en,
        "title_ar": order.title_ar,
        "title_en": order.title_en,
        "total": str(order.total),
        "status": order.status,
        "classification": order.classification,
        "updated_at": order.updated_at.isoformat(),
    }


def create_purchase_order(data: dict[str, Any]) -> PurchaseOrder:
    """Persist a new purchase order (clearance guard lives in the view)."""
    return PurchaseOrder.objects.create(**data)


def update_purchase_order(order: PurchaseOrder, data: dict[str, Any]) -> PurchaseOrder:
    """Apply a partial update to ``order`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(order, field, value)
    order.save()
    return order


def delete_purchase_order(order: PurchaseOrder) -> None:
    """Remove a purchase order (clearance guard lives in the view)."""
    order.delete()
