from allauth.account.signals import user_signed_up
from django.conf import settings
from django.dispatch import receiver

from billing.services import grant_credits


@receiver(user_signed_up)
def grant_signup_credits(sender, request, user, **kwargs) -> None:
    """Free credits on first signup (email or Google). Fires once per account, never on login."""
    grant_credits(user, settings.FREE_SIGNUP_CREDITS, "signup_grant")
