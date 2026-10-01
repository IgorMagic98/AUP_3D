from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from .views import sole_api, new

urlpatterns = [
    path('ayp_api/sole/', sole_api, name='solve'),
    path('api/sole/', new, name='solve'),
    path('admin/', admin.site.urls),  
]
