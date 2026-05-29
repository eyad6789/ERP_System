from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Project
from .serializers import (
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectWriteSerializer,
)

ORDERING_WHITELIST = frozenset(
    {"name_en", "status", "progress", "start_date", "end_date", "classification"}
)


class ProjectListView(APIView):
    """Clearance-filtered project directory. Projects above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). Also creates projects,
    never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "projects"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="projects", result="GRANTED")
        projects = services.visible_projects(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            projects = services.filter_by_query(projects, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                projects = projects.order_by(ordering)

        return Response(ProjectListSerializer(projects, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ProjectWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_project"
        )
        project = services.create_project(serializer.validated_data)
        iam.record_audit(
            request, action="create_project", target=f"Project:{project.pk}", result="GRANTED"
        )
        return Response(ProjectDetailSerializer(project).data, status=201)


class ProjectDetailView(APIView):
    """Project detail. The object-level clearance check (IDOR defense) withholds a
    project whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes projects after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "projects"

    def get(self, request: Request, pk: int) -> Response:
        project = get_object_or_404(Project, pk=pk)
        enforce_object_clearance(request, project, action="view_project")
        return Response(ProjectDetailSerializer(project).data)

    def patch(self, request: Request, pk: int) -> Response:
        project = get_object_or_404(Project, pk=pk)
        enforce_object_clearance(request, project, action="view_project")
        serializer = ProjectWriteSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_project",
            )
        project = services.update_project(project, serializer.validated_data)
        iam.record_audit(
            request, action="update_project", target=f"Project:{project.pk}", result="GRANTED"
        )
        return Response(ProjectDetailSerializer(project).data)

    def delete(self, request: Request, pk: int) -> Response:
        project = get_object_or_404(Project, pk=pk)
        enforce_object_clearance(request, project, action="view_project")
        project_pk = project.pk
        services.delete_project(project)
        iam.record_audit(
            request, action="delete_project", target=f"Project:{project_pk}", result="GRANTED"
        )
        return Response(status=204)
