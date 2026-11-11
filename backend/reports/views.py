from django.db.models.fields.json import KT
from django.http import Http404, HttpResponse
from django.utils.text import slugify
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from reports.export import to_markdown
from reports.matrix import build_matrix
from reports.models import Report
from research.views import parse_uuid


def _project(request, project_id: str) -> Project:
    pid = parse_uuid(project_id)
    # Owner isolation: someone else's project (or a malformed id) is a 404.
    project = Project.objects.filter(pk=pid, owner=request.user).select_related("market").first() if pid else None
    if project is None:
        raise Http404
    return project


def _report(request, project: Project) -> Report:
    """?report=<id> picks a version from the history; the default is the latest."""
    qs = Report.objects.filter(project=project).order_by("-created_at")
    raw = request.query_params.get("report")
    if raw:
        # Bounded: a 20-digit id would overflow the integer column and 500.
        report = qs.filter(pk=int(raw)).first() if raw.isdigit() and len(raw) <= 12 else None
    else:
        report = qs.first()
    if report is None:
        raise Http404
    return report


def report_payload(project: Project, report: Report) -> dict:
    market = getattr(project, "market", None)
    return {
        "id": report.id,
        "project": {
            "id": str(project.id),
            "name": project.name,
            "status": project.status,
            "industry": market.industry if market else "",
            "audiences": market.audiences if market else [],
            "geographies": market.geographies if market else [],
        },
        "created_at": report.created_at.isoformat(),
        **report.content,
    }


class ReportView(APIView):
    """GET /reports/{project_id}[?report=<id>] — a report snapshot for one of your projects (latest by default)."""

    def get(self, request, project_id: str):
        project = _project(request, project_id)
        return Response(report_payload(project, _report(request, project)))


class ReportHistoryView(APIView):
    """GET /reports/{project_id}/history — every report for the project, newest first."""

    def get(self, request, project_id: str):
        project = _project(request, project_id)
        # Select only the JSON keys we list: reports can be large, history should stay cheap.
        rows = (
            Report.objects.filter(project=project)
            .order_by("-created_at")
            .values(
                "id",
                "created_at",
                depth=KT("content__depth"),
                score=KT("content__overview__score"),
                confidence=KT("content__overview__confidence"),
                recommendation=KT("content__overview__recommendation"),
                evidence_count=KT("content__overview__evidence_count"),
            )
        )
        results = [
            {
                "id": r["id"],
                "created_at": r["created_at"].isoformat(),
                "depth": r["depth"] or "",
                "score": int(r["score"]) if r["score"] not in (None, "", "null") else None,
                "confidence": r["confidence"] or "",
                "recommendation": r["recommendation"] or "",
                "evidence_count": int(r["evidence_count"] or 0),
            }
            for r in rows
        ]
        return Response({"count": len(results), "results": results})


class ReportExportView(APIView):
    """GET /reports/{project_id}/export[?report=<id>] — Markdown download of a report snapshot."""

    def get(self, request, project_id: str):
        project = _project(request, project_id)
        report = _report(request, project)
        body = to_markdown(report_payload(project, report))
        resp = HttpResponse(body, content_type="text/markdown; charset=utf-8")
        name = slugify(project.name)[:60] or "report"
        resp["Content-Disposition"] = f'attachment; filename="{name}-report-{report.id}.md"'
        return resp


class CompetitiveMatrixView(APIView):
    """GET /reports/{project_id}/competitive-matrix[?report=<id>] — pricing, feature grid and gap candidates."""

    def get(self, request, project_id: str):
        project = _project(request, project_id)
        report = _report(request, project)
        return Response({"report_id": report.id, **build_matrix(report.content)})
