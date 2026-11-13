import base64
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from mailer.models import EmailPreference
from mailer.tokens import user_id_from
from monitoring.views import ApiKeysReadOnly

logger = logging.getLogger(__name__)


def _turn_off(user_id: int) -> bool:
    if not get_user_model().objects.filter(pk=user_id).exists():
        return False
    EmailPreference.objects.update_or_create(user_id=user_id, defaults={"weekly_digest": False})
    return True


@method_decorator(csrf_exempt, name="dispatch")
class UnsubscribeView(APIView):
    """GET (link in the email) or POST (one-click, RFC 8058) /email/unsubscribe?token=… — no sign-in needed;
    the signed token is the authority. GET only lands on the app's page, which asks before POSTing: mail
    security scanners open links in emails, and that must not unsubscribe anyone."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        app = settings.FRONTEND_URL.rstrip("/")
        if not user_id_from(token):
            return HttpResponseRedirect(f"{app}/unsubscribed?error=1")
        return HttpResponseRedirect(f"{app}/unsubscribed?{urlencode({'token': token})}")

    def post(self, request):
        ok = _turn_off(user_id_from(request.query_params.get("token", "")) or 0)
        return Response({"unsubscribed": ok}, status=200 if ok else 400)


class PreferencesSerializer(serializers.Serializer):
    weekly_digest = serializers.BooleanField()


class PreferencesView(APIView):
    """GET/PATCH /email/preferences — your email choices (web sessions; MCP keys read-only)."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]

    def get(self, request):
        pref = EmailPreference.objects.filter(user=request.user).first()
        return Response(
            {
                "weekly_digest": pref.weekly_digest if pref else True,
                "bounced": pref.bounced if pref else False,
                "email": request.user.email,
            }
        )

    def patch(self, request):
        body = PreferencesSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        defaults = {"weekly_digest": body.validated_data["weekly_digest"]}
        if body.validated_data["weekly_digest"]:
            defaults["bounced"] = False  # turning it back on means "try my address again"
        pref, _ = EmailPreference.objects.update_or_create(user=request.user, defaults=defaults)
        return Response({"weekly_digest": pref.weekly_digest, "bounced": pref.bounced, "email": request.user.email})


def verify_svix(secret: str, msg_id: str, timestamp: str, body: bytes, signatures: str, tolerance: int = 300) -> bool:
    """Resend signs webhooks with Svix: v1 = base64(HMAC-SHA256(secret, f"{id}.{ts}.{body}")); 5-minute window."""
    if not (secret and msg_id and timestamp and signatures):
        return False
    try:
        if abs(time.time() - int(timestamp)) > tolerance:
            return False
        key = base64.b64decode(secret.split("_", 1)[1] if secret.startswith("whsec_") else secret)
    except (ValueError, TypeError):
        return False
    expected = base64.b64encode(hmac.new(key, f"{msg_id}.{timestamp}.".encode() + body, hashlib.sha256).digest())
    for part in signatures.split():
        version, _, sig = part.partition(",")
        if version == "v1" and hmac.compare_digest(expected, sig.encode("latin-1", "replace")):
            return True
    return False


@method_decorator(csrf_exempt, name="dispatch")
class ResendWebhookView(APIView):
    """POST /email/webhooks/resend — bounces and spam complaints stop further digests to that address."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes: list = []

    def post(self, request):
        raw = request.body
        h = request.headers
        if not verify_svix(
            settings.RESEND_WEBHOOK_SECRET, h.get("svix-id", ""), h.get("svix-timestamp", ""), raw, h.get("svix-signature", "")
        ):
            return Response({"error": {"code": "bad_signature", "message": "Invalid signature."}}, status=401)
        try:
            event = json.loads(raw)
        except ValueError:
            return Response({"error": {"code": "bad_payload", "message": "Invalid JSON."}}, status=400)
        if event.get("type") in ("email.bounced", "email.complained"):
            to = (event.get("data") or {}).get("to") or []
            for address in to if isinstance(to, list) else [to]:
                for user in get_user_model().objects.filter(email__iexact=str(address)[:254]):
                    EmailPreference.objects.update_or_create(user=user, defaults={"bounced": True, "weekly_digest": False})
                    logger.info("digest disabled for user %s after %s", user.pk, event.get("type"))
        return Response({"ok": True})
