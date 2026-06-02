from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.HealthView.as_view(), name='health'),
    path('forecast/', views.ForecastView.as_view(), name='forecast'),
    path('optimize-inventory/', views.OptimizeInventoryView.as_view(), name='optimize-inventory'),
]
