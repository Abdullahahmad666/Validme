"""Resend (https://resend.com) as a Django email backend. Gmail uses Django's built-in SMTP backend.

Only the API key from env is used; it is never logged. Errors are reported by status code only.
"""

from __future__ import annotations

import logging

import httpx
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)
API = "https://api.resend.com/emails"


class ResendEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages) -> int:
        sent = 0
        for msg in email_messages:
            html = next((c for c, mime in getattr(msg, "alternatives", []) if mime == "text/html"), None)
            payload = {
                "from": msg.from_email or settings.DEFAULT_FROM_EMAIL,
                "to": list(msg.to),
                "subject": msg.subject,
                "text": msg.body,
                "headers": {k: v for k, v in (msg.extra_headers or {}).items()},
            }
            if html:
                payload["html"] = html
            try:
                resp = httpx.post(
                    API,
                    json=payload,
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                    timeout=15,
                    trust_env=False,
                )
                resp.raise_for_status()
                sent += 1
            except httpx.HTTPError as exc:
                status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else "network"
                logger.warning("resend send failed: %s", status)
                if not self.fail_silently:
                    raise
        return sent
