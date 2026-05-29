from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Article
from .serializers import (
    ArticleDetailSerializer,
    ArticleListSerializer,
    ArticleWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "category", "classification"})


class ArticleListView(APIView):
    """Clearance-filtered knowledge base. Articles above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates articles, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "knowledge"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="knowledge", result="GRANTED")
        articles = services.visible_articles(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            articles = services.filter_by_query(articles, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                articles = articles.order_by(ordering)

        return Response(ArticleListSerializer(articles, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ArticleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_article"
        )
        article = services.create_article(serializer.validated_data)
        iam.record_audit(
            request, action="create_article", target=f"Article:{article.pk}", result="GRANTED"
        )
        return Response(ArticleDetailSerializer(article).data, status=201)


class ArticleDetailView(APIView):
    """Article detail. The object-level clearance check (IDOR defense) withholds an
    article whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes articles after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "knowledge"

    def get(self, request: Request, pk: int) -> Response:
        article = get_object_or_404(Article, pk=pk)
        enforce_object_clearance(request, article, action="view_article")
        return Response(ArticleDetailSerializer(article).data)

    def patch(self, request: Request, pk: int) -> Response:
        article = get_object_or_404(Article, pk=pk)
        enforce_object_clearance(request, article, action="view_article")
        serializer = ArticleWriteSerializer(article, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_article",
            )
        article = services.update_article(article, serializer.validated_data)
        iam.record_audit(
            request, action="update_article", target=f"Article:{article.pk}", result="GRANTED"
        )
        return Response(ArticleDetailSerializer(article).data)

    def delete(self, request: Request, pk: int) -> Response:
        article = get_object_or_404(Article, pk=pk)
        enforce_object_clearance(request, article, action="view_article")
        article_pk = article.pk
        services.delete_article(article)
        iam.record_audit(
            request, action="delete_article", target=f"Article:{article_pk}", result="GRANTED"
        )
        return Response(status=204)
