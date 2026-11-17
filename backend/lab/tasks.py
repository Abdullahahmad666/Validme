from celery import shared_task


@shared_task
def purge_expired_signups() -> int:
    """Daily: delete waitlist sign-ups past their retention period (the period shown to people when they joined)."""
    from django.utils import timezone

    from lab.models import WaitlistSignup

    n, _ = WaitlistSignup.objects.filter(expires_at__lte=timezone.now()).delete()
    return n
