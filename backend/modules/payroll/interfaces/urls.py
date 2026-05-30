from django.urls import path

from .views import PayslipDetailView, PayslipListView

urlpatterns = [
    path("", PayslipListView.as_view(), name="payslip-list"),
    path("<int:pk>", PayslipDetailView.as_view(), name="payslip-detail"),
]
