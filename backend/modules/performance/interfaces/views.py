from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import PerformanceReview
from .serializers import (
    PerformanceReviewDetailSerializer,
    PerformanceReviewListSerializer,
    PerformanceReviewWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"employee", "period", "score", "rating", "classification"})


class PerformanceReviewListView(APIView):
    """Clearance-filtered performance reviews. Reviews above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates reviews,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "performance"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="performance", result="GRANTED")
        reviews = services.visible_reviews(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            reviews = services.filter_by_query(reviews, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                reviews = reviews.order_by(ordering)

        return Response(PerformanceReviewListSerializer(reviews, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = PerformanceReviewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_review"
        )
        review = serializer.save()
        iam.record_audit(
            request,
            action="create_review",
            target=f"PerformanceReview:{review.pk}",
            result="GRANTED",
        )
        return Response(PerformanceReviewDetailSerializer(review).data, status=201)


class PerformanceReviewDetailView(APIView):
    """Review detail. The object-level clearance check (IDOR defense) withholds a
    review whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes reviews after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "performance"

    def get(self, request: Request, pk: int) -> Response:
        review = get_object_or_404(PerformanceReview, pk=pk)
        enforce_object_clearance(request, review, action="view_review")
        return Response(PerformanceReviewDetailSerializer(review).data)

    def patch(self, request: Request, pk: int) -> Response:
        review = get_object_or_404(PerformanceReview, pk=pk)
        enforce_object_clearance(request, review, action="view_review")
        serializer = PerformanceReviewWriteSerializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_review",
            )
        review = serializer.save()
        iam.record_audit(
            request,
            action="update_review",
            target=f"PerformanceReview:{review.pk}",
            result="GRANTED",
        )
        return Response(PerformanceReviewDetailSerializer(review).data)

    def delete(self, request: Request, pk: int) -> Response:
        review = get_object_or_404(PerformanceReview, pk=pk)
        enforce_object_clearance(request, review, action="view_review")
        review_pk = review.pk
        review.delete()
        iam.record_audit(
            request,
            action="delete_review",
            target=f"PerformanceReview:{review_pk}",
            result="GRANTED",
        )
        return Response(status=204)
