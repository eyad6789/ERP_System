"""Knowledge use-cases. Clearance filtering happens HERE (server-side), never in
the UI — articles above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring assets/personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from modules.iam.application import public as iam

from ..infrastructure.models import Article


def visible_articles(user: Any) -> QuerySet[Article]:
    """Article queryset limited to records at or below the user's clearance."""
    return Article.objects.filter(classification__lte=user.clearance)


def filter_by_query(articles: QuerySet[Article], query: str) -> QuerySet[Article]:
    """Case-insensitive contains filter over the article's text fields."""
    return articles.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(category__icontains=query)
    )


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"Article:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def serialize_detail(article: Article) -> dict[str, Any]:
    """Full article payload (only called after the clearance check passes)."""
    return {
        "id": article.id,
        "title_ar": article.title_ar,
        "title_en": article.title_en,
        "body": article.body,
        "category": article.category,
        "classification": article.classification,
        "updated_at": article.updated_at.isoformat(),
    }


def create_article(data: dict[str, Any]) -> Article:
    """Persist a new article (clearance guard lives in the view)."""
    return Article.objects.create(**data)


def update_article(article: Article, data: dict[str, Any]) -> Article:
    """Apply a partial update to ``article`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(article, field, value)
    article.save()
    return article


def delete_article(article: Article) -> None:
    """Remove an article (clearance guard lives in the view)."""
    article.delete()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting article counts (over-clearance rows are excluded)."""
    visible = visible_articles(user)
    # .order_by() clears any model ordering so DISTINCT applies to category alone
    # (an ordered queryset would otherwise add the sort column and inflate the count).
    categories = list(visible.order_by().values_list("category", flat=True).distinct())
    return {
        "key": "knowledge",
        "total": visible.count(),
        "by_category": [
            {"category": category, "count": visible.filter(category=category).count()}
            for category in sorted(categories)
        ],
        "categories": len(categories),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over article text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_articles(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(category__icontains=query)
    )[:limit]
    return [
        {
            "id": article.id,
            "kind": "article",
            "label_ar": article.title_ar,
            "label_en": article.title_en,
            "detail": f"{article.category} · C{article.classification}",
        }
        for article in matches
    ]
