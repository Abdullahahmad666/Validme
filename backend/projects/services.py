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


# --- Dashboard: plan, recent activity, recommended next actions -------------------------------------------------


def _plan(user) -> dict:
    from billing.plans import plan_for

    return {"plan": plan_for(user), "credits": user.credits}


def recent_activity(user, limit: int = 8) -> list[dict]:
    """The latest real events across the user's projects, newest first. Each links to where it happened."""
    from lab.models import LabPage
    from monitoring.models import Change
    from radar.models import Signal

    events: list[dict] = []
    for job in ResearchJob.objects.filter(project__owner=user).select_related("project")[:limit]:
        p = job.project
        if job.status in ("COMPLETED", "PARTIALLY_COMPLETED"):
            kind, title, at = "report", f"Report ready for “{p.name}”", job.completed_at or job.created_at
            if job.status == "PARTIALLY_COMPLETED":
                title += " (some sources failed)"
            link = f"/projects/{p.id}/report"
        elif job.status == "FAILED":
            kind, title, at, link = (
                "failed",
                f"Research for “{p.name}” failed",
                job.completed_at or job.created_at,
                f"/projects/{p.id}/progress",
            )
        else:
            kind, title, at, link = (
                "running",
                f"Research started for “{p.name}”",
                job.started_at or job.created_at,
                f"/projects/{p.id}/progress",
            )
        events.append({"kind": kind, "title": title, "project_id": str(p.id), "at": at, "link": link})
    changes = (
        Change.objects.filter(project__owner=user, significance__in=["high", "medium"])
        .select_related("project")
        .order_by("-detected_at")[:limit]
    )
    for c in changes:
        events.append(
            {
                "kind": "change",
                "title": c.summary,
                "project_id": str(c.project_id),
                "at": c.detected_at,
                "link": f"/projects/{c.project_id}/monitoring",
            }
        )
    for s in Signal.objects.filter(project__owner=user).order_by("-discovered_at")[:limit]:
        events.append(
            {
                "kind": "signal",
                "title": f"Radar: {s.title}",
                "project_id": str(s.project_id),
                "at": s.discovered_at,
                "link": f"/projects/{s.project_id}/radar?signal={s.id}",
            }
        )
    for page in LabPage.objects.filter(project__owner=user, published_at__isnull=False).order_by("-published_at")[:limit]:
        events.append(
            {
                "kind": "lab",
                "title": f"Test page published: “{page.title}”",
                "project_id": str(page.project_id),
                "at": page.published_at,
                "link": f"/projects/{page.project_id}/lab/{page.id}",
            }
        )
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]


def next_actions(user, limit: int = 5) -> list[dict]:
    """Deterministic suggestions from the state of the user's 10 most recently updated projects (no AI), most useful
    first, at most two per project. Each says why and links to where to do it."""
    from datetime import timedelta

    from django.db.models import Count, Max, Sum
    from django.utils import timezone

    from lab.experiments import MIN_VIEWS
    from lab.models import LabDailyStat, LabPage
    from monitoring.models import Watch
    from projects.models import Assumption
    from radar.models import Signal
    from reports.models import Competitor

    projects = list(Project.objects.filter(owner=user).exclude(status=Project.Status.ARCHIVED).order_by("-updated_at")[:10])
    ids = [p.id for p in projects]

    def counts(qs, field="project_id"):
        return {r[field]: r["n"] for r in qs.values(field).annotate(n=Count("id"))}

    watches = counts(Watch.objects.filter(project_id__in=ids))
    competitors = counts(Competitor.objects.filter(project_id__in=ids))
    new_signals = counts(Signal.objects.filter(project_id__in=ids, status="new"))
    untested = counts(Assumption.objects.filter(project_id__in=ids, dismissed=False, status="untested", auto_status=""))
    last_report = {
        r["project_id"]: r["at"] for r in Report.objects.filter(project_id__in=ids).values("project_id").annotate(at=Max("created_at"))
    }
    pages: dict = {}
    live_pages: dict = {}
    for r in LabPage.objects.filter(project_id__in=ids).values("project_id", "id", "status"):  # one query for both
        pages[r["project_id"]] = pages.get(r["project_id"], 0) + 1
        if r["status"] == "published":
            live_pages.setdefault(r["project_id"], r["id"])
    live = {}
    if live_pages:
        live = {
            r["page__project_id"]: (r["page_id"], r["views"] or 0)
            for r in LabDailyStat.objects.filter(page_id__in=live_pages.values())
            .values("page__project_id", "page_id")
            .annotate(views=Sum("views"))
        }
    now = timezone.now()
    out: list[dict] = []
    for p in projects:
        mine: list[dict] = []
        name, pid = p.name, str(p.id)
        if p.status == Project.Status.DRAFT:
            mine.append(
                {
                    "title": f"Finish setting up “{name}”",
                    "why": "It's a draft: confirm the market and launch research.",
                    "link": f"/research/new?project={pid}",
                }
            )
        researched = p.id in last_report
        if researched and new_signals.get(p.id):
            n = new_signals[p.id]
            mine.append(
                {
                    "title": f"Review {n} new Radar signal{'s' if n != 1 else ''} for “{name}”",
                    "why": "Fresh reasons to look closer, each with its evidence.",
                    "link": f"/projects/{pid}/radar",
                }
            )
        if researched and not pages.get(p.id):
            mine.append(
                {
                    "title": f"Test demand for “{name}” with a landing page",
                    "why": "What real people do counts more than research in your score.",
                    "link": f"/projects/{pid}/lab",
                }
            )
        if p.id in live_pages:
            page_id, views = live.get(p.id, (live_pages[p.id], 0))
            if views < MIN_VIEWS:
                mine.append(
                    {
                        "title": f"Share your test page for “{name}”",
                        "why": f"It has {views} view{'s' if views != 1 else ''}; results count from {MIN_VIEWS}.",
                        "link": f"/projects/{pid}/lab/{page_id}",
                    }
                )
        if researched and untested.get(p.id):
            n = untested[p.id]
            mine.append(
                {
                    "title": f"Test {n} assumption{'s' if n != 1 else ''} for “{name}” with a survey",
                    "why": "Link survey questions to them and they're marked from the answers.",
                    "link": f"/projects/{pid}/lab",
                }
            )
        if researched and competitors.get(p.id) and not watches.get(p.id):
            mine.append(
                {
                    "title": f"Watch competitor pages for “{name}”",
                    "why": "Get told when their prices or pages change.",
                    "link": f"/projects/{pid}/monitoring",
                }
            )
        if researched and now - last_report[p.id] > timedelta(days=60):
            days = (now - last_report[p.id]).days
            mine.append(
                {
                    "title": f"Refresh the research for “{name}”",
                    "why": f"The latest report is {days} days old.",
                    "link": f"/projects/{pid}/report",
                }
            )
        out.extend({**a, "project_id": pid} for a in mine[:2])
        if len(out) >= limit:
            break
    return out[:limit]


def dashboard_details(user) -> dict:
    return {**dashboard_summary(user), **_plan(user), "recent_activity": recent_activity(user), "next_actions": next_actions(user)}
