from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import ApiKeyViewSet, MeView
from analytics.views import EventView
from billing.views import CheckoutView, LemonSqueezyWebhookView, PacksView, PortalView, SubscribeView, UsageMonthlyView, UsageView
from distribution.views import DistributionRefreshView, DistributionView
from evidence.views import EvidenceClusterViewSet, EvidenceViewSet
from lab.survey_views import SurveySuggestView, SurveyViewSet
from lab.views import LabPageViewSet, NoticesView, PredictedActualView, SlugCheckView, SuggestView
from mailer.views import PreferencesView, ResendWebhookView, UnsubscribeView
from monitoring.views import CandidateViewSet, ChangeViewSet, MonitoringFeedView, WatchViewSet
from notifications.views import MarkReadView, NotificationsView
from projects.views import AssumptionViewSet, DashboardSummaryView, ProjectQueryViewSet, ProjectViewSet
from radar.views import ScoreHistoryView, SignalViewSet
from reports.views import CompetitiveMatrixView, ReportExportView, ReportHistoryView, ReportView
from research.views import EstimateView, ResearchJobViewSet, SourcesView

router = DefaultRouter(trailing_slash=False)
router.register("projects", ProjectViewSet, basename="project")
router.register("research/jobs", ResearchJobViewSet, basename="research-job")
router.register("api-keys", ApiKeyViewSet, basename="api-key")
router.register("evidence/clusters", EvidenceClusterViewSet, basename="evidence-cluster")
router.register("evidence", EvidenceViewSet, basename="evidence")
router.register(r"projects/(?P<project_pk>[^/.]+)/queries", ProjectQueryViewSet, basename="project-query")
router.register(r"projects/(?P<project_pk>[^/.]+)/assumptions", AssumptionViewSet, basename="project-assumption")
router.register(r"projects/(?P<project_pk>[^/.]+)/watches", WatchViewSet, basename="project-watch")
router.register(r"projects/(?P<project_pk>[^/.]+)/changes", ChangeViewSet, basename="project-change")
router.register(r"projects/(?P<project_pk>[^/.]+)/candidates", CandidateViewSet, basename="project-candidate")
router.register(r"projects/(?P<project_pk>[^/.]+)/signals", SignalViewSet, basename="project-signal")
router.register(r"projects/(?P<project_pk>[^/.]+)/lab-pages", LabPageViewSet, basename="project-lab-page")
router.register(r"projects/(?P<project_pk>[^/.]+)/lab-surveys", SurveyViewSet, basename="project-lab-survey")


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    # allauth: headless JSON API for the frontend + provider OAuth callbacks (Google).
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.urls")),
    path("api/health", health),
    path("api/me", MeView.as_view()),
    path("api/dashboard/summary", DashboardSummaryView.as_view()),
    path("api/research/sources", SourcesView.as_view()),
    path("api/billing/packs", PacksView.as_view()),
    path("api/billing/checkout", CheckoutView.as_view()),
    path("api/billing/subscribe", SubscribeView.as_view()),
    path("api/billing/portal", PortalView.as_view()),
    path("api/billing/usage", UsageView.as_view()),
    path("api/billing/usage/monthly", UsageMonthlyView.as_view()),
    path("api/billing/webhooks/lemonsqueezy", LemonSqueezyWebhookView.as_view()),
    path("api/analytics/events", EventView.as_view()),
    path("api/notifications", NotificationsView.as_view()),
    path("api/email/preferences", PreferencesView.as_view()),
    path("api/email/unsubscribe", UnsubscribeView.as_view()),
    path("api/email/webhooks/resend", ResendWebhookView.as_view()),
    path("api/notifications/read", MarkReadView.as_view()),
    path("api/monitoring/changes", MonitoringFeedView.as_view()),
    path("api/projects/<str:project_pk>/score-history", ScoreHistoryView.as_view()),
    path("api/projects/<str:project_pk>/distribution", DistributionView.as_view()),
    path("api/projects/<str:project_pk>/distribution/refresh", DistributionRefreshView.as_view()),
    path("api/projects/<str:project_pk>/lab-suggest", SuggestView.as_view()),
    path("api/projects/<str:project_pk>/lab-survey-suggest", SurveySuggestView.as_view()),
    path("api/projects/<str:project_pk>/lab-notices", NoticesView.as_view()),
    path("api/projects/<str:project_pk>/predicted-vs-actual", PredictedActualView.as_view()),
    path("api/lab/slug", SlugCheckView.as_view()),
    path("api/research/estimate", EstimateView.as_view()),
    path("api/reports/<str:project_id>", ReportView.as_view()),
    path("api/reports/<str:project_id>/history", ReportHistoryView.as_view()),
    path("api/reports/<str:project_id>/export", ReportExportView.as_view()),
    path("api/reports/<str:project_id>/competitive-matrix", CompetitiveMatrixView.as_view()),
    path("api/", include(router.urls)),
]

# API callers get the JSON error envelope even for unmatched URLs and crashes, never an HTML page.
handler404 = "config.errors.not_found"
handler500 = "config.errors.server_error"
