"""Founder-side survey API (Week 14): /projects/{id}/lab-surveys and its actions. Owner only; API keys read-only, and
never for answers or emails (personal data stays in signed-in web sessions)."""

from __future__ import annotations

import csv
import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import ApiKey, User
from lab import crypto
from lab.blocks import clean_text, slug_problem, slug_taken, text_problem
from lab.models import RetiredSlug, Survey, SurveyDailyStat
from lab.surveys import clean_questions, publish_problems, sample_note, structure, validate_questions
from lab.views import MAX_BODY_BYTES, MAX_JSON_DEPTH, MAX_RETENTION_DAYS, MIN_RETENTION_DAYS, _json_depth
from monitoring.views import ApiKeysReadOnly, _owned_project


def survey_url(survey: Survey) -> str | None:
    return f"{settings.LAB_ORIGIN.rstrip('/')}/s/{survey.slug}" if survey.slug else None


def surveys_allowed(user) -> int:
    from billing.plans import plan_for

    return int(settings.LAB_SURVEYS.get(plan_for(user), 1))


def _csv_cell(value: str) -> str:
    """Neutralise spreadsheet formulas (CSV injection)."""
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


class SurveySerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    base_url = serializers.SerializerMethodField()
    consent_preview = serializers.SerializerMethodField()
    responses = serializers.IntegerField(source="response_count", read_only=True, default=0)

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "intro",
            "slug",
            "questions",
            "ask_email",
            "status",
            "retention_days",
            "published_at",
            "created_at",
            "updated_at",
            "url",
            "base_url",
            "consent_preview",
            "responses",
        ]
        read_only_fields = ["status", "published_at", "created_at", "updated_at", "url", "responses"]

    def get_url(self, obj):
        return survey_url(obj) if obj.status in (Survey.Status.PUBLISHED, Survey.Status.CLOSED) else None

    def get_base_url(self, obj):
        return f"{settings.LAB_ORIGIN.rstrip('/')}/s/"

    def get_consent_preview(self, obj):
        from lab.public_surveys import consent_text

        return consent_text(obj)

    def _plain(self, v: str, label: str) -> str:
        v = clean_text(v)
        problem = text_problem(v)
        if problem:
            raise serializers.ValidationError(problem)
        return v

    def validate_title(self, v):
        v = " ".join(self._plain(v, "title").split())
        if not v:
            raise serializers.ValidationError("Give the survey a title.")
        return v

    def validate_intro(self, v):
        return self._plain(v or "", "intro")

    def validate_questions(self, v):
        if not isinstance(v, list):
            raise serializers.ValidationError("Questions must be a list.")
        v = clean_questions(v)
        project = self.context["project"]
        ids = set(project.assumptions.values_list("id", flat=True))
        problems = validate_questions(v, ids)
        if problems:
            raise serializers.ValidationError(problems)
        return v

    def validate_slug(self, v):
        if v in (None, ""):
            return None
        v = v.lower()
        if self.instance is not None and v == self.instance.slug:
            return v
        problem = slug_problem(v)
        if problem:
            raise serializers.ValidationError(problem)
        if slug_taken(v, survey_id=self.instance.pk if self.instance else None):
            raise serializers.ValidationError("That address is taken.")
        return v

    def validate_retention_days(self, v):
        if not MIN_RETENTION_DAYS <= v <= MAX_RETENTION_DAYS:
            raise serializers.ValidationError(f"Between {MIN_RETENTION_DAYS} and {MAX_RETENTION_DAYS} days.")
        return v

    def update(self, instance, validated):
        live = instance.status in (Survey.Status.PUBLISHED, Survey.Status.CLOSED)
        if live and "slug" in validated and validated["slug"] != instance.slug:
            raise ValidationError({"slug": "Unpublish the survey before changing its address (links people have would break)."})
        if instance.published_at and instance.slug and "slug" in validated and validated["slug"] != instance.slug:
            RetiredSlug.objects.get_or_create(slug=instance.slug)
        if "questions" in validated and structure(validated["questions"]) != structure(instance.questions):
            if instance.responses.exists():
                raise ValidationError(
                    {
                        "questions": (
                            "This survey has answers, so questions and options can't be added, removed or reordered (the "
                            "answers would no longer match). You can still fix wording. Delete the answers to change them."
                        )
                    }
                )
        if "ask_email" in validated and validated["ask_email"] != instance.ask_email and instance.responses.exists():
            raise ValidationError({"ask_email": "People answered under the current consent text; delete the answers to change this."})
        if instance.status == Survey.Status.PUBLISHED:
            from types import SimpleNamespace

            candidate = SimpleNamespace(
                title=validated.get("title", instance.title),
                slug=instance.slug,
                questions=validated.get("questions", instance.questions),
            )
            problems = publish_problems(candidate)
            if problems:
                raise ValidationError({"questions": problems})
        return super().update(instance, validated)


class SurveyViewSet(viewsets.ModelViewSet):
    serializer_class = SurveySerializer
    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None  # bounded by LAB_SURVEYS

    def initial(self, request, *args, **kwargs):
        if request.method in ("POST", "PATCH"):
            raw = request._request.body
            if len(raw) > MAX_BODY_BYTES or _json_depth(raw) > MAX_JSON_DEPTH:
                raise ValidationError("This survey is too large.")
        super().initial(request, *args, **kwargs)

    def _project(self):
        if not hasattr(self, "_project_cache"):
            self._project_cache = _owned_project(self.request, self.kwargs["project_pk"])
        return self._project_cache

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "project": self._project()}

    def _no_api_keys(self):
        if isinstance(self.request.auth, ApiKey):
            raise PermissionDenied("Survey answers are only available in the web app.")

    def get_queryset(self):
        live = Q(responses__expires_at__gt=timezone.now())
        return Survey.objects.filter(project=self._project()).annotate(response_count=Count("responses", filter=live))

    def perform_create(self, serializer):
        with transaction.atomic():
            User.objects.select_for_update().filter(pk=self.request.user.pk).first()  # serialize the cap check
            used = Survey.objects.filter(project__owner=self.request.user).count()
            allowed = surveys_allowed(self.request.user)
            if used >= allowed:
                raise PermissionDenied(
                    f"Your plan includes {allowed} survey{'s' if allowed != 1 else ''}. Founder and Pro plans include more."
                )
            serializer.save(project=self._project())

    def perform_destroy(self, instance):
        if instance.published_at and instance.slug:
            RetiredSlug.objects.get_or_create(slug=instance.slug)
        instance.delete()

    def _fresh(self, survey):
        return Response(self.get_serializer(self.get_queryset().get(pk=survey.pk)).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, project_pk=None, pk=None):
        survey = self.get_object()
        if not request.user.emailaddress_set.filter(email__iexact=request.user.email, verified=True).exists():
            return Response(
                {"error": {"code": "unverified", "message": "Verify your email address before publishing a survey."}}, status=403
            )
        problems = publish_problems(survey)
        if problems:
            return Response({"error": {"code": "not_ready", "message": problems[0], "details": problems}}, status=400)
        survey.status = Survey.Status.PUBLISHED
        survey.published_at = survey.published_at or timezone.now()
        survey.save(update_fields=["status", "published_at", "updated_at"])
        return self._fresh(survey)

    @action(detail=True, methods=["post"])
    def close(self, request, project_pk=None, pk=None):
        """Stop taking answers but keep the address (it says the survey is closed)."""
        survey = self.get_object()
        if survey.status == Survey.Status.PUBLISHED:
            survey.status = Survey.Status.CLOSED
            survey.save(update_fields=["status", "updated_at"])
        return self._fresh(survey)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, project_pk=None, pk=None):
        survey = self.get_object()
        if survey.status in (Survey.Status.PUBLISHED, Survey.Status.CLOSED):
            survey.status = Survey.Status.UNPUBLISHED
            survey.save(update_fields=["status", "updated_at"])
        return self._fresh(survey)

    def _live_responses(self, survey):
        return survey.responses.filter(expires_at__gt=timezone.now())

    @action(detail=True, methods=["get"])
    def results(self, request, project_pk=None, pk=None):
        """Aggregates only (no typed text, no emails), so it is safe to show next to the questions."""
        survey = self.get_object()
        rows = list(self._live_responses(survey).values_list("answers", "text_encrypted"))
        n = len(rows)
        totals = SurveyDailyStat.objects.filter(survey=survey).aggregate(views=Sum("views"), responses=Sum("responses"))
        views = totals["views"] or 0
        questions = []
        for q in survey.questions:
            qid, kind = q["id"], q["type"]
            if kind == "text":
                answered = sum(1 for _a, t in rows if t and qid in _typed_keys(t))
                questions.append(
                    {"id": qid, "type": kind, "prompt": q["prompt"], "answered": answered, "sample": sample_note(answered)}
                )
                continue
            values = [a.get(qid) for a, _t in rows if a.get(qid) is not None]
            answered = len(values)
            entry: dict = {"id": qid, "type": kind, "prompt": q["prompt"], "answered": answered, "sample": sample_note(answered)}
            if q.get("assumption_id") is not None:
                entry["assumption_id"] = q["assumption_id"]
            if kind in ("single", "multi"):
                counts = [0] * len(q.get("options") or [])
                for v in values:
                    for i in v if isinstance(v, list) else [v]:
                        if isinstance(i, int) and 0 <= i < len(counts):
                            counts[i] += 1
                entry["options"] = [
                    {"label": label, "count": c, "share": round(c / answered, 4) if answered else None}
                    for label, c in zip(q["options"], counts, strict=True)
                ]
                entry["note"] = "People could pick several, so shares add up to more than 100%." if kind == "multi" else ""
            else:
                dist = [sum(1 for v in values if v == k) for k in range(1, 6)]
                ordered = sorted(values)
                entry["distribution"] = [{"value": k, "count": c} for k, c in zip(range(1, 6), dist, strict=True)]
                entry["median"] = _median(ordered)
                entry["low_label"] = q.get("low_label") or "Not at all"
                entry["high_label"] = q.get("high_label") or "Very much"
            questions.append(entry)
        return Response(
            {
                "responses": n,
                "views": views,
                "response_rate": round((totals["responses"] or 0) / views, 4) if views else None,
                "sample": sample_note(n),
                "questions": questions,
                "note": "Answers come from the people you reached, not a random sample of your market.",
            }
        )

    @action(detail=True, methods=["get"])
    def responses(self, request, project_pk=None, pk=None):
        self._no_api_keys()
        survey = self.get_object()
        out = []
        for r in self._live_responses(survey)[:500]:
            out.append(
                {
                    "id": r.id,
                    "submitted_at": r.submitted_at,
                    "expires_at": r.expires_at,
                    "email": crypto.decrypt(r.email_encrypted) if r.email_encrypted else None,
                    "answers": _labelled(survey, r),
                }
            )
        return Response({"results": out})

    @action(detail=True, methods=["get"], url_path="responses-export")
    def responses_export(self, request, project_pk=None, pk=None):
        self._no_api_keys()
        survey = self.get_object()
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="survey-{survey.slug or survey.pk}.csv"'
        resp["Cache-Control"] = "no-store"
        w = csv.writer(resp)
        w.writerow(["submitted_at", "delete_after", "email", *[_csv_cell(q["prompt"]) for q in survey.questions]])
        for r in self._live_responses(survey).iterator():
            answers = {a["id"]: a["answer"] for a in _labelled(survey, r)}
            email = crypto.decrypt(r.email_encrypted) or "" if r.email_encrypted else ""
            w.writerow(
                [
                    r.submitted_at.isoformat(),
                    r.expires_at.date().isoformat(),
                    _csv_cell(email),
                    *[_csv_cell(answers.get(q["id"]) or "") for q in survey.questions],
                ]
            )
        return resp

    @action(detail=True, methods=["post"], url_path="responses/delete")
    def delete_responses(self, request, project_pk=None, pk=None):
        """POST {ids: [...]} or {all: true}: delete answers permanently."""
        qs = self.get_object().responses.all()
        body = request.data if isinstance(request.data, dict) else {}
        if body.get("all") is True:
            n, _ = qs.delete()
        else:
            raw = body.get("ids")
            ids = [i for i in raw if type(i) is int][:500] if isinstance(raw, list) else []
            n, _ = qs.filter(pk__in=ids).delete()
        return Response({"deleted": n})

    @action(detail=True, methods=["get"])
    def stats(self, request, project_pk=None, pk=None):
        survey = self.get_object()
        since = timezone.localdate() - timedelta(days=29)
        rows = list(SurveyDailyStat.objects.filter(survey=survey, day__gte=since).values("day", "views", "responses"))
        return Response({"daily": rows, "since": since})


def _typed_keys(token: str) -> set:
    try:
        return set(json.loads(crypto.decrypt(token) or "{}"))
    except ValueError:
        return set()


def _median(ordered: list) -> float | None:
    if not ordered:
        return None
    mid = len(ordered) // 2
    return float(ordered[mid]) if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def _labelled(survey: Survey, r) -> list[dict]:
    """Each answer as readable text (option labels, scale numbers, decrypted typed text). None = not answered or
    can't be decrypted."""
    typed = {}
    if r.text_encrypted:
        try:
            typed = json.loads(crypto.decrypt(r.text_encrypted) or "{}")
        except ValueError:
            typed = {}
    out = []
    for q in survey.questions:
        qid, opts = q["id"], q.get("options") or []
        v = typed.get(qid) if q["type"] == "text" else r.answers.get(qid)
        if v is None:
            shown = None
        elif q["type"] == "single":
            shown = opts[v] if isinstance(v, int) and v < len(opts) else None
        elif q["type"] == "multi":
            shown = "; ".join(opts[i] for i in v if isinstance(i, int) and i < len(opts)) or None
        else:
            shown = str(v)
        out.append({"id": qid, "prompt": q["prompt"], "answer": shown})
    return out


class SurveySuggestView(APIView):
    """POST /projects/{id}/lab-survey-suggest — AI questions from the founder's assumptions (labelled; web sessions)."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    throttle_scope = "ai"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request, project_pk: str):
        from lab.suggest import SuggestError, suggest_questions

        project = _owned_project(request, project_pk)
        try:
            questions = suggest_questions(project, request.user)
        except SuggestError as exc:
            return Response({"error": {"code": "unavailable", "message": str(exc)}}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"questions": questions, "ai": True})
