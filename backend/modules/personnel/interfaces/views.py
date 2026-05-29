from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Person
from .serializers import PersonDetailSerializer, PersonListSerializer


class PersonnelListView(APIView):
    """Clearance-filtered directory. Records above the viewer's clearance are
    excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "personnel"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="personnel", result="GRANTED")
        people = services.visible_personnel(request.user)
        return Response(PersonListSerializer(people, many=True).data)


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
