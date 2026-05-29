"""Incident use-cases. Clearance filtering happens HERE (server-side), never in
the UI — incidents above the viewer's clearance are excluded from every query.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from ..infrastructure.models import Incident

VALID_STATUSES = {choice.value for choice in Incident.Status}


def visible_incidents(user: Any) -> QuerySet[Incident]:
    """Incident queryset limited to records at or below the user's clearance."""
    return Incident.objects.filter(classification__lte=user.clearance)


def serialize_incident(incident: Incident) -> dict[str, Any]:
    """Full incident payload (list rows and detail share this shape)."""
    return {
        "id": incident.id,
        "title_ar": incident.title_ar,
        "title_en": incident.title_en,
        "severity": incident.severity,
        "status": incident.status,
        "reported_date": (incident.reported_date.isoformat() if incident.reported_date else None),
        "classification": incident.classification,
        "updated_at": incident.updated_at.isoformat(),
    }


def is_valid_status(status: str) -> bool:
    """Whether `status` is one of the allowed incident statuses."""
    return status in VALID_STATUSES


def update_status(incident: Incident, status: str) -> Incident:
    """Persist a new status (only called after the clearance check passes)."""
    incident.status = status
    incident.save(update_fields=["status", "updated_at"])
    return incident
