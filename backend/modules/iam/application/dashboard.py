"""Dashboard aggregation — computed from real IAM data only (no fabricated figures).

As later modules (personnel, finance, ...) land, they contribute their own summary
slices through their application layers and a cross-module aggregator composes them.
For now the dashboard reports what genuinely exists: users, clearance distribution,
and audit activity. The recent-audit feed is gated by the `audit` module so the
dashboard never leaks audit data to users who cannot see it.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db.models import Count
from django.utils import timezone

from ..domain import policy
from ..domain.entities import ClearanceLevel
from ..infrastructure.models import AuditEvent, Role, User

RECENT_AUDIT_LIMIT = 8
ACTIVITY_DAYS = 7


def build_dashboard_summary(user: User) -> dict[str, Any]:
    now = timezone.now()
    window_start = now - timedelta(days=ACTIVITY_DAYS - 1)

    # --- Clearance distribution across all system users (real) ---
    counts_by_level = dict(
        User.objects.values_list("clearance").annotate(n=Count("id")).values_list("clearance", "n")
    )
    clearance_distribution = [
        {"level": int(level), "count": int(counts_by_level.get(int(level), 0))}
        for level in ClearanceLevel
    ]

    # --- Audit activity over the last 7 calendar days (real) ---
    recent_events = AuditEvent.objects.filter(
        ts__gte=window_start.replace(hour=0, minute=0, second=0, microsecond=0)
    )
    buckets: dict[str, dict[str, int]] = {}
    for i in range(ACTIVITY_DAYS):
        day = (window_start + timedelta(days=i)).date().isoformat()
        buckets[day] = {"granted": 0, "denied": 0}
    for ev in recent_events.values_list("ts", "result"):
        day = timezone.localtime(ev[0]).date().isoformat()
        if day in buckets:
            key = "denied" if ev[1] == AuditEvent.Result.DENIED else "granted"
            buckets[day][key] += 1
    audit_activity = [{"date": d, **counts} for d, counts in buckets.items()]

    total_events = sum(b["granted"] + b["denied"] for b in buckets.values())
    denied_events = sum(b["denied"] for b in buckets.values())

    summary: dict[str, Any] = {
        "kpis": {
            "total_users": User.objects.count(),
            "total_roles": Role.objects.count(),
            "audit_events_7d": total_events,
            "denied_7d": denied_events,
        },
        "clearance_distribution": clearance_distribution,
        "audit_activity": audit_activity,
    }

    # --- Recent audit feed: only for users whose role grants the `audit` module ---
    if policy.can_access_module(user.allowed_modules, "audit"):
        summary["recent_audit"] = [
            {
                "ts": ev.ts.isoformat(),
                "actor_label": ev.actor_label,
                "action": ev.action,
                "target_type": ev.target_type,
                "target_id": ev.target_id,
                "result": ev.result,
            }
            for ev in AuditEvent.objects.all()[:RECENT_AUDIT_LIMIT]
        ]

    return summary
