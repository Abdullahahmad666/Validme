from django.db import transaction

from accounts.models import ApiKey, User

MAX_ACTIVE_API_KEYS = 10


class TooManyApiKeys(Exception):
    pass


@transaction.atomic
def issue_api_key(user: User, name: str) -> tuple[ApiKey, str]:
    User.objects.select_for_update().filter(pk=user.pk).first()  # serialize concurrent creates for the cap
    if ApiKey.objects.filter(user=user, revoked=False).count() >= MAX_ACTIVE_API_KEYS:
        raise TooManyApiKeys(f"You can have at most {MAX_ACTIVE_API_KEYS} active API keys.")
    return ApiKey.issue(user, name)


def revoke_api_key(key: ApiKey) -> None:
    key.revoked = True
    key.save(update_fields=["revoked"])
