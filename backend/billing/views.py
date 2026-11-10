import json
import logging

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import ApiKey
from billing import services
from billing.models import UsageTransaction
from billing.plans import limits_for
from billing.providers import lemonsqueezy as provider

logger = logging.getLogger(__name__)

# What users see in their usage history. Real provider costs (cost_usd) are never sent to clients.
OPERATION_LABELS = {
    "signup_grant": "Free credit for verifying your email",
    "purchase": "Credit pack",
    "research_job": "Research",
    "job_refund": "Refund: research didn't complete",
    "purchase_refund": "Credit pack refunded",
    "dev_grant": "Credits added",
}


class PacksView(APIView):
    """GET /billing/packs — plan, limits and the packs on sale (prices straight from the payment provider)."""

    def get(self, request):
        available = services.payments_available()
        return Response(
            {
                "payments_available": available,
                "limits": limits_for(request.user),
                "packs": [
                    {"id": p["id"], "credits": int(p["credits"]), "price": provider.price_label(str(p["variant_id"]))}
                    for p in services.packs()
                ]
                if available
                else [],
            }
        )


class CheckoutSerializer(serializers.Serializer):
    pack = serializers.CharField(max_length=40)


class CheckoutView(APIView):
    """POST /billing/checkout {pack} — a hosted checkout URL. Credits arrive only via the signed webhook."""

    throttle_scope = "checkout"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request):
        if isinstance(request.auth, ApiKey):
            # API keys (MCP) can spend credits but not buy them.
            return Response(
                {"error": {"code": "forbidden", "message": "Buy credits from the web app."}}, status=status.HTTP_403_FORBIDDEN
            )
        body = CheckoutSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        if not services.payments_available():
            return Response(
                {"error": {"code": "payments_unavailable", "message": "Buying credits isn't open yet."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if services.pack(body.validated_data["pack"]) is None:
            raise ValidationError({"pack": "Unknown credit pack."})
        try:
            url = services.start_checkout(request.user, body.validated_data["pack"])
        except provider.ProviderUnavailable as exc:
            return Response(
                {"error": {"code": "provider_unavailable", "message": str(exc)}}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response({"url": url})


class UsagePagination(PageNumberPagination):
    page_size = 20


class UsageView(APIView):
    """GET /billing/usage — the credit ledger for your account (credits only, no internal costs)."""

    def get(self, request):
        qs = (
            UsageTransaction.objects.filter(user=request.user)  # owner isolation
            .exclude(credits=0)  # AI drafting costs are internal, not credit changes
            .select_related("job__project")
            .order_by("-created_at", "-id")
        )
        pager = UsagePagination()
        page = pager.paginate_queryset(qs, request, view=self)
        return pager.get_paginated_response(
            [
                {
                    "id": t.id,
                    "operation": t.operation,
                    "label": OPERATION_LABELS.get(t.operation, "Adjustment"),
                    "credits": t.credits,
                    "created_at": t.created_at.isoformat(),
                    "project": ({"id": str(t.job.project_id), "name": t.job.project.name} if t.job and t.job.project else None),
                }
                for t in page
            ]
        )


@method_decorator(csrf_exempt, name="dispatch")
class LemonSqueezyWebhookView(APIView):
    """POST /billing/webhooks/lemonsqueezy — signature-verified; the only path that grants purchased credits."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes: list = []

    def post(self, request):
        raw = request.body  # read before parsing: the signature covers the exact bytes
        if not provider.verify_signature(raw, request.headers.get("X-Signature", "")):
            logger.warning("rejected webhook with a bad signature")
            return Response({"error": {"code": "bad_signature", "message": "Invalid signature."}}, status=401)
        try:
            payload = json.loads(raw)
        except ValueError:
            return Response({"error": {"code": "bad_payload", "message": "Invalid JSON."}}, status=400)
        try:
            result = services.handle_webhook(payload)
        except services.WebhookRetry as exc:
            logger.warning("lemonsqueezy webhook deferred: %s", exc)
            return Response({"error": {"code": "retry", "message": "Not ready; retry later."}}, status=409)
        logger.info("lemonsqueezy webhook: %s", result)
        return Response({"ok": True})
