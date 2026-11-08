from rest_framework import serializers

from accounts.models import ApiKey, User


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "credits", "date_joined"]
        read_only_fields = ["id", "email", "credits", "date_joined"]


class ApiKeySerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=1, max_length=80)

    class Meta:
        model = ApiKey
        fields = ["id", "name", "prefix", "created_at", "last_used_at", "revoked"]
        read_only_fields = ["id", "prefix", "created_at", "last_used_at", "revoked"]
