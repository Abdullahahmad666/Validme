from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from reports.models import Report
from research.views import parse_uuid


class ReportView(APIView):
    """GET /reports/{project_id} — the latest report snapshot for one of your projects."""

    def get(self, request, project_id: str):
        pid = parse_uuid(project_id)
        # Owner isolation: someone else's project (or a malformed id) is a 404.
        project = Project.objects.filter(pk=pid, owner=request.user).select_related("market").first() if pid else None
        if project is None:
            raise Http404
        report = Report.objects.filter(project=project).order_by("-created_at").first()
        if report is None:
            raise Http404
        market = getattr(project, "market", None)
        return Response(
            {
                "project": {
                    "id": str(project.id),
                    "name": project.name,
                    "status": project.status,
                    "industry": market.industry if market else "",
                    "audiences": market.audiences if market else [],
                    "geographies": market.geographies if market else [],
                },
                "created_at": report.created_at,
                **report.content,
            }
        )
