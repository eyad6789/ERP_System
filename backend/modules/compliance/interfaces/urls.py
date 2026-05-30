from django.urls import path

from .views import ComplianceItemDetailView, ComplianceItemListView

urlpatterns = [
    path("", ComplianceItemListView.as_view(), name="compliance-list"),
    path("<int:pk>", ComplianceItemDetailView.as_view(), name="compliance-detail"),
]
