from celery import shared_task

from monitoring.engine import check_watch, claim_due


@shared_task
def run_due_watches() -> int:
    """Beat entry point: lease due watches and fan out one task per check."""
    ids, token = claim_due()
    for watch_id in ids:
        check_watch_task.delay(watch_id, token)
    return len(ids)


# Own time limits: a bounded fetch, a linear diff and at most one bounded AI call; never the research-job limit.
@shared_task(acks_late=True, max_retries=0, soft_time_limit=150, time_limit=180)  # fetch + optional AI summary
def check_watch_task(watch_id: int, lease_token: str | None = None) -> str:
    return str(check_watch(watch_id, lease_token))
