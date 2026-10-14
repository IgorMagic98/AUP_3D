# from rest_framework.decorators import api_view
# from rest_framework.response import Response 
# from .serializers import ALlSerializer

# from rest_framework import status
# @api_view(['POST'])
# def new(request):
#     body = request.data
#     print(body)
#     serializer = ALlSerializer(data=request.data)
#     if serializer.is_valid():
#         return Response({
#             'serializer.data': serializer.data
#         })
#     print(serializer.is_valid())
    
    
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

import sys
import os

# 1. Определяем базовую директорию проекта (/app)
# __file__ указывает на /app/main/views.py, поэтому поднимаемся на 2 уровня вверх
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 2. Формируем путь к папке solver (/app/solver)
SOLVER_DIR = os.path.join(BASE_DIR, 'solver')

# 3. Добавляем этот путь в начало списка поиска модулей Python
if SOLVER_DIR not in sys.path:
    sys.path.insert(0, SOLVER_DIR)

# Теперь импорт сработает!
from solver.flow_distribution.main import run_from_dict
# from flow_distribution.main import run_from_dict

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .serializers import ALlSerializer

@api_view(['POST'])
def new(request):
    body = request.data
    print("📥 Получены данные от Three.js")
    
    serializer = ALlSerializer(data=body)
    if not serializer.is_valid():
        print("❌ Ошибки валидации:", serializer.errors)
        return Response({
            "status": "error",
            "message": "Ошибка валидации данных",
            "details": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    print("✅ Валидация прошла успешно")
    
    try:
        result = run_from_dict(serializer.validated_data)
        print(f"✅ Расчет завершен. P_source = {result['summary']['source_pressure_m']} м")
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            "status": "error",
            "message": f"Внутренняя ошибка при расчете: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)