"""Founder-side Validation Lab API (app origin): /projects/{id}/lab-pages and its actions. Owner only; API keys read-only."""

from __future__ import annotations

import csv
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
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
from lab.blocks import (
    clean_blocks,
    clean_text,
    price_test,
    publish_problems,
    slug_problem,
    slug_taken,
    text_problem,
    validate_blocks,
    variant_label,
)
from lab.models import DataRequestNotice, LabDailyStat, LabPage, LabVariantStat, RetiredSlug
from lab.surveys import compare_rates, sample_note
from monitoring.views import ApiKeysReadOnly, _owned_project

MAX_BODY_BYTES = 64 * 1024
MAX_JSON_DEPTH = 8
MAX_RETENTION_DAYS = 365


def _json_depth(raw: bytes) -> int:
    """Deepest [ / { nesting outside strings, without parsing (cheap, and safe on hostile input)."""
    depth = deepest = 0
    in_str = esc = False
    for ch in raw.decode("utf-8", "replace"):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in "[{":
            depth += 1
            deepest = max(deepest, depth)
        elif ch in "]}":
            depth -= 1
    return deepest


MIN_RETENTION_DAYS = 30


def page_url(page: LabPage) -> str | None:
    return f"{settings.LAB_ORIGIN.rstrip('/')}/p/{page.slug}" if page.slug else None


def pages_allowed(user) -> int:
    from billing.plans import plan_for

    return int(settings.LAB_PAGES.get(plan_for(user), 1))


class LabPageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    base_url = serializers.SerializerMethodField()
    consent_template = serializers.SerializerMethodField()
    footer = serializers.SerializerMethodField()
    signups = serializers.IntegerField(source="signup_count", read_only=True, default=0)

    class Meta:
        model = LabPage
        fields = [
            "id",
            "title",
            "slug",
            "blocks",
            "status",
            "retention_days",
            "published_at",
            "created_at",
            "updated_at",
            "url",
            "base_url",
            "consent_template",
            "footer",
            "signups",
        ]
        read_only_fields = ["status", "published_at", "created_at", "updated_at", "url", "signups"]

    def get_consent_template(self, obj):
        """The exact consent wording of the live form, with {days} left for the preview to fill in."""
        from lab.public import CONSENT_TEMPLATE

        return CONSENT_TEMPLATE.replace("{brand}", settings.VALIDME_BRAND)

    def get_footer(self, obj):
        from lab.public import footer_text

        return footer_text()

    def get_base_url(self, obj):
        return f"{settings.LAB_ORIGIN.rstrip('/')}/p/"  # where the page lives once published

    def get_url(self, obj):
        return page_url(obj) if obj.status == LabPage.Status.PUBLISHED else None

    def validate_title(self, v):
        v = " ".join(clean_text(v).split())
        if not v:
            raise serializers.ValidationError("Give the page a title.")
        problem = text_problem(v)
        if problem:
            raise serializers.ValidationError(problem)
        return v

    def validate_blocks(self, v):
        if not isinstance(v, list):
            raise serializers.ValidationError("Blocks must be a list.")
        v = clean_blocks(v)
        problems = validate_blocks(v)
        if problems:
            raise serializers.ValidationError(problems)
        return v

    def validate_slug(self, v):
        if v in (None, ""):
            return None
        v = v.lower()
        if self.instance is not None and v == self.instance.slug:
            return v  # its own address
        problem = slug_problem(v)
        if problem:
            raise serializers.ValidationError(problem)
        if slug_taken(v, page_id=self.instance.pk if self.instance else None):
            raise serializers.ValidationError("That address is taken.")
        return v

    def validate_retention_days(self, v):
        if not MIN_RETENTION_DAYS <= v <= MAX_RETENTION_DAYS:
            raise serializers.ValidationError(f"Between {MIN_RETENTION_DAYS} and {MAX_RETENTION_DAYS} days.")
        return v

    def update(self, instance, validated):
        if instance.status == LabPage.Status.PUBLISHED and "slug" in validated and validated["slug"] != instance.slug:
            raise ValidationError({"slug": "Unpublish the page before changing its address (links people have would break)."})
        if instance.published_at and "slug" in validated and validated["slug"] != instance.slug and instance.slug:
            RetiredSlug.objects.get_or_create(slug=instance.slug)  # once live, an address is never reused
        # A new retention period applies to new sign-ups; existing ones keep the expiry they agreed to.
        if instance.status == LabPage.Status.PUBLISHED:
            # A live page stays publishable: an edit can't remove its waitlist or hero, or blank its title.
            from types import SimpleNamespace

            candidate = SimpleNamespace(
                title=validated.get("title", instance.title), slug=instance.slug, blocks=validated.get("blocks", instance.blocks)
            )
            problems = publish_problems(candidate)
            if problems:
                raise ValidationError({"blocks": problems})
        return super().update(instance, validated)


class LabPageViewSet(viewsets.ModelViewSet):
    serializer_class = LabPageSerializer
    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None  # bounded by LAB_PAGES

    def initial(self, request, *args, **kwargs):
        # Before DRF parses anything: bounded bodies and shallow JSON (a page is a dozen small blocks), so a crafted
        # request can't cost seconds of validation or blow the parser's recursion limit.
        if request.method in ("POST", "PATCH"):
            raw = request._request.body  # read once by Django; DRF reuses it
            if len(raw) > MAX_BODY_BYTES or _json_depth(raw) > MAX_JSON_DEPTH:
                raise ValidationError("This page is too large.")
        super().initial(request, *args, **kwargs)

    def _project(self):
        if not hasattr(self, "_project_cache"):
            self._project_cache = _owned_project(self.request, self.kwargs["project_pk"])
        return self._project_cache

    def _no_api_keys(self):
        # Waitlist emails are personal data: never readable with an API key (MCP), only in a signed-in session.
        if isinstance(self.request.auth, ApiKey):
            raise PermissionDenied("Waitlist emails are only available in the web app.")

    def perform_destroy(self, instance):
        if instance.published_at and instance.slug:
            RetiredSlug.objects.get_or_create(slug=instance.slug)
        instance.delete()

    def get_queryset(self):
        from django.db.models import Count, Q

        live = Q(signups__expires_at__gt=timezone.now())
        return LabPage.objects.filter(project=self._project()).annotate(signup_count=Count("signups", filter=live))

    def perform_create(self, serializer):
        with transaction.atomic():
            User.objects.select_for_update().filter(pk=self.request.user.pk).first()  # serialize the cap check
            used = LabPage.objects.filter(project__owner=self.request.user).count()
            allowed = pages_allowed(self.request.user)
            if used >= allowed:
                raise PermissionDenied(
                    f"Your plan includes {allowed} test page{'s' if allowed != 1 else ''}. Founder and Pro plans include more."
                )
            serializer.save(project=self._project())

    @action(detail=True, methods=["post"])
    def publish(self, request, project_pk=None, pk=None):
        page = self.get_object()
        if not request.user.emailaddress_set.filter(email__iexact=request.user.email, verified=True).exists():
            return Response(
                {"error": {"code": "unverified", "message": "Verify your email address before publishing a page."}}, status=403
            )
        problems = publish_problems(page)
        if problems:
            return Response({"error": {"code": "not_ready", "message": problems[0], "details": problems}}, status=400)
        page.status = LabPage.Status.PUBLISHED
        page.published_at = page.published_at or timezone.now()
        page.save(update_fields=["status", "published_at", "updated_at"])
        return Response(self.get_serializer(self.get_queryset().get(pk=page.pk)).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, project_pk=None, pk=None):
        page = self.get_object()
        if page.status == LabPage.Status.PUBLISHED:
            page.status = LabPage.Status.UNPUBLISHED
            page.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(self.get_queryset().get(pk=page.pk)).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, project_pk=None, pk=None):
        page = self.get_object()
        since = timezone.localdate() - timedelta(days=29)
        rows = list(LabDailyStat.objects.filter(page=page, day__gte=since).values("day", "views", "signups"))
        totals = LabDailyStat.objects.filter(page=page).aggregate(views=Sum("views"), signups=Sum("signups"))
        views, signups = totals["views"] or 0, totals["signups"] or 0
        return Response(
            {
                "views": views,
                "signups": signups,
                # Only when there's something to divide by; otherwise "unavailable", never 0%.
                "conversion": round(signups / views, 4) if views else None,
                "current_signups": page.signups.filter(expires_at__gt=timezone.now()).count(),  # after deletions and retention
                "daily": rows,
                "since": since,
                "sample": sample_note(views, "views"),
                "price_test": _price_test_results(page),
            }
        )

    def _signups(self):
        return self.get_object().signups.all()

    @action(detail=True, methods=["get"])
    def signups(self, request, project_pk=None, pk=None):
        self._no_api_keys()
        qs = self._signups().filter(expires_at__gt=timezone.now())[:500]
        return Response(
            {
                "results": [
                    {
                        "id": s.id,
                        "email": crypto.decrypt(s.email_encrypted),  # None if undecryptable (shown as unavailable)
                        "joined_at": s.consented_at,
                        "expires_at": s.expires_at,
                        "consent_version": s.consent_version,
                    }
                    for s in qs
                ]
            }
        )

    @action(detail=True, methods=["get"], url_path="signups-export")
    def signups_export(self, request, project_pk=None, pk=None):
        self._no_api_keys()
        page = self.get_object()
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="waitlist-{page.slug or page.pk}.csv"'
        resp["Cache-Control"] = "no-store"
        w = csv.writer(resp)
        w.writerow(["email", "joined_at", "delete_after", "consent_version"])
        for s in page.signups.filter(expires_at__gt=timezone.now()).iterator():
            email = crypto.decrypt(s.email_encrypted) or ""
            # Neutralise spreadsheet formulas (CSV injection): a cell starting with = + - @ is prefixed with '.
            if email[:1] in ("=", "+", "-", "@", "\t", "\r"):
                email = "'" + email
            w.writerow([email, s.consented_at.isoformat(), s.expires_at.date().isoformat(), s.consent_version])
        return resp

    @action(detail=True, methods=["post"], url_path="signups/delete")
    def delete_signups(self, request, project_pk=None, pk=None):
        """POST {ids: [...]} or {all: true}: delete sign-ups permanently (e.g. a respondent asked)."""
        qs = self._signups()
        body = request.data if isinstance(request.data, dict) else {}
        if body.get("all") is True:
            n, _ = qs.delete()
        else:
            raw = body.get("ids")
            ids = [i for i in raw if type(i) is int][:500] if isinstance(raw, list) else []
            n, _ = qs.filter(pk__in=ids).delete()
        return Response({"deleted": n})


def _price_test_results(page: LabPage) -> dict | None:
    """Per variant: views, "choose" clicks and sign-ups as shown on the page, with rates only where there's a
    denominator, and a comparison that says "can't tell yet" until both groups are big enough and clearly apart."""
    test = price_test(page.blocks)
    all_stats = LabVariantStat.objects.filter(page=page)
    earlier = all_stats.exclude(test_key=test["key"]) if test else all_stats
    earlier_totals = earlier.aggregate(views=Sum("views"), clicks=Sum("clicks"), signups=Sum("signups"))
    previous = (
        {"views": earlier_totals["views"] or 0, "clicks": earlier_totals["clicks"] or 0, "signups": earlier_totals["signups"] or 0}
        if earlier.exists()
        else None
    )
    if test is None:
        # No test on the page now: earlier counts can't be shown against prices that are gone.
        return {"active": False, "variants": [], "comparisons": [], "previous": previous, "note": ""} if previous else None
    rows = {
        r["variant"]: r
        for r in all_stats.filter(test_key=test["key"])
        .values("variant")
        .annotate(views=Sum("views"), clicks=Sum("clicks"), signups=Sum("signups"))
    }
    n = len(test["variants"])
    variants = []
    for v in range(n):
        r = rows.get(v, {})
        views, clicks, signups = r.get("views") or 0, r.get("clicks") or 0, r.get("signups") or 0
        items = test["variants"][v]
        variants.append(
            {
                "variant": variant_label(v),
                "prices": [{"name": i.get("name"), "price": i.get("price"), "period": i.get("period", "")} for i in items],
                "views": views,
                "clicks": clicks,
                "signups": signups,
                "click_rate": round(clicks / views, 4) if views else None,
                "signup_rate": round(signups / views, 4) if views else None,
                "sample": sample_note(views, "views"),
            }
        )
    comparisons = []
    for metric in ("signups", "clicks"):
        a = variants[0]
        for b in variants[1:]:
            result = compare_rates((a[metric], a["views"]), (b[metric], b["views"]))
            comparisons.append({"metric": metric, "a": a["variant"], "b": b["variant"], **result})
    return {
        "active": True,
        "variants": variants,
        "comparisons": comparisons,
        # Counts from earlier versions of the test (other prices, or variants since removed), kept apart.
        "previous": previous,
        "note": (
            "Each visitor sees one variant, picked from their network and the day (no cookies), so a person can see "
            "another variant on another day or network. Differences are only called when both variants have at least "
            "100 views and the gap is clear at the 95% level."
        ),
    }


class NoticesView(APIView):
    """GET /projects/{id}/lab-notices — respondents who had their data deleted (so the founder cleans exports too).
    POST marks them seen."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]

    def get(self, request, project_pk: str):
        project = _owned_project(request, project_pk)
        qs = DataRequestNotice.objects.filter(project=project)[:50]
        return Response(
            {
                "results": [
                    {"id": n.id, "source": n.source, "removed": n.removed, "created_at": n.created_at, "seen": n.seen} for n in qs
                ]
            }
        )

    def post(self, request, project_pk: str):
        project = _owned_project(request, project_pk)
        n = DataRequestNotice.objects.filter(project=project, seen=False).update(seen=True)
        return Response({"marked": n})


class SuggestView(APIView):
    """POST /projects/{id}/lab-suggest — AI copy for hero, problem, benefits and FAQ (labelled; web sessions only)."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    throttle_scope = "ai"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request, project_pk: str):
        from lab.suggest import SuggestError, suggest

        project = _owned_project(request, project_pk)
        try:
            blocks = suggest(project, request.user)
        except SuggestError as exc:
            return Response({"error": {"code": "unavailable", "message": str(exc)}}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"blocks": blocks, "ai": True})


class SlugCheckView(APIView):
    """GET /lab/slug?slug=&page=|survey= — is this web address free? (signed-in users only)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        slug = (request.query_params.get("slug") or "").lower()[:60]
        problem = slug_problem(slug)
        if problem:
            return Response({"available": False, "reason": problem})
        own = request.query_params.get("page", "")
        own_survey = request.query_params.get("survey", "")
        # The founder's own page or survey keeps its address.
        from lab.models import Survey
        from lab.surveys import small_int

        own_page_id, own_survey_id = small_int(own, 18), small_int(own_survey, 18)
        page_id = own_page_id if own_page_id and LabPage.objects.filter(pk=own_page_id, project__owner=request.user).exists() else None
        survey_id = (
            own_survey_id if own_survey_id and Survey.objects.filter(pk=own_survey_id, project__owner=request.user).exists() else None
        )
        taken = slug_taken(slug, page_id=page_id, survey_id=survey_id)
        return Response({"available": not taken, "reason": "That address is taken." if taken else ""})
