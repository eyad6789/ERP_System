from django.urls import path

from .views import InventoryItemDetailView, InventoryItemListView

urlpatterns = [
    path("", InventoryItemListView.as_view(), name="item-list"),
    path("<int:pk>", InventoryItemDetailView.as_view(), name="item-detail"),
]
