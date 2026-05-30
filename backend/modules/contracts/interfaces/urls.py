from django.urls import path

from .views import ContractDetailView, ContractListView

urlpatterns = [
    path("", ContractListView.as_view(), name="contract-list"),
    path("<int:pk>", ContractDetailView.as_view(), name="contract-detail"),
]
