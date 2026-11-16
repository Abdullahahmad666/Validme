from celery import shared_task


@shared_task
def revalidate_all() -> int:
    """Weekly (before the digest): re-score and look for signals in every researched project of an active owner."""
    from reports.models import Report

    ids = list(Report.objects.filter(project__owner__is_active=True).values_list("project_id", flat=True).distinct().order_by())
    for project_id in ids:
        revalidate_project.delay(str(project_id))
    return len(ids)


@shared_task(max_retries=0, soft_time_limit=120, time_limit=150)
def revalidate_project(project_id: str) -> dict:
    from projects.models import Project
    from radar import services

    project = Project.objects.select_related("owner").filter(pk=project_id).first()
    if project is None:
        return {}
    result = services.revalidate(project)
    enqueue_rationales(project_id)
    return result


@shared_task(max_retries=0, soft_time_limit=120, time_limit=150)
def add_rationales_task(project_id: str) -> int:
    """AI write-ups for the strongest new signals without one (optional; capped per account per day)."""
    from django.core.cache import cache

    from radar.models import Signal
    from radar.rationale import add_rationales

    lock = f"radar:rationales:{project_id}"
    if not cache.add(lock, 1, 150):  # a refresh and a research run can't both write the same rationales
        return 0
    try:
        # ai_version="" = never attempted: a discarded or failed write-up isn't retried (it would spend the cap).
        pending = list(
            Signal.objects.filter(project_id=project_id, status__in=("new", "seen"), ai_rationale="", ai_version="")
            .select_related("project__owner", "project__idea")
            .order_by("-rank")[:10]
        )
        return add_rationales(pending)
    finally:
        cache.delete(lock)


def enqueue_rationales(project_id) -> None:
    """Queue AI write-ups; a broker hiccup must never fail the request or research run that asked for them."""
    import logging

    try:
        add_rationales_task.apply_async(args=[str(project_id)], retry=False)  # don't hang a request on a dead broker
    except Exception:  # noqa: BLE001
        logging.getLogger(__name__).warning("couldn't queue radar rationales for project %s", project_id, exc_info=True)
