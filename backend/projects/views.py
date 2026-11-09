from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from projects.models import Project
from projects.serializers import ProjectSerializer, ResearchQuerySerializer
from projects.services import dashboard_summary
from research.ai import client as llm
from research.ai.tasks import generate_queries, interpret_idea
from research.models import ResearchQuery


class AIUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "ai_unavailable"
    default_detail = "AI assistance is unavailable right now. You can continue by filling in the fields yourself."


class AIFailed(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = "ai_failed"
    default_detail = "The AI step didn't return a usable answer. Please try again."


def _run_ai(fn, *args, **kwargs):
    """Map LLM failures to clear API errors; nothing is saved when the call fails."""
    if not llm.is_configured():
        raise AIUnavailable()
    try:
        return fn(*args, **kwargs)
    except llm.LLMNotConfigured as exc:
        raise AIUnavailable() from exc
    except llm.LLMError as exc:
        raise AIFailed() from exc


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        qs = Project.objects.filter(owner=self.request.user).select_related("idea", "market", "config")
        status_filter = self.request.query_params.get("status")
        if status_filter in Project.Status.values:
            qs = qs.filter(status=status_filter)
        return qs

    def get_throttles(self):
        if self.action in ("interpret", "generate_queries"):
            self.throttle_scope = "ai"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def _draft(self) -> Project:
        project = self.get_object()
        if project.status != Project.Status.DRAFT:
            raise ValidationError({"status": "Only draft projects can be changed."})
        return project

    @action(detail=True, methods=["post"])
    def interpret(self, request, pk=None):
        """AI restatement of the idea (problem, customers, assumptions). Stored apart from the founder's text."""
        project = self._draft()
        data = _run_ai(interpret_idea, project)
        return Response({"ai_interpretation": data})

    @action(detail=True, methods=["post"], url_path="keywords/generate")
    def generate_queries(self, request, pk=None):
        """Generate search queries for all intents, or regenerate one group with {"intent": "..."}."""
        project = self._draft()
        intent = request.data.get("intent") or None
        if intent is not None and intent not in ResearchQuery.Intent.values:
            raise ValidationError({"intent": f"Must be one of {', '.join(ResearchQuery.Intent.values)}."})
        _run_ai(generate_queries, project, intent=intent)
        queries = ResearchQuery.objects.filter(project=project)
        return Response({"results": ResearchQuerySerializer(queries, many=True).data})


class ProjectQueryViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """/projects/{project_id}/queries — the founder can add, edit, disable and remove queries."""

    serializer_class = ResearchQuerySerializer
    pagination_class = None  # bounded (≤ ~40 per project) and shown grouped by intent
    MAX_QUERIES = 40

    def _project(self) -> Project:
        # Owner isolation: a project that isn't yours is a 404.
        return get_object_or_404(Project, pk=self.kwargs["project_pk"], owner=self.request.user)

    def get_queryset(self):
        return ResearchQuery.objects.filter(project=self._project())

    def _ensure_draft(self, project: Project) -> None:
        if project.status != Project.Status.DRAFT:
            raise ValidationError({"status": "Only draft projects can be changed."})

    def perform_create(self, serializer):
        project = self._project()
        self._ensure_draft(project)
        if ResearchQuery.objects.filter(project=project).count() >= self.MAX_QUERIES:
            raise ValidationError({"queries": f"A project can have at most {self.MAX_QUERIES} queries."})
        serializer.save(project=project, ai_generated=False)

    def perform_update(self, serializer):
        self._ensure_draft(serializer.instance.project)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_draft(instance.project)
        instance.delete()


class DashboardSummaryView(APIView):
    def get(self, request):
        return Response(dashboard_summary(request.user))
