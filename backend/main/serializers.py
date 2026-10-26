from rest_framework import serializers


class NodeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField(max_length=50)
    X_gl = serializers.FloatField()
    Y_gl = serializers.FloatField()
    Z_gl = serializers.FloatField()
    K = serializers.FloatField()


class EdgeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    # ВАЖНО: Добавляем поля, которые ожидает system_builder.py
    start_node = serializers.UUIDField()
    end_node = serializers.UUIDField()
    Length = serializers.FloatField()
    DN = serializers.FloatField()
    ghost = serializers.CharField(max_length=1000)
    k_t = serializers.FloatField()
    kvelocity = serializers.FloatField()    
    # type = serializers.CharField(max_length=50, required=False)  # Раскомментируйте, если поле type есть в Edge


class ALlSerializer(serializers.Serializer):
    Node = NodeSerializer(many=True)
    Edge = EdgeSerializer(many=True)
    pressure_sprinkler = serializers.FloatField()
    def validate(self, data):
        """Дополнительная проверка целостности графа"""
        node_ids = {str(n['id']) for n in data['Node']}
        
        for edge in data['Edge']:
            start = str(edge['start_node'])
            end = str(edge['end_node'])
            
            if start not in node_ids:
                raise serializers.ValidationError(
                    f"Труба {edge['id']}: start_node '{start}' не найден в списке узлов"
                )
            if end not in node_ids:
                raise serializers.ValidationError(
                    f"Труба {edge['id']}: end_node '{end}' не найден в списке узлов"
                )
        
        # Проверка наличия источника
        has_source = any(n['type'].lower() == 'source' for n in data['Node'])
        if not has_source:
            raise serializers.ValidationError("В сети должен быть хотя бы один узел с type='Source'")
            
        return data