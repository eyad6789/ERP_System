from django.urls import path

from .views import PurchaseOrderDetailView, PurchaseOrderListView, VendorListView

urlpatterns = [
    path("", PurchaseOrderListView.as_view(), name="purchase-order-list"),
    path("vendors", VendorListView.as_view(), name="vendor-list"),
    path("<int:pk>", PurchaseOrderDetailView.as_view(), name="purchase-order-detail"),
]
