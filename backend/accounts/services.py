from django.db import transaction

from accounts.models import ApiKey, User

MAX_ACTIVE_API_KEYS = 10


class TooManyApiKeys(Exception):
    pass


@transaction.atomic
def issue_api_key(user: User, name: str, scopes: list[str] | None = None) -> tuple[ApiKey, str]:
    User.objects.select_for_update().filter(pk=user.pk).first()  # serialize concurrent creates for the cap
    if ApiKey.objects.filter(user=user, revoked=False).count() >= MAX_ACTIVE_API_KEYS:
        raise TooManyApiKeys(f"You can have at most {MAX_ACTIVE_API_KEYS} active API keys.")
    return ApiKey.issue(user, name, scopes)


def notify_write_scopes(key: ApiKey, added: list[str]) -> None:
    """Email the account owner when a key gains a scope that can change data, so an unexpected change is noticed.
    The email names the key (name and prefix, never the key) and how to undo it."""
    import logging

    from django.conf import settings
    from django.core.mail import send_mail

    from accounts.scopes import SCOPES

    if not added or not key.user.email:
        return
    brand = settings.VALIDME_BRAND
    lines = "\n".join(f"- {SCOPES[s]}" for s in added)
    body = (
        f"Your {brand} API key “{key.name}” ({key.prefix}…) can now:\n{lines}\n\n"
        "If you didn't do this, open Settings → API keys, remove the permission or revoke the key, and change your password.\n"
        f"{settings.FRONTEND_URL.rstrip('/')}/settings\n"
    )
    try:
        send_mail(f"An API key can now change data ({brand})", body, settings.DEFAULT_FROM_EMAIL, [key.user.email])
    except Exception:  # noqa: BLE001 - never fail the change because the email couldn't be sent
        logging.getLogger(__name__).warning("api key permission email could not be sent")


def revoke_api_key(key: ApiKey) -> None:
    key.revoked = True
    key.save(update_fields=["revoked"])
