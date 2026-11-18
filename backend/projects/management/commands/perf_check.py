"""Performance check: seed one realistic account, time the main read endpoints, report p50/p95 and query counts.

    python manage.py perf_check                   # 500 evidence records, 20 timed requests per endpoint
    python manage.py perf_check --evidence 2000 --requests 50 --strict --json perf.json

Everything runs inside one transaction that is rolled back, so nothing it creates is kept. Outside calls are
switched off for the run (no AI key, no payment provider), so it measures our code and database only. Use it on
PostgreSQL for meaningful numbers (SQLite timings are not representative). It refuses to run with DEBUG off unless
--force is given, because it holds write locks for the length of the run.
"""

from __future__ import annotations

import json
import statistics
import time
from datetime import UTC, date, datetime, timedelta
from unittest import mock

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.views import APIView

# Budgets for one request against a seeded account. A breach is flagged; with --strict the command fails.
P95_BUDGET_MS = 250
QUERY_BUDGET = 20


class Command(BaseCommand):
    help = "Time the main API endpoints against a seeded account (rolled back) and flag slow or query-heavy ones."

    def add_arguments(self, parser):
        parser.add_argument("--evidence", type=int, default=500, help="evidence records in the seeded project")
        parser.add_argument("--requests", type=int, default=20, help="timed requests per endpoint (after 1 warm-up)")
        parser.add_argument("--strict", action="store_true", help="exit non-zero when any endpoint breaks a budget")
        parser.add_argument("--json", dest="json_path", help="also write the results to this file")
        parser.add_argument("--force", action="store_true", help="run even with DEBUG off")

    def handle(self, *args, **opts):
        if not settings.DEBUG and not opts["force"]:
            raise CommandError("perf_check is for local/staging databases. Pass --force to run with DEBUG off.")
        if opts["evidence"] < 1 or opts["requests"] < 1:
            raise CommandError("--evidence and --requests must be at least 1.")

        quiet = {
            "ALLOWED_HOSTS": [*settings.ALLOWED_HOSTS, "testserver"],
            "ANTHROPIC_API_KEY": "",
            "OPENAI_API_KEY": "",
            "LEMONSQUEEZY_API_KEY": "",
        }
        # Throttles are switched off by patching APIView: DRF copies the default throttle classes onto each view
        # at import time, so overriding the setting wouldn't reach them (and every endpoint would hit 429).
        no_throttles = mock.patch.object(APIView, "get_throttles", lambda self: [])
        with override_settings(**quiet), no_throttles, transaction.atomic():
            try:
                ids = _seed(opts["evidence"])
                results = [_measure(path, ids["user"], opts["requests"], ids) for path in _endpoints(ids)]
            finally:
                transaction.set_rollback(True)  # nothing seeded is ever kept

        breaches = [r for r in results if r["flags"]]
        self._print(results, opts)
        if opts["json_path"]:
            meta = {"evidence": opts["evidence"], "requests": opts["requests"], "db": connection.vendor}
            budgets = {"p95_ms": P95_BUDGET_MS, "queries": QUERY_BUDGET}
            with open(opts["json_path"], "w", encoding="utf-8") as fh:
                json.dump({"meta": meta, "budgets": budgets, "results": results}, fh, indent=2)
        if breaches and opts["strict"]:
            raise CommandError(f"{len(breaches)} endpoint(s) over budget.")

    def _print(self, results, opts):
        out = self.stdout
        out.write(
            f"perf_check on {connection.vendor}: {opts['evidence']} evidence, {opts['requests']} requests per endpoint "
            f"(budgets: p95 <= {P95_BUDGET_MS} ms, <= {QUERY_BUDGET} queries)\n"
        )
        out.write(f"{'endpoint':<48} {'status':>6} {'p50 ms':>8} {'p95 ms':>8} {'queries':>8}  flags")
        for r in results:
            nums = f"{r['status']:>6} {r['p50_ms']:>8.1f} {r['p95_ms']:>8.1f} {r['queries']:>8}"
            line = f"{r['label'][:48]:<48} {nums}  {','.join(r['flags'])}"
            out.write(self.style.WARNING(line) if r["flags"] else line)
        bad = sum(1 for r in results if r["flags"])
        out.write(self.style.WARNING(f"{bad} over budget") if bad else self.style.SUCCESS("All endpoints within budget."))


def _measure(path: str, user, n: int, ids: dict) -> dict:
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user)
    first = client.get(path)  # warm-up (also the status we report)
    # Counted with an execute wrapper: Django clears connection.queries at each request start, so
    # CaptureQueriesContext around a test-client request reports nothing.
    executed = []

    def count(execute, sql, params, many, context):
        executed.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(count):
        client.get(path)
    timings = []
    for _ in range(n):
        start = time.perf_counter()
        client.get(path)
        timings.append((time.perf_counter() - start) * 1000)
    timings.sort()
    p95 = timings[min(len(timings) - 1, max(0, round(0.95 * len(timings)) - 1))]
    flags = []
    if first.status_code >= 400:
        flags.append(f"HTTP {first.status_code}")
    if p95 > P95_BUDGET_MS:
        flags.append("slow")
    if len(executed) > QUERY_BUDGET:
        flags.append("queries")
    label = path.replace(str(ids["project"]), "{id}").replace(str(ids["other_project"]), "{id2}")
    label = label.replace(f"lab-pages/{ids['lab_page']}/", "lab-pages/{pid}/").replace(
        f"lab-surveys/{ids['survey']}/", "lab-surveys/{sid}/"
    )
    return {
        "path": label,
        "label": label,
        "status": first.status_code,
        "p50_ms": round(statistics.median(timings), 1),
        "p95_ms": round(p95, 1),
        "queries": len(executed),
        "flags": flags,
    }


def _endpoints(ids: dict) -> list[str]:
    p, q = ids["project"], ids["other_project"]
    return [
        "/api/me",
        "/api/dashboard/summary",
        "/api/projects",
        f"/api/projects/{p}",
        f"/api/projects/{p}/queries",
        f"/api/evidence?project={p}",
        f"/api/evidence?project={p}&category=pain_point&q=count",
        f"/api/evidence/facets?project={p}",
        f"/api/evidence/clusters?project={p}",
        f"/api/reports/{p}",
        f"/api/reports/{p}/history",
        f"/api/reports/{p}/competitive-matrix",
        f"/api/projects/{p}/assumptions",
        f"/api/projects/compare?ids={p},{q}",
        f"/api/projects/{p}/watches",
        f"/api/projects/{p}/changes",
        f"/api/projects/{p}/candidates",
        f"/api/projects/{p}/signals",
        f"/api/projects/{p}/signals?status=all&type=opportunity",
        f"/api/projects/{p}/score-history",
        f"/api/projects/{p}/distribution",
        f"/api/projects/{p}/lab-pages",
        f"/api/projects/{p}/lab-pages/{ids['lab_page']}/stats",
        f"/api/projects/{p}/lab-surveys",
        f"/api/projects/{p}/lab-surveys/{ids['survey']}/results",
        f"/api/projects/{p}/lab-surveys/{ids['survey']}/responses",
        f"/api/projects/{p}/predicted-vs-actual",
        f"/api/projects/{p}/lab-notices",
        "/api/monitoring/changes",
        "/api/notifications",
        "/api/billing/packs",
        "/api/billing/usage",
        "/api/email/preferences",
    ]


def _seed(n_evidence: int) -> dict:
    """One founder with two researched projects, a report, monitoring history and a credit ledger."""
    from accounts.models import User
    from billing.models import UsageTransaction
    from evidence.models import Evidence, EvidenceCluster
    from monitoring.models import Change, CompetitorCandidate, Watch
    from notifications.services import notify
    from projects.models import IdeaDefinition, MarketProfile, Project
    from reports.services import build_report
    from research.models import ResearchJob, ResearchQuery

    user = User.objects.create_user("perf-check", "perf-check@validme.invalid", None, credits=50)
    categories = ["pain_point", "buying_intent", "feature_request", "complaint", "question"]
    projects, jobs = [], []
    for name, n in (("Restaurant stock counting", n_evidence), ("Second idea", max(1, n_evidence // 5))):
        project = Project.objects.create(owner=user, name=name, status="COMPLETED")
        IdeaDefinition.objects.create(
            project=project,
            original_description="Stock counting for small independent restaurants.",
            ai_interpretation={"assumptions": ["Owners count stock weekly.", "Spreadsheets are the main tool."]},
        )
        MarketProfile.objects.create(project=project, price_hypothesis="$29/month", geographies=["UK"])
        job = ResearchJob.objects.create(
            project=project, idempotency_key=f"perf-{name}", status="COMPLETED", completed_at=timezone.now(), config_snapshot={}
        )
        for intent in ("problem_discovery", "buying_intent", "competitor_gaps", "customer_acquisition"):
            for i in range(3):
                ResearchQuery.objects.create(project=project, text=f"{intent} query {i}", intent=intent)
        now = datetime.now(UTC)
        rows = [
            Evidence(
                project=project,
                job=job,
                provider=("hackernews", "stackexchange", "web")[i % 3],
                source_url=f"https://source{i % 40}.test/thread/{i}",
                title=f"Counting stock by hand takes hours ({i})",
                excerpt=f"We count stock every week on clipboards and it takes hours. Record {i}.",
                published_at=date.today() - timedelta(days=i % 365),
                retrieved_at=now,
                author_hash=f"a{i % 120}",
                content_hash=f"perf{project.pk}{i}",
                category=categories[i % len(categories)],
                relevance=round(1 - (i % 100) / 100, 2),
                classifier_version="perf",
            )
            for i in range(n)
        ]
        Evidence.objects.bulk_create(rows, batch_size=500)
        ids = list(Evidence.objects.filter(project=project).values_list("id", flat=True))
        for c in range(min(8, max(1, n // 25))):
            cluster = EvidenceCluster.objects.create(
                project=project, job=job, name=f"Theme {c}", category=categories[c % 5], severity="high", confidence="medium"
            )
            cluster.evidence.set(ids[c::8][:60])
        build_report(job)
        projects.append(project)
        jobs.append(job)

    main = projects[0]
    watches = [
        Watch.objects.create(
            project=main, url=f"https://competitor{i}.test/pricing", label=f"Competitor {i}", next_run_at=timezone.now()
        )
        for i in range(15)
    ]
    Change.objects.bulk_create(
        Change(
            watch=watches[i % len(watches)],
            project=main,
            kind="pricing" if i % 3 == 0 else "content",
            significance=("high", "medium", "low")[i % 3],
            summary="Prices changed (new price: $35/mo)",
            details={"prices_added": ["$35/mo"], "blocks_added": ["New plan for groups"] * 5},
            detected_at=timezone.now() - timedelta(hours=i),
        )
        for i in range(120)
    )
    for i in range(5):
        CompetitorCandidate.objects.create(
            project=main,
            domain=f"newcomer{i}.test",
            name=f"Newcomer {i}",
            url=f"https://newcomer{i}.test/",
            source_url=f"https://news.ycombinator.com/item?id={i}",
            source="hackernews",
            found_at=timezone.now(),
        )
    for i in range(60):
        notify(
            user,
            kind="competitor_change",
            title=f"Competitor {i % 15}: prices changed",
            link=f"/projects/{main.pk}/monitoring",
            source=f"perf:{i}",
        )
    UsageTransaction.objects.bulk_create(
        UsageTransaction(user=user, job=jobs[0], operation="research_job", credits=-1) for _ in range(80)
    )
    # Radar: signals from the seeded evidence, changes and an accepted candidate; a year of weekly snapshots.
    from radar import services as radar
    from radar.models import ScoreSnapshot

    CompetitorCandidate.objects.filter(project=main).update(status="accepted")
    radar.after_report(jobs[0])
    for c in Change.objects.filter(project=main, significance="high")[:20]:
        radar.signal_for_change(c)
    ScoreSnapshot.objects.bulk_create(
        ScoreSnapshot(
            project=main, source="revalidation", score=50 + i % 10, confidence="medium", created_at=timezone.now() - timedelta(weeks=i)
        )
        for i in range(1, 52)
    )
    # Distribution: 30 YouTube channels and 40 keywords (the page reads them; no provider is called).
    from distribution.models import KeywordMetric, YouTubeChannel

    now = timezone.now()
    YouTubeChannel.objects.bulk_create(
        YouTubeChannel(
            project=main,
            channel_id=f"UC{i}",
            title=f"Channel {i}",
            subscriber_count=1000 * i,
            video_count=10 + i,
            latest_video_id=f"v{i}",
            latest_video_title="Counting stock",
            latest_video_at=now - timedelta(days=i),
            matched_queries=["restaurant inventory"],
            fetched_at=now,
            expires_at=now + timedelta(days=30),
        )
        for i in range(30)
    )
    KeywordMetric.objects.bulk_create(
        KeywordMetric(
            project=main,
            keyword=f"stock keyword {i}",
            location_code=2826,
            language_code="en",
            search_volume=100 * i,
            monthly=[{"year": 2026, "month": m, "volume": 100 + m} for m in range(1, 13)],
            fetched_at=now,
        )
        for i in range(40)
    )
    # Validation Lab (Weeks 13-15): 3 live pages with 90 days of stats (one with a price test), a survey with 2,000
    # answers linked to assumptions (typed answers encrypted), and the verdicts computed from them.
    import json as _json

    from lab import crypto
    from lab.blocks import price_test
    from lab.models import LabDailyStat, LabPage, LabVariantStat, Survey, SurveyResponse
    from lab.verdicts import evaluate_assumptions
    from projects.models import Assumption

    priced = [
        {"type": "hero", "headline": "Count stock faster"},
        {"type": "pricing", "items": [{"name": "Basic", "price": "$9"}], "test_variants": [[{"name": "Basic", "price": "$19"}]]},
        {"type": "waitlist"},
    ]
    pages = [
        LabPage.objects.create(
            project=main, title=f"Page {i}", slug=f"perf-page-{i}", blocks=priced, status="published", published_at=now
        )
        for i in range(3)
    ]
    today = timezone.localdate()
    LabDailyStat.objects.bulk_create(
        LabDailyStat(page=pg, day=today - timedelta(days=d), views=20 + d % 7, signups=d % 4) for pg in pages for d in range(90)
    )
    key = price_test(priced)["key"]
    LabVariantStat.objects.bulk_create(
        LabVariantStat(page=pages[0], test_key=key, variant=v, day=today - timedelta(days=d), views=10, clicks=d % 3, signups=d % 2)
        for v in range(2)
        for d in range(90)
    )
    assumptions = [Assumption.objects.create(project=main, text=f"Perf assumption {i}") for i in range(4)]
    questions = [
        {
            "id": f"q{i + 1}",
            "type": "single",
            "prompt": f"Question {i}",
            "options": ["A", "B", "C"],
            "assumption_id": a.id,
            "support_options": [0],
        }
        for i, a in enumerate(assumptions)
    ] + [{"id": "q5", "type": "scale", "prompt": "Pain"}, {"id": "q6", "type": "text", "prompt": "Tried?"}]
    survey = Survey.objects.create(
        project=main, title="Perf survey", slug="perf-survey", questions=questions, status="published", published_at=now
    )
    typed = crypto.encrypt_text(_json.dumps({"q6": "A notebook and a spreadsheet"}))
    SurveyResponse.objects.bulk_create(
        SurveyResponse(
            survey=survey,
            answers={**{f"q{i + 1}": (r + i) % 3 for i in range(4)}, "q5": 1 + r % 5},
            text_encrypted=typed,
            consent_version="v",
            expires_at=now + timedelta(days=180),
        )
        for r in range(2000)
    )
    evaluate_assumptions(main)
    return {"user": user, "project": main.pk, "other_project": projects[1].pk, "lab_page": pages[0].pk, "survey": survey.pk}
