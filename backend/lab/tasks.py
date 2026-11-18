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

    expired = SurveyResponse.objects.filter(expires_at__lte=timezone.now())
    projects = set(expired.values_list("survey__project_id", flat=True).distinct())
    n, _ = expired.delete()
    for pid in projects:  # verdicts cite counts: recompute without the deleted answers
        schedule_evaluation(pid)
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


EVALUATE_DEBOUNCE = 60  # seconds: a busy survey recomputes verdicts at most about once a minute


def schedule_evaluation(project_id) -> None:
    """Queue a verdict recomputation for a project, coalescing bursts (each run reads every live answer)."""
    from django.core.cache import cache

    if cache.add(f"lab:eval:{project_id}", 1, EVALUATE_DEBOUNCE):
        evaluate_assumptions_task.apply_async(args=[str(project_id)], countdown=EVALUATE_DEBOUNCE)
