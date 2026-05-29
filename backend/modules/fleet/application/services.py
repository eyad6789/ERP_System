"""Fleet use-cases. Clearance filtering happens HERE (server-side), never in the
UI — vehicles above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Vehicle


def visible_vehicles(user: Any) -> QuerySet[Vehicle]:
    """Vehicle queryset limited to records at or below the user's clearance."""
    return Vehicle.objects.filter(classification__lte=user.clearance)


def filter_by_query(vehicles: QuerySet[Vehicle], query: str) -> QuerySet[Vehicle]:
    """Case-insensitive contains filter over the vehicle's text fields."""
    return vehicles.filter(
        Q(plate__icontains=query) | Q(make__icontains=query) | Q(vtype__icontains=query)
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
            target=f"Vehicle:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting vehicle counts (over-clearance rows are excluded)."""
    visible = visible_vehicles(user)
    return {
        "key": "fleet",
        "total": visible.count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in Vehicle.Status.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over vehicle text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_vehicles(user).filter(
        Q(plate__icontains=query) | Q(make__icontains=query) | Q(vtype__icontains=query)
    )[:limit]
    return [
        {
            "id": vehicle.id,
            "kind": "vehicle",
            "label_ar": vehicle.plate,
            "label_en": vehicle.plate,
            "detail": f"{vehicle.make} · {vehicle.vtype} · {vehicle.status}",
        }
        for vehicle in matches
    ]


def serialize_detail(vehicle: Vehicle) -> dict[str, Any]:
    """Full vehicle payload (only called after the clearance check passes)."""
    return {
        "id": vehicle.id,
        "plate": vehicle.plate,
        "vtype": vehicle.vtype,
        "make": vehicle.make,
        "status": vehicle.status,
        "odometer": vehicle.odometer,
        "classification": vehicle.classification,
        "updated_at": vehicle.updated_at.isoformat(),
    }


def create_vehicle(data: dict[str, Any]) -> Vehicle:
    """Persist a new vehicle (clearance guard lives in the view)."""
    return Vehicle.objects.create(**data)


def update_vehicle(vehicle: Vehicle, data: dict[str, Any]) -> Vehicle:
    """Apply a partial update to ``vehicle`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(vehicle, field, value)
    vehicle.save()
    return vehicle


def delete_vehicle(vehicle: Vehicle) -> None:
    """Remove a vehicle (clearance guard lives in the view)."""
    vehicle.delete()
