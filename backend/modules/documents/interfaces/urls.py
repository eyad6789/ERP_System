from django.urls import path

from .views import DocumentDetailView, DocumentListView

urlpatterns = [
    path("", DocumentListView.as_view(), name="document-list"),
    path("<int:pk>", DocumentDetailView.as_view(), name="document-detail"),
]
