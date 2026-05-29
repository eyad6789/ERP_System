from django.urls import path

from .views import (
    BudgetSummaryView,
    ContractDetailView,
    ContractExportView,
    ContractListView,
)

urlpatterns = [
    path("summary", BudgetSummaryView.as_view(), name="finance-summary"),
    path("contracts", ContractListView.as_view(), name="contract-list"),
    path("contracts/<int:pk>", ContractDetailView.as_view(), name="contract-detail"),
    path("export", ContractExportView.as_view(), name="finance-export"),
]
