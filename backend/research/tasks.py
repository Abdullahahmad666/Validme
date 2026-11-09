import logging

from celery import shared_task
from django.utils import timezone

from projects.models import Project
from research.models import JobStage, ResearchJob
from research.services import collect_evidence

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def run_research_job(self, job_id: str) -> str:
    job = ResearchJob.objects.select_related("project").get(pk=job_id)
    if job.status not in (ResearchJob.Status.PENDING, ResearchJob.Status.RUNNING):
        return job.status  # already finished (e.g. a duplicate delivery)
    job.status = ResearchJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])
    try:
        # Week 3-5: classify → cluster → competitors → score → distribution → report
        job = collect_evidence(job)
    except Exception:
        logger.exception("research job %s crashed", job_id)
        # Never leave a job spinning: whatever stage was running is marked failed, visibly.
        JobStage.objects.filter(job=job, status=JobStage.Status.PROCESSING).update(
            status=JobStage.Status.FAILED, detail="Unexpected error", finished_at=timezone.now()
        )
        job.status = ResearchJob.Status.FAILED
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at"])
        raise
    finally:
        # A failed job returns the project to draft so it can be edited and run again.
        done = job.status in (ResearchJob.Status.COMPLETED, ResearchJob.Status.PARTIALLY_COMPLETED)
        Project.objects.filter(pk=job.project_id).update(status=Project.Status.COMPLETED if done else Project.Status.DRAFT)
    return job.status
