"""Cross-module composition root for the command center, alerts, and search.

This is the one place allowed to reach into several modules at once — and it does
so ONLY through each module's application/public interface, never their ORM. Every
slice is gated twice: by the user's ROLE (a module is included only if the role
grants it) and by CLEARANCE (each module's summary/search already counts/returns
only rows the user is cleared to see).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from modules.announcements.application import public as announcements
from modules.assets.application import public as assets
from modules.attendance.application import public as attendance
from modules.compliance.application import public as compliance
from modules.contracts.application import public as contracts
from modules.documents.application import public as documents
from modules.events.application import public as events
from modules.finance.application import public as finance
from modules.fleet.application import public as fleet
from modules.gis.application import public as gis
from modules.helpdesk.application import public as helpdesk
from modules.iam.application import public as iam
from modules.incidents.application import public as incidents
from modules.inventory.application import public as inventory
from modules.knowledge.application import public as knowledge
from modules.leave.application import public as leave
from modules.meetings.application import public as meetings
from modules.operations.application import public as operations
from modules.payroll.application import public as payroll
from modules.performance.application import public as performance
from modules.personnel.application import public as personnel
from modules.procurement.application import public as procurement
from modules.projects.application import public as projects
from modules.recruitment.application import public as recruitment
from modules.risk.application import public as risk
from modules.training.application import public as training

# module key -> (summary fn, search fn). Order defines display order.
_MODULES: dict[str, tuple[Callable[[Any], dict[str, Any]], Callable[..., list[dict[str, Any]]]]] = {
    "personnel": (personnel.module_summary, personnel.search),
    "documents": (documents.module_summary, documents.search),
    "finance": (finance.module_summary, finance.search),
    "operations": (operations.module_summary, operations.search),
    "assets": (assets.module_summary, assets.search),
    "incidents": (incidents.module_summary, incidents.search),
    "gis": (gis.module_summary, gis.search),
    "projects": (projects.module_summary, projects.search),
    "procurement": (procurement.module_summary, procurement.search),
    "inventory": (inventory.module_summary, inventory.search),
    "fleet": (fleet.module_summary, fleet.search),
    "risk": (risk.module_summary, risk.search),
    "knowledge": (knowledge.module_summary, knowledge.search),
    "attendance": (attendance.module_summary, attendance.search),
    "leave": (leave.module_summary, leave.search),
    "payroll": (payroll.module_summary, payroll.search),
    "helpdesk": (helpdesk.module_summary, helpdesk.search),
    "compliance": (compliance.module_summary, compliance.search),
    "meetings": (meetings.module_summary, meetings.search),
    "recruitment": (recruitment.module_summary, recruitment.search),
    "performance": (performance.module_summary, performance.search),
    "training": (training.module_summary, training.search),
    "contracts": (contracts.module_summary, contracts.search),
    "announcements": (announcements.module_summary, announcements.search),
    "events": (events.module_summary, events.search),
}


def _granted(user: Any, key: str) -> bool:
    return iam.can_access_module(getattr(user, "allowed_modules", []) or [], key)


def command_overview(user: Any) -> dict[str, Any]:
    """The full command-center payload: IAM dashboard + every permitted module's
    summary + derived alerts."""
    base = iam.build_dashboard_summary(user)
    modules: dict[str, Any] = {
        key: summary_fn(user)
        for key, (summary_fn, _search) in _MODULES.items()
        if _granted(user, key)
    }
    return {
        **base,
        "modules": modules,
        "alerts": derive_alerts(modules, base),
    }


def derive_alerts(modules: dict[str, Any], base: dict[str, Any]) -> list[dict[str, Any]]:
    """Operational alerts derived from the gathered module summaries (no extra DB)."""
    alerts: list[dict[str, Any]] = []

    def add(severity: str, key: str, count: int, ar: str, en: str) -> None:
        if count > 0:
            alerts.append(
                {
                    "severity": severity,
                    "module": key,
                    "count": count,
                    "message_ar": ar,
                    "message_en": en,
                }
            )

    inc = modules.get("incidents")
    if inc:
        by_sev = {row["severity"]: row["count"] for row in inc.get("by_severity", [])}
        add(
            "critical",
            "incidents",
            by_sev.get("critical", 0),
            "حوادث حرجة مفتوحة",
            "open critical incidents",
        )
        add(
            "high",
            "incidents",
            by_sev.get("high", 0),
            "حوادث عالية الخطورة",
            "high-severity incidents",
        )

    assets_s = modules.get("assets")
    if assets_s:
        down = next(
            (r["count"] for r in assets_s.get("by_condition", []) if r["condition"] == "down"), 0
        )
        add("high", "assets", down, "أصول متوقفة عن العمل", "assets currently down")

    fin = modules.get("finance")
    if fin:
        add(
            "info",
            "finance",
            int(fin.get("under_review", 0)),
            "عقود قيد المراجعة",
            "contracts under review",
        )

    denied = int(base.get("kpis", {}).get("denied_7d", 0))
    add("high", "audit", denied, "محاولات وصول مرفوضة (٧ أيام)", "denied access attempts (7d)")

    order = {"critical": 0, "high": 1, "info": 2}
    alerts.sort(key=lambda a: order.get(a["severity"], 9))
    return alerts


def global_search(user: Any, query: str, per_module: int = 5, total: int = 24) -> dict[str, Any]:
    """Federated, clearance- and role-respecting search across permitted modules."""
    results: list[dict[str, Any]] = []
    q = (query or "").strip()
    if q:
        for key, (_summary, search_fn) in _MODULES.items():
            if _granted(user, key):
                results.extend(search_fn(user, q, per_module))
    return {"query": q, "count": len(results[:total]), "results": results[:total]}
