from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from accounts.models import ApiKey
from accounts.serializers import ApiKeySerializer, MeSerializer
from accounts.services import TooManyApiKeys, issue_api_key, revoke_api_key


class ApiKeyLimit(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "api_key_limit"
    default_detail = "API key limit reached."


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class ApiKeyViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Keys for the MCP server. The raw key is returned once, on create; only its hash is stored."""

    serializer_class = ApiKeySerializer

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
