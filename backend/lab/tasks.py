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


@shared_task(ignore_result=True)
def send_data_request_link(encrypted_email: str, kind: str) -> None:
    """Email a respondent the confirm link for a copy/deletion request (only if anything is held for the address).
    No result is stored and nothing is returned: either would say whether the address is held."""
    from lab.data_requests import send_link

    send_link(encrypted_email, kind)


@shared_task(ignore_result=True)
def evaluate_assumptions_task(project_id) -> None:
    """Recompute assumption verdicts from survey answers (after answers arrive or are deleted, or questions change)."""
    from lab.verdicts import evaluate_assumptions
    from projects.models import Project

    project = Project.objects.filter(pk=project_id).first()
    if project is not None:
        evaluate_assumptions(project)
