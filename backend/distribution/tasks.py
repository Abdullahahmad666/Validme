from celery import shared_task


@shared_task
def purge_expired_youtube() -> int:
    """Daily: YouTube API data may be kept for at most 30 days."""
    from distribution.youtube import purge_expired

    return purge_expired()
