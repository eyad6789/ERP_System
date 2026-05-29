from django.urls import path

from .views import TaskDetailView, TaskListView, TaskStatusView

urlpatterns = [
    path("tasks", TaskListView.as_view(), name="task-list"),
    path("tasks/<int:pk>", TaskDetailView.as_view(), name="task-detail"),
    path("tasks/<int:pk>/status", TaskStatusView.as_view(), name="task-status"),
]
