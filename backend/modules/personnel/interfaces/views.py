from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Person
from .serializers import (
    PersonDetailSerializer,
    PersonListSerializer,
    PersonWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"name_en", "classification", "joined_year", "status"})


class PersonnelListView(APIView):
    """Clearance-filtered directory. Records above the viewer's clearance are
    excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "personnel"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="personnel", result="GRANTED")
        people = services.visible_personnel(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            people = people.filter(
                Q(name_ar__icontains=query)
                | Q(name_en__icontains=query)
                | Q(rank_ar__icontains=query)
                | Q(rank_en__icontains=query)
            )

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering.lstrip("-")
            if field in ORDERING_WHITELIST:
                people = people.order_by(ordering)

        return Response(PersonListSerializer(people, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = PersonWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        classification = serializer.validated_data["classification"]
        if classification > getattr(request.user, "clearance", 0):
            raise PermissionDenied()
        person = serializer.save()
        iam.record_audit(
            request, action="create_person", target=f"Person:{person.pk}", result="GRANTED"
        )
        return Response(PersonDetailSerializer(person).data, status=status.HTTP_201_CREATED)


class OrgTreeView(APIView):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "personnel"

    def get(self, request: Request) -> Response:
        return Response(services.org_tree(request.user))


class PersonnelDetailView(APIView):
    """Profile detail. The object-level clearance check (IDOR defense) withholds
    a record whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "personnel"

    def get(self, request: Request, pk: int) -> Response:
        person = get_object_or_404(Person, pk=pk)
        enforce_object_clearance(request, person, action="view_personnel")
        return Response(PersonDetailSerializer(person).data)

    def patch(self, request: Request, pk: int) -> Response:
        person = get_object_or_404(Person, pk=pk)
        enforce_object_clearance(request, person, action="view_person")
        serializer = PersonWriteSerializer(person, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_classification = serializer.validated_data.get("classification")
        if new_classification is not None and new_classification > getattr(
            request.user, "clearance", 0
        ):
            raise PermissionDenied()
        person = serializer.save()
        iam.record_audit(
            request, action="update_person", target=f"Person:{person.pk}", result="GRANTED"
        )
        return Response(PersonDetailSerializer(person).data)

    def delete(self, request: Request, pk: int) -> Response:
        person = get_object_or_404(Person, pk=pk)
        enforce_object_clearance(request, person, action="view_person")
        pk_value = person.pk
        person.delete()
        iam.record_audit(
            request, action="delete_person", target=f"Person:{pk_value}", result="GRANTED"
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
