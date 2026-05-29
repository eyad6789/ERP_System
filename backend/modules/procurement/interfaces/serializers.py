from __future__ import annotations

from rest_framework import serializers

from ..infrastructure.models import PurchaseOrder, Vendor


class VendorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = [
            "id",
            "name_ar",
            "name_en",
            "category",
            "rating",
            "classification",
        ]


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    vendor_name_ar = serializers.CharField(source="vendor.name_ar", read_only=True)
    vendor_name_en = serializers.CharField(source="vendor.name_en", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "vendor",
            "vendor_name_ar",
            "vendor_name_en",
            "title_ar",
            "title_en",
            "total",
            "status",
            "classification",
        ]


class PurchaseOrderDetailSerializer(PurchaseOrderListSerializer):
    class Meta(PurchaseOrderListSerializer.Meta):
        fields = PurchaseOrderListSerializer.Meta.fields + ["updated_at"]


class PurchaseOrderWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create/update. Clearance ceiling (the requested
    classification may not exceed the caller's clearance) is enforced in the view,
    not here, since it depends on the request user."""

    class Meta:
        model = PurchaseOrder
        fields = [
            "vendor",
            "title_ar",
            "title_en",
            "total",
            "status",
            "classification",
        ]

    def validate_classification(self, value: int) -> int:
        if value not in (1, 2, 3, 4):
            raise serializers.ValidationError("classification must be an integer 1-4.")
        return value
