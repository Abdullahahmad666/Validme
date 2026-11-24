import json
import logging

from django.db.models import Q
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
from billing.plans import active_subscription, limits_for
from billing.providers import polar as provider

logger = logging.getLogger(__name__)

# What users see in their usage history. Real provider costs (cost_usd) are never sent to clients.
OPERATION_LABELS = {
    "signup_grant": "Free credit for verifying your email",
    "purchase": "Credit pack",
    "research_job": "Research",
    "job_refund": "Refund: research didn't complete",
    "purchase_refund": "Credit pack refunded",
    "dev_grant": "Credits added",
    "subscription_credits": "Monthly plan credits",
    "subscription_refund": "Plan refund",
}


class PacksView(APIView):
    """GET /billing/packs: your plan, limits, subscription, and what's on sale (provider prices when available)."""

    def get(self, request):
        available = services.payments_available()
        plans_on = provider.is_configured() and bool(services.subscription_plans())
        sub = active_subscription(request.user)
        return Response(
            {
                "payments_available": available,
                "subscriptions_available": plans_on,
                "limits": limits_for(request.user),
                "subscription": (
                    {
                        "plan": sub.plan,
                        "interval": sub.interval,
                        "status": sub.status,
                        "renews_at": sub.renews_at,
                        "ends_at": sub.ends_at,
                    }
                    if sub
                    else None
                ),
                "packs": [
                    {"id": p["id"], "credits": int(p["credits"]), "price": provider.price_label(str(p["product_id"]))}
                    for p in services.packs()
                ]
                if available
                else [],
                "plans": [
                    {
                        "id": p["id"],
                        "monthly_credits": int(p.get("monthly_credits", 0)),
                        "month": provider.price_label(str(p["monthly_product_id"])) if p.get("monthly_product_id") else None,
                        "year": provider.price_label(str(p["yearly_product_id"])) if p.get("yearly_product_id") else None,
                    }
                    for p in services.subscription_plans()
                ]
                if plans_on
                else [],
            }
        )


class SubscribeSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["founder", "pro"])
    interval = serializers.ChoiceField(choices=["month", "year"])


class SubscribeView(APIView):
    """POST /billing/subscribe {plan, interval}: hosted checkout for a plan (web sessions only)."""

    throttle_scope = "checkout"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request):
        if isinstance(request.auth, ApiKey):
            return Response({"error": {"code": "forbidden", "message": "Manage your plan from the web app."}}, status=403)
        body = SubscribeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        if not (provider.is_configured() and services.subscription_plans()):
            return Response(
                {"error": {"code": "payments_unavailable", "message": "Plans open at launch."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            url = services.start_subscription_checkout(request.user, body.validated_data["plan"], body.validated_data["interval"])
        except services.AlreadySubscribed as exc:
            return Response({"error": {"code": "already_subscribed", "message": str(exc)}}, status=status.HTTP_409_CONFLICT)
        except ValueError as exc:
            raise ValidationError({"plan": "That plan isn't available."}) from exc
        except provider.ProviderUnavailable as exc:
            return Response(
                {"error": {"code": "provider_unavailable", "message": str(exc)}}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response({"url": url})


class PortalView(APIView):
    """POST /billing/portal: a fresh link to the provider's customer portal (card, plan change, cancel)."""

    throttle_scope = "checkout"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request):
        if isinstance(request.auth, ApiKey):
            return Response({"error": {"code": "forbidden", "message": "Manage your plan from the web app."}}, status=403)
        from billing.models import Subscription

        sub = Subscription.objects.filter(user=request.user).order_by("-updated_at").first()  # owner isolation
        if sub is None:
            return Response({"error": {"code": "no_subscription", "message": "You don't have a plan yet."}}, status=404)
        try:
            return Response({"url": provider.customer_portal_url(sub.provider_subscription_id)})
        except provider.ProviderUnavailable as exc:
            return Response(
                {"error": {"code": "provider_unavailable", "message": str(exc)}}, status=status.HTTP_503_SERVICE_UNAVAILABLE
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


def _months_back(n: int) -> list[str]:
    from django.utils import timezone

    today = timezone.localdate()
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return list(reversed(out))


class UsageMonthlyView(APIView):
    """GET /billing/usage/monthly — credits used and added per month (last 12 months, zero-filled). Credits only."""

    def get(self, request):
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth

        months = _months_back(12)
        rows = (
            UsageTransaction.objects.filter(user=request.user, created_at__date__gte=f"{months[0]}-01")  # owner isolation
            .exclude(credits=0)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(used=Sum("credits", filter=Q(credits__lt=0)), added=Sum("credits", filter=Q(credits__gt=0)))
        )
        by = {r["month"].strftime("%Y-%m"): r for r in rows}
        return Response(
            {
                "results": [
                    {"month": m, "used": -(by[m]["used"] or 0) if m in by else 0, "added": (by[m]["added"] or 0) if m in by else 0}
                    for m in months
                ]
            }
        )


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
class PolarWebhookView(APIView):
    """POST /billing/webhooks/polar — Standard Webhooks signature-verified; the only path that grants paid credits."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes: list = []

    def post(self, request):
        raw = request.body  # read before parsing: the signature covers the exact bytes
        if not provider.verify_signature(raw, request.headers):
            logger.warning("rejected webhook with a bad signature")
            return Response({"error": {"code": "bad_signature", "message": "Invalid signature."}}, status=401)
        try:
            payload = json.loads(raw)
        except ValueError:
            return Response({"error": {"code": "bad_payload", "message": "Invalid JSON."}}, status=400)
        try:
            result = services.handle_webhook(payload)
        except services.WebhookRetry as exc:
            logger.warning("polar webhook deferred: %s", exc)
            return Response({"error": {"code": "retry", "message": "Not ready; retry later."}}, status=409)
        logger.info("polar webhook: %s", result)
        return Response({"ok": True})
