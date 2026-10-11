from rest_framework.decorators import api_view
from rest_framework.response import Response 
from .serializers import ALlSerializer

from rest_framework import status
@api_view(['POST'])
def new(request):
    # body = request.data
    # print(body)
    serializer = ALlSerializer(data=request.data)
    if serializer.is_valid():
        return Response({
            'serializer.data': serializer.data
        })
    print(serializer.is_valid())
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)