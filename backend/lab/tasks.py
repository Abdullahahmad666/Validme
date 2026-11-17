from celery import shared_task


@shared_task
def purge_expired_signups() -> int:
    """Daily: delete waitlist sign-ups past their retention period (the period shown to people when they joined)."""
    from django.utils import timezone

    from lab.models import WaitlistSignup

    n, _ = WaitlistSignup.objects.filter(expires_at__lte=timezone.now()).delete()
    return n


@shared_task
def purge_expired_responses() -> int:
    """Daily: delete survey responses past their retention period (shown in the survey's consent text)."""
    from django.utils import timezone

    from lab.models import SurveyResponse

    n, _ = SurveyResponse.objects.filter(expires_at__lte=timezone.now()).delete()
    return n


@shared_task
def send_data_request_link(encrypted_email: str, kind: str) -> bool:
    """Email a respondent the confirm link for a copy/deletion request (only if anything is held for the address)."""
    from lab.data_requests import send_link

    return send_link(encrypted_email, kind)
