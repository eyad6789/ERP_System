"""Inventory use-cases. Clearance filtering happens HERE (server-side), never in
the UI — items above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import InventoryItem, Warehouse

LOW_STOCK_THRESHOLD = 10


def visible_items(user: Any) -> QuerySet[InventoryItem]:
    """Item queryset limited to records at or below the user's clearance."""
    return InventoryItem.objects.select_related("warehouse").filter(
        classification__lte=user.clearance
    )


def filter_by_query(items: QuerySet[InventoryItem], query: str) -> QuerySet[InventoryItem]:
    """Case-insensitive contains filter over the item's text fields."""
    return items.filter(
        Q(sku__icontains=query) | Q(name_ar__icontains=query) | Q(name_en__icontains=query)
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
            target=f"InventoryItem:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def create_item(data: dict[str, Any]) -> InventoryItem:
    """Persist a new inventory item (clearance guard lives in the view)."""
    return InventoryItem.objects.create(**data)


def update_item(item: InventoryItem, data: dict[str, Any]) -> InventoryItem:
    """Apply a partial update to ``item`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(item, field, value)
    item.save()
    return item


def delete_item(item: InventoryItem) -> None:
    """Remove an inventory item (clearance guard lives in the view)."""
    item.delete()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting item counts (over-clearance rows are excluded)."""
    visible = visible_items(user)
    return {
        "key": "inventory",
        "total": visible.count(),
        "low_stock": visible.filter(quantity__lt=LOW_STOCK_THRESHOLD).count(),
        "warehouses": Warehouse.objects.count(),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over item text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_items(user).filter(
        Q(sku__icontains=query) | Q(name_ar__icontains=query) | Q(name_en__icontains=query)
    )[:limit]
    return [
        {
            "id": item.id,
            "kind": "item",
            "label_ar": item.name_ar,
            "label_en": item.name_en,
            "detail": f"{item.sku} · {item.quantity} {item.unit} · {item.warehouse.name_en}",
        }
        for item in matches
    ]


def serialize_detail(item: InventoryItem) -> dict[str, Any]:
    """Full item payload (only called after the clearance check passes)."""
    return {
        "id": item.id,
        "sku": item.sku,
        "name_ar": item.name_ar,
        "name_en": item.name_en,
        "quantity": item.quantity,
        "unit": item.unit,
        "warehouse": item.warehouse.name_en,
        "classification": item.classification,
        "updated_at": item.updated_at.isoformat(),
    }
