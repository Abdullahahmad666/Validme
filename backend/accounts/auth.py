from datetime import timedelta

from django.utils import timezone
from rest_framework import authentication, exceptions

from accounts.models import ApiKey


class ApiKeyAuthentication(authentication.BaseAuthentication):
    """Authorization: Api-Key <raw key> — used by the MCP server."""

    keyword = "Api-Key"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith(self.keyword + " "):
            return None
        raw = header[len(self.keyword) + 1 :].strip()
        try:
            key = ApiKey.objects.select_related("user").get(key_hash=ApiKey.hash(raw), revoked=False)
        except ApiKey.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Invalid API key.") from exc
        if not key.user.is_active:
            # A deactivated account loses API access too, not just its web session.
            raise exceptions.AuthenticationFailed("Invalid API key.")
        now = timezone.now()
        if key.last_used_at is None or now - key.last_used_at > timedelta(minutes=5):
            ApiKey.objects.filter(pk=key.pk).update(last_used_at=now)  # at most one write per 5 minutes
        return key.user, key

    def authenticate_header(self, request):
        return self.keyword
