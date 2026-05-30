from django.urls import path

from .views import TrainingCourseDetailView, TrainingCourseListView

urlpatterns = [
    path("", TrainingCourseListView.as_view(), name="course-list"),
    path("<int:pk>", TrainingCourseDetailView.as_view(), name="course-detail"),
]
