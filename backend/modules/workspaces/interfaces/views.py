from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Workspace
from .serializers import WorkspaceWriteSerializer


class WorkspaceListView(APIView):
    """Directory of the 8 department workspaces. Every row carries a server-computed
    ``can_edit`` for the requesting user."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="workspaces", result="GRANTED")
        return Response([services.serialize(ws, request.user) for ws in services.list_workspaces()])


class WorkspaceDetailView(APIView):
    """A single department workspace. PATCH is ownership-gated: only a member of the
    owning department (or a sysadmin) may edit, and the check is enforced HERE
    server-side — the client's ``can_edit`` is never trusted."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, key: str) -> Response:
        ws = get_object_or_404(Workspace, key=key)
        return Response(services.serialize(ws, request.user))

    def patch(self, request: Request, key: str) -> Response:
        ws = get_object_or_404(Workspace, key=key)
        if not services.can_edit_workspace(request.user, ws):
            iam.record_audit(
                request,
                action="edit_workspace",
                target=f"Workspace:{key}",
                result="DENIED",
            )
            return Response(
                {"detail": "You may only edit your own department workspace."},
                status=403,
            )
        serializer = WorkspaceWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ws = services.apply_update(ws, serializer.validated_data, request.user.username)
        iam.record_audit(
            request,
            action="edit_workspace",
            target=f"Workspace:{key}",
            result="GRANTED",
        )
        return Response(services.serialize(ws, request.user))
