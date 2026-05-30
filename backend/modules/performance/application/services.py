"""Performance use-cases. Clearance filtering happens HERE (server-side), never in
the UI — reviews above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import PerformanceReview


def visible_reviews(user: Any) -> QuerySet[PerformanceReview]:
    """Review queryset limited to records at or below the user's clearance."""
    return PerformanceReview.objects.filter(classification__lte=user.clearance)


def filter_by_query(
    reviews: QuerySet[PerformanceReview], query: str
) -> QuerySet[PerformanceReview]:
    """Case-insensitive contains filter over the review's text fields."""
    return reviews.filter(Q(employee__icontains=query) | Q(period__icontains=query))


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"PerformanceReview:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting review counts (over-clearance rows are excluded)."""
    visible = visible_reviews(user)
    return {
        "key": "performance",
        "total": visible.count(),
        "by_rating": [
            {"rating": rating, "count": visible.filter(rating=rating).count()}
            for rating in PerformanceReview.Rating.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over review text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_reviews(user).filter(
        Q(employee__icontains=query) | Q(period__icontains=query)
    )[:limit]
    return [
        {
            "id": review.id,
            "kind": "performance_review",
            "label_ar": review.employee,
            "label_en": review.employee,
            "detail": f"{review.period} · {review.get_rating_display()} · {review.score}",
        }
        for review in matches
    ]


def serialize_detail(review: PerformanceReview) -> dict[str, Any]:
    """Full review payload (only called after the clearance check passes)."""
    return {
        "id": review.id,
        "employee": review.employee,
        "period": review.period,
        "score": review.score,
        "rating": review.rating,
        "notes": review.notes,
        "classification": review.classification,
        "updated_at": review.updated_at.isoformat(),
    }
