"""Helpdesk use-cases. Clearance filtering happens HERE (server-side), never in
the UI — tickets above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Ticket

VALID_STATUSES = {choice.value for choice in Ticket.Status}
SORTABLE_FIELDS = {"title_en", "requester", "priority", "status", "classification"}


def visible_tickets(user: Any) -> QuerySet[Ticket]:
    """Ticket queryset limited to records at or below the user's clearance."""
    return Ticket.objects.filter(classification__lte=user.clearance)


def filter_by_query(tickets: QuerySet[Ticket], query: str) -> QuerySet[Ticket]:
    """Case-insensitive contains filter over the ticket's text fields."""
    return tickets.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(requester__icontains=query)
    )


def filter_tickets(
    tickets: QuerySet[Ticket],
    *,
    query: str = "",
    ordering: str = "",
) -> QuerySet[Ticket]:
    """Apply optional icontains search and a whitelisted ordering.

    Unknown ordering keys are ignored; the clearance filter is applied upstream.
    """
    query = query.strip()
    if query:
        tickets = filter_by_query(tickets, query)
    field = ordering.lstrip("-")
    if field in SORTABLE_FIELDS:
        tickets = tickets.order_by(ordering)
    return tickets


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"Ticket:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def is_valid_status(status: str) -> bool:
    """Whether `status` is one of the allowed ticket statuses."""
    return status in VALID_STATUSES


def update_status(ticket: Ticket, status: str) -> Ticket:
    """Persist a new status (only called after the clearance check passes)."""
    ticket.status = status
    ticket.save(update_fields=["status", "updated_at"])
    return ticket


def create_ticket(data: dict[str, Any]) -> Ticket:
    """Create a ticket (the over-clearance guard runs in the view first)."""
    return Ticket.objects.create(**data)


def update_ticket(ticket: Ticket, data: dict[str, Any]) -> Ticket:
    """Apply a partial update (only called after the clearance checks pass)."""
    for field, value in data.items():
        setattr(ticket, field, value)
    ticket.save()
    return ticket


def delete_ticket(ticket: Ticket) -> None:
    """Delete a ticket (only called after the clearance check passes)."""
    ticket.delete()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting ticket counts (over-clearance rows are excluded)."""
    visible = visible_tickets(user)
    return {
        "key": "helpdesk",
        "total": visible.count(),
        "open": visible.exclude(status=Ticket.Status.CLOSED).count(),
        "by_priority": [
            {"priority": priority.value, "count": visible.filter(priority=priority.value).count()}
            for priority in Ticket.Priority
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over ticket text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_tickets(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(requester__icontains=query)
    )[:limit]
    return [
        {
            "id": ticket.id,
            "kind": "ticket",
            "label_ar": ticket.title_ar,
            "label_en": ticket.title_en,
            "detail": f"{ticket.requester} · {ticket.priority} · {ticket.status}",
        }
        for ticket in matches
    ]


def serialize_ticket(ticket: Ticket) -> dict[str, Any]:
    """Full ticket payload (list rows and detail share this shape)."""
    return {
        "id": ticket.id,
        "title_ar": ticket.title_ar,
        "title_en": ticket.title_en,
        "requester": ticket.requester,
        "priority": ticket.priority,
        "status": ticket.status,
        "classification": ticket.classification,
        "updated_at": ticket.updated_at.isoformat(),
    }


def serialize_detail(ticket: Ticket) -> dict[str, Any]:
    """Full ticket payload (only called after the clearance check passes)."""
    return serialize_ticket(ticket)
