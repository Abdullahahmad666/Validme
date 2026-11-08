from celery import shared_task
from django.utils import timezone

from research.models import ResearchJob
from research.services import collect_evidence


@shared_task(bind=True, max_retries=0)
def run_research_job(self, job_id: str) -> str:
    job = ResearchJob.objects.get(pk=job_id)
    job.status = ResearchJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])
    # Week 2-5: idea analysis → collect → classify → cluster → competitors → score → distribution → report
    job = collect_evidence(job)
    return job.status
