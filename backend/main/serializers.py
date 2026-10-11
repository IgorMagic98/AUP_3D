from rest_framework import serializers


class NodeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField(max_length=51)


class EdgeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField(max_length=51)

class ALlSerializer(serializers.Serializer):
    Node = NodeSerializer(many=True)
    Edge = EdgeSerializer(many=True)
