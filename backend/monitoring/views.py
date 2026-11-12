from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from accounts.models import ApiKey
from monitoring.engine import next_run
from monitoring.models import Change, Watch
from monitoring.tasks import check_watch_task
from projects.models import Project
from research.providers.fetch import BlockedURL, FetchError, check_url
from research.views import parse_uuid


def _owned_project(request, project_pk) -> Project:
    # Owner isolation: a project that isn't yours (or a malformed id) is a 404.
    pid = parse_uuid(project_pk)
    if pid is None:
        raise Http404
    return get_object_or_404(Project, pk=pid, owner=request.user)


def validate_watch_url(url: str) -> str:
    """Public http(s) pages only; resolved once here so private/internal hosts are refused up front.
    The fetcher re-checks on every request (DNS can change)."""
    if not url.lower().startswith(("http://", "https://")):
        raise serializers.ValidationError("Only http and https pages can be watched.")
    try:
        check_url(url)
    except BlockedURL as exc:
        raise serializers.ValidationError(str(exc)) from exc
    except FetchError as exc:
        raise serializers.ValidationError("Couldn't resolve that address.") from exc
    return url


class WatchSerializer(serializers.ModelSerializer):
    url = serializers.URLField(max_length=500, validators=[validate_watch_url])
    competitor = serializers.SerializerMethodField()
    changes = serializers.IntegerField(read_only=True, source="changes_count", default=0)

    class Meta:
        model = Watch
        fields = [
            "id",
            "url",
            "label",
            "cadence",
            "active",
            "competitor",
            "changes",
            "last_status",
            "last_error",
            "last_checked_at",
            "next_run_at",
            "created_at",
        ]
        read_only_fields = ["id", "last_status", "last_error", "last_checked_at", "next_run_at", "created_at"]

    def get_competitor(self, obj):
        return {"id": obj.competitor_id, "name": obj.competitor.name} if obj.competitor_id else None

    def validate_label(self, value: str) -> str:
        return " ".join(value.split())


class ChangeSerializer(serializers.ModelSerializer):
    watch = serializers.SerializerMethodField()
    before_at = serializers.DateTimeField(source="before.fetched_at", read_only=True, default=None)
    after_url = serializers.CharField(source="after.final_url", read_only=True, default="")

    class Meta:
        model = Change
        fields = ["id", "watch", "kind", "significance", "summary", "details", "detected_at", "before_at", "after_url", "seen"]
        read_only_fields = [f for f in fields if f != "seen"]

    def get_watch(self, obj):
        return {"id": obj.watch_id, "label": obj.watch.label, "url": obj.watch.url}


class ApiKeysReadOnly(permissions.BasePermission):
    """MCP API keys may read monitoring data but never create watches or trigger fetches:
    a leaked key must not turn the server into a fetch proxy."""

    message = "Manage monitoring from the web app."

    def has_permission(self, request, view) -> bool:
        return not isinstance(request.auth, ApiKey) or request.method in permissions.SAFE_METHODS


class WatchViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """/projects/{project_id}/watches — pages to monitor (competitor pricing/feature pages)."""

    serializer_class = WatchSerializer
    pagination_class = None  # bounded by MONITORING_MAX_WATCHES_PER_PROJECT
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    throttle_scope = "monitoring"

    def get_throttles(self):
        # Anything that can make the server fetch a page is rate-limited per user.
        if self.action in ("create", "check", "from_report"):
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def _project(self) -> Project:
        if not hasattr(self, "_project_cache"):
            self._project_cache = _owned_project(self.request, self.kwargs["project_pk"])
        return self._project_cache

    def get_queryset(self):
        return Watch.objects.filter(project=self._project()).select_related("competitor").annotate(changes_count=Count("changes"))

    def _check_caps(self, project: Project, adding: int = 1) -> None:
        if Watch.objects.filter(project=project).count() + adding > settings.MONITORING_MAX_WATCHES_PER_PROJECT:
            raise ValidationError({"watches": f"A project can watch at most {settings.MONITORING_MAX_WATCHES_PER_PROJECT} pages."})
        if Watch.objects.filter(project__owner=self.request.user).count() + adding > settings.MONITORING_MAX_WATCHES_PER_USER:
            raise ValidationError({"watches": f"You can watch at most {settings.MONITORING_MAX_WATCHES_PER_USER} pages in total."})

    @transaction.atomic
    def perform_create(self, serializer):
        project = self._project()
        Project.objects.select_for_update().filter(pk=project.pk).first()  # serialize the cap check
        self._check_caps(project)
        data = serializer.validated_data
        try:
            with transaction.atomic():
                serializer.save(project=project, next_run_at=timezone.now(), label=data.get("label") or "")
        except IntegrityError as exc:
            raise ValidationError({"url": "You're already watching this page."}) from exc

    def perform_update(self, serializer):
        data = serializer.validated_data
        if "url" in data and data["url"] != serializer.instance.url:
            raise ValidationError({"url": "Remove this watch and add the new page instead."})
        extra = {}
        w = serializer.instance
        if data.get("active") and not w.active:
            # Resuming (e.g. after errors paused it): error count starts fresh; checks soon, but never sooner
            # than the manual cooldown, so pause/resume can't be used to force rapid re-fetches.
            cooldown_ends = (w.last_checked_at or timezone.now()) + timedelta(minutes=settings.MONITORING_MANUAL_COOLDOWN_MINUTES)
            extra = {"next_run_at": max(timezone.now(), cooldown_ends), "consecutive_errors": 0, "last_status": Watch.Status.PENDING}
        elif "cadence" in data and data["cadence"] != serializer.instance.cadence:
            extra = {"next_run_at": next_run(data["cadence"])}
        serializer.save(**extra)

    @action(detail=True, methods=["post"])
    def check(self, request, project_pk=None, pk=None):
        """Check now. The cooldown is claimed atomically (parallel requests can't all pass it) and the fetch runs
        on the task queue, not in this web request. Locally (eager Celery) it completes before responding."""
        watch = self.get_object()
        if not watch.active:
            raise ValidationError({"active": "Resume this watch first."})
        now = timezone.now()
        cooldown = timedelta(minutes=settings.MONITORING_MANUAL_COOLDOWN_MINUTES)
        claimed = (
            Watch.objects.filter(pk=watch.pk, active=True)
            .filter(Q(last_checked_at__isnull=True) | Q(last_checked_at__lt=now - cooldown))
            .update(last_checked_at=now)
        )
        if not claimed:
            return Response(
                {"error": {"code": "cooldown", "message": "Checked recently. Try again in a few minutes."}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        task = check_watch_task.delay(watch.pk)
        done = task.ready()
        fresh = self.get_queryset().get(pk=watch.pk)
        return Response(
            {"queued": not done, "result": str(task.result) if done else None, "watch": self.get_serializer(fresh).data},
            status=status.HTTP_200_OK if done else status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"], url_path="from-report")
    def from_report(self, request, project_pk=None):
        """Watch the websites of competitors the founder picked from their latest report."""
        from reports.models import Competitor

        project = self._project()
        ids = request.data.get("competitor_ids") if isinstance(request.data, dict) else None
        valid = isinstance(ids, list) and 0 < len(ids) <= 20
        if not valid or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            raise ValidationError({"competitor_ids": "Pick 1 to 20 competitors."})
        competitors = list(Competitor.objects.filter(project=project, pk__in=ids).exclude(website=""))
        if len(competitors) != len(set(ids)):
            raise ValidationError({"competitor_ids": "Some competitors aren't in this project or have no website."})
        # Validate (DNS lookups) before taking any lock; skip anything over the stored length.
        candidates = []
        for c in competitors:
            url = (c.pricing or {}).get("source_url") or c.website
            if len(url) > 500:
                continue
            try:
                validate_watch_url(url)
            except serializers.ValidationError:
                continue  # non-public or unresolvable: skipped, reported below
            candidates.append((c, url))
        with transaction.atomic():
            Project.objects.select_for_update().filter(pk=project.pk).first()  # serialize the cap check
            existing = set(Watch.objects.filter(project=project).values_list("url", flat=True))
            new = []
            for c, url in candidates:
                if url in existing:
                    continue
                new.append(Watch(project=project, competitor=c, url=url, label=c.name[:120], next_run_at=timezone.now()))
                existing.add(url)
            self._check_caps(project, len(new))
            Watch.objects.bulk_create(new)
        return Response({"created": len(new), "skipped": len(competitors) - len(new)}, status=status.HTTP_201_CREATED)


class ChangeViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """/projects/{project_id}/changes[?watch=&significance=] — detected changes, newest first."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]

    serializer_class = ChangeSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        project = _owned_project(self.request, self.kwargs["project_pk"])
        qs = Change.objects.filter(project=project).select_related("watch", "before", "after")
        p = self.request.query_params
        if p.get("watch", "").isdigit() and len(p["watch"]) <= 12:
            qs = qs.filter(watch_id=int(p["watch"]))
        if p.get("significance") in Change.Significance.values:
            qs = qs.filter(significance=p["significance"])
        return qs
