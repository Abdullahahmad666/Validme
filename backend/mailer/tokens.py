"""Signed unsubscribe tokens: no database lookup needed, can't be forged or guessed, never expire."""

from django.core import signing

SALT = "mailer.unsubscribe.v1"


def unsubscribe_token(user_id: int) -> str:
    return signing.dumps({"u": user_id}, salt=SALT, compress=True)


def user_id_from(token: str) -> int | None:
    try:
        data = signing.loads(token, salt=SALT)
    except signing.BadSignature:
        return None
    uid = data.get("u") if isinstance(data, dict) else None
    return uid if isinstance(uid, int) else None
