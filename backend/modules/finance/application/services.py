"""Finance use-cases.

Two complementary clearance patterns are used here:

* Budget summary uses the FILTER pattern: expenditures above the viewer's
  clearance are excluded from every aggregate, so the totals returned to the
  client only ever reflect spend the user is cleared to see. The headline
  ``spent`` reconciles exactly with the sum of the returned ``by_department``
  amounts.
* Contract listing uses the REDACT pattern: every contract row is returned (the
  user knows it exists) but its sensitive fields (title/vendor/value) are
  withheld server-side and ``locked`` is set when over-clearance.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Sum

from modules.iam.application import public as iam

from ..infrastructure.models import Budget, Contract, Expenditure


def budget_summary(user: Any) -> dict[str, Any]:
    """Latest budget totals plus clearance-filtered spend aggregates.

    Only expenditures with ``classification <= user.clearance`` are counted, and
    ``spent`` equals the sum of the returned ``by_department`` amounts.
    """
    budget = Budget.objects.order_by("-fiscal_year").first()
    visible = Expenditure.objects.filter(classification__lte=user.clearance)

    by_department = [
        {"department_code": row["department_code"], "amount": str(row["total"])}
        for row in visible.values("department_code")
        .annotate(total=Sum("amount"))
        .order_by("department_code")
    ]
    by_category = [
        {"category": row["category"], "amount": str(row["total"])}
        for row in visible.values("category").annotate(total=Sum("amount")).order_by("category")
    ]

    spent = sum((Decimal(d["amount"]) for d in by_department), Decimal("0"))
    total = budget.total_amount if budget else Decimal("0")
    remaining = total - spent

    return {
        "fiscal_year": budget.fiscal_year if budget else None,
        "currency": budget.currency if budget else "IQD",
        "total_amount": str(total),
        "spent": str(spent),
        "remaining": str(remaining),
        "by_department": by_department,
        "by_category": by_category,
    }


def list_contracts(user: Any) -> list[dict[str, Any]]:
    """All contracts, with title/vendor/value withheld for over-clearance rows."""
    items: list[dict[str, Any]] = []
    for contract in Contract.objects.select_related("owner").all():
        visible = iam.can_read_sensitivity(user.clearance, contract.classification)
        items.append(
            {
                "id": contract.id,
                "classification": contract.classification,
                "locked": not visible,
                "status": contract.status,
                "progress": contract.progress,
                # Sensitive fields are withheld server-side when over-clearance.
                "title_ar": contract.title_ar if visible else None,
                "title_en": contract.title_en if visible else None,
                "vendor": contract.vendor if visible else None,
                "value": str(contract.value) if visible else None,
            }
        )
    return items


def serialize_contract(contract: Contract) -> dict[str, Any]:
    """Full contract payload (only called after the clearance check passes)."""
    return {
        "id": contract.id,
        "title_ar": contract.title_ar,
        "title_en": contract.title_en,
        "vendor": contract.vendor,
        "value": str(contract.value),
        "progress": contract.progress,
        "status": contract.status,
        "classification": contract.classification,
        "owner": contract.owner.username if contract.owner else None,
        "updated_at": contract.updated_at.isoformat(),
    }


def export_rows(user: Any) -> list[dict[str, Any]]:
    """Clearance-filtered export rows (only contracts the user is cleared for)."""
    visible = Contract.objects.filter(classification__lte=user.clearance).order_by("title_en")
    return [serialize_contract(contract) for contract in visible]
