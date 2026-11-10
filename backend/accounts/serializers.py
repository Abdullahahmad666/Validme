from rest_framework import serializers

from accounts.models import ApiKey, User
from billing.plans import limits_for


class MeSerializer(serializers.ModelSerializer):
    plan = serializers.SerializerMethodField()
    allowed_depths = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "credits", "date_joined", "plan", "allowed_depths"]
        read_only_fields = ["id", "email", "credits", "date_joined"]

    def _limits(self, obj) -> dict:
        if not hasattr(self, "_cached_limits"):
            self._cached_limits = limits_for(obj)
        return self._cached_limits

    def get_plan(self, obj) -> str:
        return self._limits(obj)["plan"]

    def get_allowed_depths(self, obj) -> list[str]:
        return self._limits(obj)["depths"]


class ApiKeySerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=1, max_length=80)

    class Meta:
        model = ApiKey
        fields = ["id", "name", "prefix", "created_at", "last_used_at", "revoked"]
        read_only_fields = ["id", "prefix", "created_at", "last_used_at", "revoked"]
