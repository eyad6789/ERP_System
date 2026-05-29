from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Asset
from .serializers import AssetDetailSerializer, AssetListSerializer, AssetWriteSerializer

ORDERING_WHITELIST = frozenset({"name_en", "asset_type", "condition", "classification"})


class AssetListView(APIView):
    """Clearance-filtered asset inventory. Assets above the viewer's clearance are
    excluded server-side (not merely hidden in the UI). Also creates assets, never
    above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "assets"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="assets", result="GRANTED")
        assets = services.visible_assets(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            assets = services.filter_by_query(assets, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                assets = assets.order_by(ordering)

        return Response(AssetListSerializer(assets, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AssetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_asset"
        )
        asset = serializer.save()
        iam.record_audit(
            request, action="create_asset", target=f"Asset:{asset.pk}", result="GRANTED"
        )
        return Response(AssetDetailSerializer(asset).data, status=201)


class AssetDetailView(APIView):
    """Asset detail. The object-level clearance check (IDOR defense) withholds an
    asset whose classification exceeds the viewer's clearance and audits it. Also
    edits and deletes assets after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "assets"

    def get(self, request: Request, pk: int) -> Response:
        asset = get_object_or_404(Asset, pk=pk)
        enforce_object_clearance(request, asset, action="view_asset")
        return Response(AssetDetailSerializer(asset).data)

    def patch(self, request: Request, pk: int) -> Response:
        asset = get_object_or_404(Asset, pk=pk)
        enforce_object_clearance(request, asset, action="view_asset")
        serializer = AssetWriteSerializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_asset",
            )
        asset = serializer.save()
        iam.record_audit(
            request, action="update_asset", target=f"Asset:{asset.pk}", result="GRANTED"
        )
        return Response(AssetDetailSerializer(asset).data)

    def delete(self, request: Request, pk: int) -> Response:
        asset = get_object_or_404(Asset, pk=pk)
        enforce_object_clearance(request, asset, action="view_asset")
        asset_pk = asset.pk
        asset.delete()
        iam.record_audit(
            request, action="delete_asset", target=f"Asset:{asset_pk}", result="GRANTED"
        )
        return Response(status=204)
