"""Job recovery: no job spins forever, and a job that delivered nothing gives its credits back.

`recover_stuck_jobs` runs every few minutes (Celery beat) and on demand (`manage.py recover_jobs`). It catches
jobs whose worker died: PENDING too long (never picked up) or RUNNING past the time limit.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from analytics.services import track
from billing.services import refund_job
from projects.models import Project
from reports.models import Report
from research.models import JobStage, ResearchJob

logger = logging.getLogger(__name__)
OPEN_STAGES = (JobStage.Status.QUEUED, JobStage.Status.PROCESSING)


def settle_project(job: ResearchJob) -> None:
    """After a job ends: completed → COMPLETED; failed → back to DRAFT, unless earlier reports exist."""
    done = job.status in (ResearchJob.Status.COMPLETED, ResearchJob.Status.PARTIALLY_COMPLETED)
    has_report = Report.objects.filter(project_id=job.project_id).exists()
    Project.objects.filter(pk=job.project_id).update(status=Project.Status.COMPLETED if done or has_report else Project.Status.DRAFT)


def fail_job(job: ResearchJob, detail: str) -> None:
    """Mark a job failed with a visible reason on every unfinished stage, refund it, release the project."""
    JobStage.objects.filter(job=job, status__in=OPEN_STAGES).update(
        status=JobStage.Status.FAILED, detail=detail[:200], finished_at=timezone.now()
    )
    job.status = ResearchJob.Status.FAILED
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "completed_at"])
    refund_job(job)
    settle_project(job)
    track("research_failed", user=job.project.owner, props={"depth": job.depth})


def recover_stuck_jobs(now=None) -> int:
    now = now or timezone.now()
    pending_cutoff = now - timedelta(minutes=settings.JOB_PENDING_TIMEOUT_MINUTES)
    running_cutoff = now - timedelta(minutes=settings.JOB_RUNNING_TIMEOUT_MINUTES)
    stuck = ResearchJob.objects.filter(status=ResearchJob.Status.PENDING, created_at__lt=pending_cutoff) | ResearchJob.objects.filter(
        status=ResearchJob.Status.RUNNING, started_at__lt=running_cutoff
    )
    recovered = 0
    for job_id in stuck.values_list("id", flat=True):
        with transaction.atomic():
            job = ResearchJob.objects.select_for_update().select_related("project__owner").get(pk=job_id)
            if job.status not in (ResearchJob.Status.PENDING, ResearchJob.Status.RUNNING):
                continue  # finished meanwhile
            fail_job(job, "Stopped: the job didn't finish in time. Your credits were refunded.")
        logger.warning("recovered stuck job %s", job_id)
        recovered += 1
    return recovered
