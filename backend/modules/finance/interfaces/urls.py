from django.urls import path

from .views import (
    BudgetSummaryView,
    ContractDetailView,
    ContractExportView,
    ContractListView,
    ContractStatusView,
)

urlpatterns = [
    path("summary", BudgetSummaryView.as_view(), name="finance-summary"),
    path("contracts", ContractListView.as_view(), name="contract-list"),
    path("contracts/<int:pk>", ContractDetailView.as_view(), name="contract-detail"),
    path("contracts/<int:pk>/status", ContractStatusView.as_view(), name="contract-status"),
    path("export", ContractExportView.as_view(), name="finance-export"),
]
