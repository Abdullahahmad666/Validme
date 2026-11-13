from celery import shared_task
from django.contrib.auth import get_user_model

from mailer.digest import recipients, send_digest


@shared_task
def send_weekly_digests() -> int:
    """Beat entry point (weekly): one task per recipient; each send is idempotent per ISO week."""
    ids = list(recipients().values_list("id", flat=True))
    for user_id in ids:
        send_digest_task.delay(user_id)
    return len(ids)


@shared_task(max_retries=0, soft_time_limit=60, time_limit=90)
def send_digest_task(user_id: int) -> str:
    user = get_user_model().objects.filter(pk=user_id).first()
    return str(send_digest(user)) if user else "skipped"
