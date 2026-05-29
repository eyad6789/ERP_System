"""Administration suite: user and role management (sysadmin only).

Every mutation is audited via ``iam.record_audit`` after the access checks pass.
The clearance ceiling rule applies to user creation and updates: a sysadmin may
not grant a clearance above their own.
"""

from __future__ import annotations

from typing import cast

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application import public as iam
from ..infrastructure.models import AuditEvent, Role, User
from .permissions import IsSysadmin
from .serializers import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    RoleCreateSerializer,
    RoleSerializer,
    RoleUpdateSerializer,
)


class AdminUserListView(APIView):
    """GET list all users / POST create a user (clearance ceiling enforced)."""

    permission_classes = [IsAuthenticated, IsSysadmin]

    def get(self, request: Request) -> Response:
        iam.record_audit(
            request, action="list_users", target="User", result=AuditEvent.Result.GRANTED
        )
        users = User.objects.select_related("role").order_by("username")
        return Response(AdminUserSerializer(users, many=True).data)

    def post(self, request: Request) -> Response:
        actor = cast("User", request.user)
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if int(data["clearance"]) > actor.clearance:
            iam.record_audit(
                request,
                action="create_user",
                target=f"username:{data['username']}",
                result=AuditEvent.Result.DENIED,
            )
            return Response(
                {"detail": "Cannot create a user above your own clearance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = User(
            username=data["username"],
            clearance=data["clearance"],
            department=data.get("department", ""),
            full_name_ar=data.get("full_name_ar", ""),
            full_name_en=data.get("full_name_en", ""),
            role=data.get("role"),
        )
        user.set_password(data["password"])
        user.save()

        iam.record_audit(
            request,
            action="create_user",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    """PATCH update a user's role/clearance/department/is_active."""

    permission_classes = [IsAuthenticated, IsSysadmin]

    def patch(self, request: Request, pk: int) -> Response:
        actor = cast("User", request.user)
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "clearance" in data and int(data["clearance"]) > actor.clearance:
            iam.record_audit(
                request,
                action="update_user",
                target=f"User:{user.pk}",
                result=AuditEvent.Result.DENIED,
            )
            return Response(
                {"detail": "Cannot set a clearance above your own."},
                status=status.HTTP_403_FORBIDDEN,
            )

        for field in ("role", "clearance", "department", "is_active"):
            if field in data:
                setattr(user, field, data[field])
        user.save()

        iam.record_audit(
            request,
            action="update_user",
            target=f"User:{user.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(AdminUserSerializer(user).data)


class AdminRoleListView(APIView):
    """GET list all roles / POST create a role."""

    permission_classes = [IsAuthenticated, IsSysadmin]

    def get(self, request: Request) -> Response:
        iam.record_audit(
            request, action="list_roles", target="Role", result=AuditEvent.Result.GRANTED
        )
        return Response(RoleSerializer(Role.objects.order_by("code"), many=True).data)

    def post(self, request: Request) -> Response:
        serializer = RoleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()

        iam.record_audit(
            request,
            action="create_role",
            target=f"Role:{role.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class AdminRoleDetailView(APIView):
    """PATCH update a role's modules/name/clearance."""

    permission_classes = [IsAuthenticated, IsSysadmin]

    def patch(self, request: Request, pk: int) -> Response:
        try:
            role = Role.objects.get(pk=pk)
        except Role.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = RoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(role, field, value)
        role.save()

        iam.record_audit(
            request,
            action="update_role",
            target=f"Role:{role.pk}",
            result=AuditEvent.Result.GRANTED,
        )
        return Response(RoleSerializer(role).data)
