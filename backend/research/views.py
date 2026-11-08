from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.services import InsufficientCredits, credits_for, spend_credits
from projects.models import Project
from research.models import ResearchJob
from research.providers import registry
from research.serializers import ResearchJobCreateSerializer, ResearchJobSerializer
from research.services import create_stages
from research.tasks import run_research_job


class SourcesView(APIView):
    def get(self, request):
        data = [
            {"key": p.key, "label": p.label, "contributes": p.contributes, "availability": p.availability().value}
            for p in registry.PROVIDERS.values()
        ]
        data += [
            {"key": k, "label": k.replace("_", " ").title(), "contributes": reason, "availability": "UNAVAILABLE"}
            for k, reason in registry.UNAVAILABLE_SOURCES.items()
        ]
        return Response({"results": data})


class ResearchJobViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ResearchJobSerializer

    def get_queryset(self):
        return ResearchJob.objects.filter(project__owner=self.request.user).prefetch_related("stages")

    def create(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key:
            raise ValidationError({"Idempotency-Key": "Header is required."})
        body = ResearchJobCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            project = Project.objects.get(pk=body.validated_data["project"], owner=request.user)
        except Project.DoesNotExist as exc:
            raise NotFound("Project not found.") from exc

        existing = ResearchJob.objects.filter(project=project, idempotency_key=key).first()
        if existing:
            return Response(ResearchJobSerializer(existing).data, status=status.HTTP_200_OK)

        depth = body.validated_data["depth"]
        sources = body.validated_data.get("sources") or list(registry.PROVIDERS)
        queries = [{"text": q.text, "intent": q.intent} for q in project.queries.filter(enabled=True)]
        if not queries and hasattr(project, "idea"):
            queries = [{"text": project.idea.original_description[:200], "intent": "problem_discovery"}]
        cost = credits_for(depth)
        try:
            with transaction.atomic():
                job = ResearchJob.objects.create(
                    project=project,
                    depth=depth,
                    idempotency_key=key,
                    credits_charged=cost,
                    config_snapshot={"sources": sources, "queries": queries},
                )
                spend_credits(request.user, cost, "research_job", job=job)
                create_stages(job)
        except InsufficientCredits as exc:
            return Response(
                {"error": {"code": "insufficient_credits", "message": str(exc)}},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        project.status = Project.Status.RESEARCHING
        project.save(update_fields=["status"])
        transaction.on_commit(lambda: run_research_job.delay(str(job.id)))
        return Response(ResearchJobSerializer(job).data, status=status.HTTP_201_CREATED)
