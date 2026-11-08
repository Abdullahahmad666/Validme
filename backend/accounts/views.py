from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from accounts.models import ApiKey
from accounts.serializers import ApiKeySerializer, MeSerializer
from accounts.services import TooManyApiKeys, issue_api_key, revoke_api_key


class ApiKeyLimit(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "api_key_limit"
    default_detail = "API key limit reached."


class NoApiKeyForAccountChanges(permissions.BasePermission):
    """API keys (MCP) may read, but never manage keys or change the account.
    Otherwise a leaked key could mint replacement keys and survive revocation."""

    message = "Sign in to the web app to manage your account and API keys."

    def has_permission(self, request, view) -> bool:
        if isinstance(request.auth, ApiKey):
            return request.method in permissions.SAFE_METHODS and getattr(view, "api_key_can_read", False)
        return True


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated, NoApiKeyForAccountChanges]
    api_key_can_read = True

    def get_object(self):
        return self.request.user


class ApiKeyViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Keys for the MCP server. The raw key is returned once, on create; only its hash is stored."""

    serializer_class = ApiKeySerializer
    permission_classes = [permissions.IsAuthenticated, NoApiKeyForAccountChanges]

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        return ApiKey.objects.filter(user=self.request.user, revoked=False).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        body = self.get_serializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            key, raw = issue_api_key(request.user, body.validated_data["name"])
        except TooManyApiKeys as exc:
            raise ApiKeyLimit(str(exc)) from exc
        return Response({**ApiKeySerializer(key).data, "key": raw}, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        revoke_api_key(instance)
