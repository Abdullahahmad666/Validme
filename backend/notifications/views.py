from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from monitoring.views import ApiKeysReadOnly
from notifications.models import Notification


class _Page(PageNumberPagination):
    page_size = 20


class NotificationsView(APIView):
    """GET /notifications — your notices, newest first, plus the unread count."""

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)  # owner isolation
        pager = _Page()
        page = pager.paginate_queryset(qs, request, view=self)
        resp = pager.get_paginated_response(
            [
                {
                    "id": n.id,
                    "kind": n.kind,
                    "title": n.title,
                    "body": n.body,
                    "link": n.link,
                    "created_at": n.created_at.isoformat(),
                    "read": n.read_at is not None,
                }
                for n in page
            ]
        )
        resp.data["unread"] = qs.filter(read_at__isnull=True).count()
        return resp


class _MarkRead(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1, max_value=2**63 - 1), required=False, max_length=100)
    all = serializers.BooleanField(required=False, default=False)


class MarkReadView(APIView):
    """POST /notifications/read {ids:[...]} or {all:true}. Web sessions only (MCP keys are read-only)."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]

    def post(self, request):
        body = _MarkRead(data=request.data)
        body.is_valid(raise_exception=True)
        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
        if not body.validated_data["all"]:
            qs = qs.filter(pk__in=body.validated_data.get("ids") or [])
        updated = qs.update(read_at=timezone.now())
        return Response({"updated": updated})
