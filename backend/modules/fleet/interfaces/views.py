from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Vehicle
from .serializers import (
    VehicleDetailSerializer,
    VehicleListSerializer,
    VehicleWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"plate", "make", "vtype", "status", "odometer", "classification"})


class VehicleListView(APIView):
    """Clearance-filtered vehicle fleet. Vehicles above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates vehicles, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "fleet"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="fleet", result="GRANTED")
        vehicles = services.visible_vehicles(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            vehicles = services.filter_by_query(vehicles, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                vehicles = vehicles.order_by(ordering)

        return Response(VehicleListSerializer(vehicles, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = VehicleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_vehicle"
        )
        vehicle = services.create_vehicle(serializer.validated_data)
        iam.record_audit(
            request, action="create_vehicle", target=f"Vehicle:{vehicle.pk}", result="GRANTED"
        )
        return Response(VehicleDetailSerializer(vehicle).data, status=201)


class VehicleDetailView(APIView):
    """Vehicle detail. The object-level clearance check (IDOR defense) withholds a
    vehicle whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes vehicles after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "fleet"

    def get(self, request: Request, pk: int) -> Response:
        vehicle = get_object_or_404(Vehicle, pk=pk)
        enforce_object_clearance(request, vehicle, action="view_vehicle")
        return Response(VehicleDetailSerializer(vehicle).data)

    def patch(self, request: Request, pk: int) -> Response:
        vehicle = get_object_or_404(Vehicle, pk=pk)
        enforce_object_clearance(request, vehicle, action="view_vehicle")
        serializer = VehicleWriteSerializer(vehicle, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_vehicle",
            )
        vehicle = services.update_vehicle(vehicle, serializer.validated_data)
        iam.record_audit(
            request, action="update_vehicle", target=f"Vehicle:{vehicle.pk}", result="GRANTED"
        )
        return Response(VehicleDetailSerializer(vehicle).data)

    def delete(self, request: Request, pk: int) -> Response:
        vehicle = get_object_or_404(Vehicle, pk=pk)
        enforce_object_clearance(request, vehicle, action="view_vehicle")
        vehicle_pk = vehicle.pk
        services.delete_vehicle(vehicle)
        iam.record_audit(
            request, action="delete_vehicle", target=f"Vehicle:{vehicle_pk}", result="GRANTED"
        )
        return Response(status=204)
