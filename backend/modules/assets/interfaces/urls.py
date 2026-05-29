from django.urls import path

from .views import AssetDetailView, AssetListView

urlpatterns = [
    path("", AssetListView.as_view(), name="asset-list"),
    path("<int:pk>", AssetDetailView.as_view(), name="asset-detail"),
]
