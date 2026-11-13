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


@shared_task
def detect_new_competitors() -> int:
    """Weekly: look for new competitors for every project that's being monitored."""
    from monitoring.models import Watch

    ids = list(Watch.objects.filter(active=True).values_list("project_id", flat=True).distinct())
    for project_id in ids:
        detect_candidates_task.delay(str(project_id))
    return len(ids)


@shared_task(max_retries=0, soft_time_limit=60, time_limit=90)
def detect_candidates_task(project_id: str) -> int:
    from monitoring.candidates import detect
    from projects.models import Project

    project = Project.objects.select_related("owner").filter(pk=project_id).first()
    if project is None:
        return 0
    added = detect(project)
    if added:
        from django.utils import timezone

        from notifications.services import notify

        year, week, _ = timezone.now().isocalendar()
        notify(
            project.owner,
            kind="competitor_candidates",
            title=f"{project.name}: {added} possible new competitor{'s' if added != 1 else ''}",
            body="Found in recent public launches. Watch them or dismiss them.",
            link=f"/projects/{project.pk}/monitoring#candidates",
            project=project,
            source=f"cand:{project.pk}:{year}-W{week:02d}",
        )
    return added
