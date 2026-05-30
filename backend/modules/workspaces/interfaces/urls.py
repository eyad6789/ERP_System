from django.urls import path

from .views import WorkspaceDetailView, WorkspaceListView

urlpatterns = [
    path("", WorkspaceListView.as_view(), name="workspace-list"),
    path("<str:key>", WorkspaceDetailView.as_view(), name="workspace-detail"),
]
