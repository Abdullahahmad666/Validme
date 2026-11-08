from accounts.models import ApiKey, User

MAX_ACTIVE_API_KEYS = 10


class TooManyApiKeys(Exception):
    pass


def issue_api_key(user: User, name: str) -> tuple[ApiKey, str]:
    if ApiKey.objects.filter(user=user, revoked=False).count() >= MAX_ACTIVE_API_KEYS:
        raise TooManyApiKeys(f"You can have at most {MAX_ACTIVE_API_KEYS} active API keys.")
    return ApiKey.issue(user, name)


def revoke_api_key(key: ApiKey) -> None:
    key.revoked = True
    key.save(update_fields=["revoked"])
