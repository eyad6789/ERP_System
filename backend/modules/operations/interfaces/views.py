from __future__ import annotations

from typing import cast

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam
from modules.iam.infrastructure.models import User

from ..application import services
from ..infrastructure.models import Task
from .serializers import TaskSerializer, TaskWriteSerializer

ORDERING_WHITELIST = frozenset({"title_en", "priority", "due_date", "status"})


class TaskListView(APIView):
    """Clearance-filtered operations board. Tasks above the viewer's clearance
    are excluded server-side (not merely hidden in the UI). POST creates a task,
    rejecting any classification above the creator's clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "operations"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="operations", result="GRANTED")
        tasks = services.visible_tasks(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            tasks = tasks.filter(
                Q(title_ar__icontains=query)
                | Q(title_en__icontains=query)
                | Q(assignee__icontains=query)
            )

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering.removeprefix("-")
            if field in ORDERING_WHITELIST:
                tasks = tasks.order_by(ordering)

        return Response(TaskSerializer(tasks, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = TaskWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        classification = serializer.validated_data["classification"]
        if not iam.can_read_sensitivity(cast("User", request.user).clearance, classification):
            raise PermissionDenied("Cannot create a task above your clearance.")
        task = serializer.save()
        iam.record_audit(request, action="create_task", target=f"Task:{task.pk}", result="GRANTED")
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    """Task detail. The object-level clearance check (IDOR defense) withholds a
    task whose classification exceeds the viewer's clearance and audits it.
    PATCH updates fields and DELETE removes the task, both clearance-gated."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "operations"

    def get(self, request: Request, pk: int) -> Response:
        task = get_object_or_404(Task, pk=pk)
        enforce_object_clearance(request, task, action="view_task")
        return Response(TaskSerializer(task).data)

    def patch(self, request: Request, pk: int) -> Response:
        task = get_object_or_404(Task, pk=pk)
        enforce_object_clearance(request, task, action="view_task")
        serializer = TaskWriteSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_classification = serializer.validated_data.get("classification")
        if new_classification is not None and not iam.can_read_sensitivity(
            cast("User", request.user).clearance, new_classification
        ):
            raise PermissionDenied("Cannot set a classification above your clearance.")
        task = serializer.save()
        iam.record_audit(request, action="update_task", target=f"Task:{task.pk}", result="GRANTED")
        return Response(TaskSerializer(task).data)

    def delete(self, request: Request, pk: int) -> Response:
        task = get_object_or_404(Task, pk=pk)
        enforce_object_clearance(request, task, action="view_task")
        iam.record_audit(request, action="delete_task", target=f"Task:{pk}", result="GRANTED")
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskStatusView(APIView):
    """State change: move a task between Open/Active/Closed. The clearance check
    runs first (over-clearance is 403 + DENIED), then the change is audited."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "operations"

    def post(self, request: Request, pk: int) -> Response:
        task = get_object_or_404(Task, pk=pk)
        enforce_object_clearance(request, task, action="view_task")
        new_status = request.data.get("status")
        if new_status not in Task.Status.values:
            raise ValidationError({"status": "Invalid status."})
        task.status = new_status
        task.save(update_fields=["status", "updated_at"])
        iam.record_audit(
            request, action="update_task_status", target=f"Task:{pk}", result="GRANTED"
        )
        return Response(TaskSerializer(task).data)
