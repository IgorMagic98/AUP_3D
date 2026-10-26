"""Сериализаторы для API."""
import base64
from collections import Counter

from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers
from elements.models import Sprinkler



class SprinklerSerializer(serializers.ModelSerializer):
    """Сериализатор для класса TagViewSet."""
    class Meta:
        model = Sprinkler
        fields = ('name', 'K')
