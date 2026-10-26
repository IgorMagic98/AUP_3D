from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from .views import new

urlpatterns = [
    path('api/sole/', new, name='solve'),
    path('api/', include('api.urls')), 
    path('admin/', admin.site.urls),  
]
