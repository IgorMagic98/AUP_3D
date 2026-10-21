from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets
from elements.models import Sprinkler
from rest_framework.pagination import LimitOffsetPagination
from api.serializers import SprinklerSerializer
from django_filters.rest_framework import DjangoFilterBackend



class RecipeViewSet(viewsets.ModelViewSet):
    queryset = Sprinkler.objects.all()
    serializer_class = SprinklerSerializer
    # pagination_class = LimitOffsetPagination
    # filter_backends = [DjangoFilterBackend]
    filterset_fields = ['name', 'K']
