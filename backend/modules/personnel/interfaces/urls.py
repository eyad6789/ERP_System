from django.urls import path

from .views import OrgTreeView, PersonnelDetailView, PersonnelListView

urlpatterns = [
    path("", PersonnelListView.as_view(), name="personnel-list"),
    path("tree", OrgTreeView.as_view(), name="personnel-tree"),
    path("<int:pk>", PersonnelDetailView.as_view(), name="personnel-detail"),
]
