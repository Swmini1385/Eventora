from django.urls import path
from . import views

urlpatterns = [
    path('register/<str:event_id>/', views.public_registration_view, name='public_registration'),
]
