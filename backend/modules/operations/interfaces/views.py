from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Task
from .serializers import TaskSerializer


class TaskListView(APIView):
    """Clearance-filtered operations board. Tasks above the viewer's clearance
    are excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "operations"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="operations", result="GRANTED")
        tasks = services.visible_tasks(request.user)
        return Response(TaskSerializer(tasks, many=True).data)


class TaskDetailView(APIView):
    """Task detail. The object-level clearance check (IDOR defense) withholds a
    task whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "operations"

    def get(self, request: Request, pk: int) -> Response:
        task = get_object_or_404(Task, pk=pk)
        enforce_object_clearance(request, task, action="view_task")
        return Response(TaskSerializer(task).data)


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
