from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import ApiKeyViewSet, MeView
from analytics.views import EventView
from billing.views import CheckoutView, LemonSqueezyWebhookView, PacksView, UsageView
from evidence.views import EvidenceClusterViewSet, EvidenceViewSet
from monitoring.views import ChangeViewSet, WatchViewSet
from projects.views import AssumptionViewSet, DashboardSummaryView, ProjectQueryViewSet, ProjectViewSet
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
    path("api/billing/usage", UsageView.as_view()),
    path("api/billing/webhooks/lemonsqueezy", LemonSqueezyWebhookView.as_view()),
    path("api/analytics/events", EventView.as_view()),
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
