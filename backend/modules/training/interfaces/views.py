from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import TrainingCourse
from .serializers import (
    TrainingCourseDetailSerializer,
    TrainingCourseListSerializer,
    TrainingCourseWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"title_en", "category", "hours", "status", "classification"})


class TrainingCourseListView(APIView):
    """Clearance-filtered course catalog. Courses above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates courses, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "training"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="training", result="GRANTED")
        courses = services.visible_courses(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            courses = services.filter_by_query(courses, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                courses = courses.order_by(ordering)

        return Response(TrainingCourseListSerializer(courses, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = TrainingCourseWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_course"
        )
        course = serializer.save()
        iam.record_audit(
            request, action="create_course", target=f"TrainingCourse:{course.pk}", result="GRANTED"
        )
        return Response(TrainingCourseDetailSerializer(course).data, status=201)


class TrainingCourseDetailView(APIView):
    """Course detail. The object-level clearance check (IDOR defense) withholds a
    course whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes courses after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "training"

    def get(self, request: Request, pk: int) -> Response:
        course = get_object_or_404(TrainingCourse, pk=pk)
        enforce_object_clearance(request, course, action="view_course")
        return Response(TrainingCourseDetailSerializer(course).data)

    def patch(self, request: Request, pk: int) -> Response:
        course = get_object_or_404(TrainingCourse, pk=pk)
        enforce_object_clearance(request, course, action="view_course")
        serializer = TrainingCourseWriteSerializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_course",
            )
        course = serializer.save()
        iam.record_audit(
            request, action="update_course", target=f"TrainingCourse:{course.pk}", result="GRANTED"
        )
        return Response(TrainingCourseDetailSerializer(course).data)

    def delete(self, request: Request, pk: int) -> Response:
        course = get_object_or_404(TrainingCourse, pk=pk)
        enforce_object_clearance(request, course, action="view_course")
        course_pk = course.pk
        course.delete()
        iam.record_audit(
            request, action="delete_course", target=f"TrainingCourse:{course_pk}", result="GRANTED"
        )
        return Response(status=204)
