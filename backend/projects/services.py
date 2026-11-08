from evidence.models import Evidence
from projects.models import Project
from reports.models import Report
from research.models import ResearchJob

ACTIVE_JOB_STATES = [ResearchJob.Status.PENDING, ResearchJob.Status.RUNNING]


def dashboard_summary(user) -> dict:
    """Real counts for the dashboard KPI row. All scoped to the user's own projects."""
    projects = Project.objects.filter(owner=user).exclude(status=Project.Status.ARCHIVED)
    return {
        "projects": projects.count(),
        "reports": Report.objects.filter(project__owner=user).count(),
        "evidence": Evidence.objects.filter(project__owner=user, duplicate_of__isnull=True).count(),
        "active_jobs": ResearchJob.objects.filter(project__owner=user, status__in=ACTIVE_JOB_STATES).count(),
    }
