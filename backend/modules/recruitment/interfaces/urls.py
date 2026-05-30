from django.urls import path

from .views import ApplicantDetailView, ApplicantListView

urlpatterns = [
    path("", ApplicantListView.as_view(), name="applicant-list"),
    path("<int:pk>", ApplicantDetailView.as_view(), name="applicant-detail"),
]
