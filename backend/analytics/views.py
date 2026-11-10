from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from analytics.services import CLIENT_EVENTS, track


def _under_anon_cap() -> bool:
    """Global daily cap for anonymous events, so rotating IPs can't fill the table."""
    key = f"analytics:anon:{timezone.now():%Y-%m-%d}"
    cache.add(key, 0, 86400 * 2)
    try:
        return cache.incr(key) <= settings.ANALYTICS_ANON_DAILY_CAP
    except ValueError:
        return True


class EventSerializer(serializers.Serializer):
    event = serializers.ChoiceField(choices=sorted(CLIENT_EVENTS))
    props = serializers.DictField(required=False)
    path = serializers.CharField(max_length=200, required=False, allow_blank=True)


class EventView(APIView):
    """POST /analytics/events — whitelisted client events; anonymous allowed, throttled. Always 204."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "analytics"

    def get_throttles(self):
        return [ScopedRateThrottle()]

    def post(self, request):
        body = EventSerializer(data=request.data)
        if body.is_valid() and (request.user.is_authenticated or _under_anon_cap()):
            # Paths only, never query strings (they can carry ids or tokens).
            path = (body.validated_data.get("path") or "").split("?")[0].split("#")[0]
            track(body.validated_data["event"], user=request.user, props=body.validated_data.get("props"), source="client", path=path)
        return Response(status=204)
