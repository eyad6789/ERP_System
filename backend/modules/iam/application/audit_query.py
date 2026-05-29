"""Audit-log query helpers — filtering, pagination, and stats aggregates.

Keeps the interfaces layer thin: views parse the raw request, hand a plain dict
of params to these functions, and serialize whatever comes back. All non-trivial
ORM logic (icontains search, day bucketing, Count aggregates) lives here.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from math import ceil
from typing import Any, TypedDict

from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from ..infrastructure.models import AuditEvent

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100

STATS_DAYS = 14
TOP_ACTIONS = 8
TOP_ACTORS = 6


class AuditFilters(TypedDict, total=False):
    """Optional, already-normalised filter values parsed from the query string."""

    q: str
    action: str
    result: str
    actor: str
    target_type: str
    date_from: str
    date_to: str


def _parse_iso_date(value: str | None) -> date | None:
    """Parse an ISO date (YYYY-MM-DD); return None on blank/invalid input."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def filtered_events(filters: AuditFilters) -> QuerySet[AuditEvent]:
    """Apply the optional filters and return the matching events, newest first."""
    qs = AuditEvent.objects.all()

    q = filters.get("q")
    if q:
        qs = qs.filter(
            Q(actor_label__icontains=q)
            | Q(action__icontains=q)
            | Q(target_type__icontains=q)
            | Q(target_id__icontains=q)
        )

    action = filters.get("action")
    if action:
        qs = qs.filter(action=action)

    result = filters.get("result")
    if result in (AuditEvent.Result.GRANTED, AuditEvent.Result.DENIED):
        qs = qs.filter(result=result)

    actor = filters.get("actor")
    if actor:
        qs = qs.filter(actor_label__icontains=actor)

    target_type = filters.get("target_type")
    if target_type:
        qs = qs.filter(target_type=target_type)

    date_from = _parse_iso_date(filters.get("date_from"))
    if date_from is not None:
        qs = qs.filter(ts__date__gte=date_from)

    date_to = _parse_iso_date(filters.get("date_to"))
    if date_to is not None:
        qs = qs.filter(ts__date__lte=date_to)

    return qs.order_by("-ts")


def paginate(
    qs: QuerySet[AuditEvent], *, page: int, page_size: int
) -> tuple[list[AuditEvent], dict[str, int]]:
    """Slice `qs` for the requested page; return the rows + pagination meta."""
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    count = qs.count()
    pages = ceil(count / page_size) if count else 1
    start = (page - 1) * page_size
    rows = list(qs[start : start + page_size])

    meta = {"count": count, "page": page, "pages": pages, "page_size": page_size}
    return rows, meta


def build_audit_stats() -> dict[str, Any]:
    """Aggregate totals, per-action / per-actor breakdowns, and a 14-day series."""
    qs = AuditEvent.objects.all()

    total = qs.count()
    granted = qs.filter(result=AuditEvent.Result.GRANTED).count()
    denied = qs.filter(result=AuditEvent.Result.DENIED).count()

    by_action = [
        {"action": row["action"], "count": int(row["count"])}
        for row in qs.values("action").annotate(count=Count("id")).order_by("-count")[:TOP_ACTIONS]
    ]

    top_actors = [
        {"actor": row["actor_label"], "count": int(row["count"])}
        for row in (
            qs.values("actor_label").annotate(count=Count("id")).order_by("-count")[:TOP_ACTORS]
        )
    ]

    now = timezone.now()
    window_start = (now - timedelta(days=STATS_DAYS - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    buckets: dict[str, dict[str, int]] = {}
    for i in range(STATS_DAYS):
        day = (window_start + timedelta(days=i)).date().isoformat()
        buckets[day] = {"granted": 0, "denied": 0}
    for ts, result in qs.filter(ts__gte=window_start).values_list("ts", "result"):
        day = timezone.localtime(ts).date().isoformat()
        if day in buckets:
            key = "denied" if result == AuditEvent.Result.DENIED else "granted"
            buckets[day][key] += 1
    by_day = [{"date": day, **counts} for day, counts in buckets.items()]

    return {
        "total": total,
        "granted": granted,
        "denied": denied,
        "by_action": by_action,
        "by_day": by_day,
        "top_actors": top_actors,
    }
