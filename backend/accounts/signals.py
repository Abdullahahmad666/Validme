from allauth.account.models import EmailAddress
from allauth.account.signals import email_confirmed, user_signed_up
from django.conf import settings
from django.dispatch import receiver

from billing.services import grant_credits


def grant_signup_credits_once(user) -> bool:
    """Free credits once per account, and only for a verified email (stops throwaway-address farming).
    Idempotency key makes repeat signals (re-verification, Google + email) a no-op."""
    verified = EmailAddress.objects.filter(user=user, verified=True).exists()
    if not verified and settings.ACCOUNT_EMAIL_VERIFICATION != "none":
        return False
    return grant_credits(user, settings.FREE_SIGNUP_CREDITS, "signup_grant", idempotency_key=f"signup_grant:{user.pk}")


@receiver(user_signed_up)
def on_signed_up(sender, request, user, **kwargs) -> None:
    # Google signups arrive with a provider-verified email; email signups wait for confirmation.
    grant_signup_credits_once(user)


@receiver(email_confirmed)
def on_email_confirmed(sender, request, email_address, **kwargs) -> None:
    grant_signup_credits_once(email_address.user)
