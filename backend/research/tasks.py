import logging

from celery import shared_task
from django.utils import timezone

from analytics.services import track
from billing.services import refund_job
from research.models import ResearchJob
from research.recovery import fail_job, recover_stuck_jobs, settle_project
from research.services import collect_evidence

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def run_research_job(self, job_id: str) -> str:
    # Conditional update: a job recovery already failed (and refunded) must never start running again.
    started = ResearchJob.objects.filter(pk=job_id, status__in=(ResearchJob.Status.PENDING, ResearchJob.Status.RUNNING)).update(
        status=ResearchJob.Status.RUNNING, started_at=timezone.now()
    )
    job = ResearchJob.objects.select_related("project__owner").get(pk=job_id)
    if not started:
        return job.status  # already finished (e.g. a duplicate delivery, or recovered as stuck)
    try:
        # classify → cluster → competitors → score → distribution → report
        job = collect_evidence(job)
    except Exception:
        logger.exception("research job %s crashed", job_id)
        # Never leave a job spinning: unfinished stages are marked failed, visibly, and credits come back.
        fail_job(job, "Unexpected error. Your credits were refunded.")
        raise
    if job.status == ResearchJob.Status.FAILED:
        # Nothing could be searched: the run delivered nothing, so it's free.
        refund_job(job)
        track("research_failed", user=job.project.owner, props={"depth": job.depth})
    else:
        first = (
            not ResearchJob.objects.filter(
                project__owner=job.project.owner,
                status__in=(ResearchJob.Status.COMPLETED, ResearchJob.Status.PARTIALLY_COMPLETED),
            )
            .exclude(pk=job.pk)
            .exists()
        )
        track("first_report_completed" if first else "report_completed", user=job.project.owner, props={"depth": job.depth})
    settle_project(job)
    return job.status


@shared_task
def recover_stuck_jobs_task() -> int:
    return recover_stuck_jobs()
