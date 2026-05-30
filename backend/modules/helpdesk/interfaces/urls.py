from django.urls import path

from .views import TicketDetailView, TicketListView, TicketStatusView

urlpatterns = [
    path("", TicketListView.as_view(), name="ticket-list"),
    path("<int:pk>", TicketDetailView.as_view(), name="ticket-detail"),
    path("<int:pk>/status", TicketStatusView.as_view(), name="ticket-status"),
]
