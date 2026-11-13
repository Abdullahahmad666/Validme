from rest_framework import serializers

from accounts.models import ApiKey, User
from billing.plans import limits_for


class MeSerializer(serializers.ModelSerializer):
    plan = serializers.SerializerMethodField()
    allowed_depths = serializers.SerializerMethodField()
    monitoring = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "credits", "date_joined", "plan", "allowed_depths", "monitoring"]
        read_only_fields = ["id", "email", "credits", "date_joined"]

    def _limits(self, obj) -> dict:
        if not hasattr(self, "_cached_limits"):
            self._cached_limits = limits_for(obj)
        return self._cached_limits

    def get_plan(self, obj) -> str:
        return self._limits(obj)["plan"]

    def get_allowed_depths(self, obj) -> list[str]:
        return self._limits(obj)["depths"]

    def get_monitoring(self, obj) -> dict:
        """Watch slots and allowed cadences for this plan, plus how many pages are watched account-wide."""
        from billing.plans import monitoring_limits
        from monitoring.models import Watch

        lim = monitoring_limits(obj)
        return {**lim, "used": Watch.objects.filter(project__owner=obj).count()}


class ApiKeySerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=1, max_length=80)

    class Meta:
        model = ApiKey
        fields = ["id", "name", "prefix", "created_at", "last_used_at", "revoked"]
        read_only_fields = ["id", "prefix", "created_at", "last_used_at", "revoked"]
