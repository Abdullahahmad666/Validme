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
        ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        return key.user, key

    def authenticate_header(self, request):
        return self.keyword
